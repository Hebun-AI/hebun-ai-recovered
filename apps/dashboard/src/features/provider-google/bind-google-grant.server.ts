/*
 * provider-google/bind-google-grant.server.ts — WHERE A GOOGLE GRANT BECOMES A BOUND CONNECTION,
 * IN ONE COMMIT (GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 + GOOGLE-OAUTH-FIRST-BIND-RACE-1).
 *
 * ── THE INVARIANT ─────────────────────────────────────────────────────────────
 *
 *     the live credential of a Google connection  ==  a token for the account the row is bound to
 *
 * The callback used to write the credential in one transaction, verify it over the network, and bind
 * the account in a third. Two callbacks for the same connection could interleave between those, and
 * the database then held one account's token under the other account's binding — `connected`,
 * `healthy` and wrong. The account guard of GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 closed that for a row
 * that was already bound; a row that was not yet bound let both callbacks through.
 *
 * ── THE ORDER ─────────────────────────────────────────────────────────────────
 *
 *   1. WHO. Google `userinfo` for the NEW access token, while that token is only in memory. Network
 *      I/O, therefore outside any transaction and holding no lock. A failure here writes nothing.
 *   2. ONE TRANSACTION, owned by nobody new:
 *        lock the connection row           — Integration authority, `lockConnectionWithin`
 *        compare with the CURRENT binding  — `isAccountChange`, the rule `recordVerifiedConnectionWithin`
 *                                            applies; a different account returns with ZERO writes
 *        store / replace the credential    — INT-2, `storeCredential` / `replaceCredential`, joined to
 *                                            this transaction (sealing, audit and row lock unchanged)
 *        bind the account, `connected`     — `recordVerifiedConnectionWithin`
 *      Any refusal after the first write throws, so the credential write rolls back with it.
 *
 * A second callback for the same row waits on the row lock until the first commits, then compares
 * against the account the first bound: the same account replaces its token coherently; a different
 * account is refused having written nothing. Rows of other connections, other families and other
 * tenants are different rows and never wait on each other.
 *
 * ── WHAT "VERIFIED" MEANS NOW ─────────────────────────────────────────────────
 *
 * The Google answer that binds the account is the answer for the EXACT token being stored — obtained
 * before storing instead of after, from the same bytes. Nothing weaker than before is recorded: the
 * account is still Google's statement, never the request's; scopes are still the token endpoint's.
 *
 * Server-only. No token, code or provider body is logged or returned.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isAccountChange,
  lockConnectionWithin,
  recordVerifiedConnectionWithin,
} from "@/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
  type CredentialRepositoryDeps,
} from "@/features/integration-credentials/credential-repository.server";
import type { GoogleFailureClass } from "./contracts";
import { fetchGoogleIdentity, type GoogleTransportDeps } from "./google-transport.server";

export interface GoogleGrantToBind {
  readonly accessToken: string;
  /** Absent on re-authorization; absence never clears the stored refresh token. */
  readonly refreshToken: string | null | undefined;
  readonly expiresAt: Date | null | undefined;
  /** Google's own statement of the grant, from the token endpoint. */
  readonly grantedScopes: readonly string[];
}

export type GoogleGrantOutcome =
  | "connected"
  | "record-account-changed"
  | "record-account-already-connected"
  | "record-not-found"
  | "record-persistence-unavailable"
  | `record-${string}`
  | `credential-${string}`
  | `verification-${GoogleFailureClass}`;

export interface CommitGoogleGrantDeps extends GoogleTransportDeps {
  readonly getDb: () => ControlPlaneDatabase | null;
  /** Key registry source for INT-2. Production leaves it unset. */
  readonly env?: CredentialRepositoryDeps["env"];
  /**
   * TEST-ONLY. Awaited while the connection row is locked and before anything is written, so a test
   * can hold one callback inside its critical section while another reaches the lock.
   */
  readonly whileLockedForTest?: () => Promise<void>;
}

/** Thrown inside the transaction to roll back every write it made. Never escapes this module. */
class Abort extends Error {
  constructor(readonly outcome: GoogleGrantOutcome) {
    super(outcome);
  }
}

const UNIQUE_VIOLATION = "23505";

export async function commitGoogleGrant(
  tenant: TenantContext,
  integrationId: string,
  grant: GoogleGrantToBind,
  now: Date,
  deps: CommitGoogleGrantDeps,
): Promise<GoogleGrantOutcome> {
  if (typeof window !== "undefined") throw new Error("Google grant binding is server-only.");
  const db = deps.getDb();
  if (!db) return "record-persistence-unavailable";

  /* 1. WHO — outside the transaction, before anything is written. */
  const identity = await fetchGoogleIdentity(grant.accessToken, deps);
  if (!identity.ok) return `verification-${identity.failure}`;

  try {
    return await db.transaction(async (tx): Promise<GoogleGrantOutcome> => {
      /* 2a. Lock the row; the binding compared below cannot move until this commits. */
      const current = await lockConnectionWithin(tx, tenant, integrationId);
      if (!current) return "record-not-found";
      if (deps.whileLockedForTest) await deps.whileLockedForTest();

      /* 2b. The CURRENT binding. A different account leaves with nothing written. */
      if (isAccountChange(current.externalAccountId, identity.identity.subject)) return "record-account-changed";

      /* 2c. The credential, through INT-2, inside this transaction. */
      const credentialDeps: CredentialRepositoryDeps = { getDb: () => tx, transaction: tx, now: () => now, env: deps.env };
      const existing = await listCredentialMetadata(tenant, integrationId, credentialDeps);
      if (existing.status !== "read") throw new Abort("record-persistence-unavailable");
      const live = existing.credentials.filter((c) => c.live);

      const access = { integrationId, kind: "oauth_access" as const, plaintext: grant.accessToken, expiresAt: grant.expiresAt ?? null };
      const storedAccess = live.some((c) => c.kind === "oauth_access")
        ? await replaceCredential(tenant, access, credentialDeps)
        : await storeCredential(tenant, access, credentialDeps);
      if (storedAccess.status === "refused") throw new Abort(`credential-${storedAccess.reason}`);

      if (grant.refreshToken) {
        const refresh = { integrationId, kind: "oauth_refresh" as const, plaintext: grant.refreshToken };
        const storedRefresh = live.some((c) => c.kind === "oauth_refresh")
          ? await replaceCredential(tenant, refresh, credentialDeps)
          : await storeCredential(tenant, refresh, credentialDeps);
        if (storedRefresh.status === "refused") throw new Abort(`credential-${storedRefresh.reason}`);
      }

      /* 2d. The binding, in the same commit as the credential it describes. */
      const recorded = await recordVerifiedConnectionWithin(
        tx,
        tenant,
        integrationId,
        {
          externalAccountId: identity.identity.subject,
          externalAccountLabel: identity.identity.email,
          grantedScopes: grant.grantedScopes,
        },
        now,
      );
      if (recorded.status !== "verified") throw new Abort(`record-${recorded.reason}`);
      return "connected";
    });
  } catch (error) {
    if (error instanceof Abort) return error.outcome;
    /*
     * A unique violation rolled the whole transaction back. The driver error may arrive wrapped
     * (`cause`); only its code and constraint NAME are read — never its detail, which can echo values.
     */
    const pg = (error ?? {}) as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
    const code = pg.code ?? pg.cause?.code;
    const constraint = pg.constraint ?? pg.cause?.constraint;
    if (code === UNIQUE_VIOLATION) {
      /* This tenant already holds another live connection of this family for that same Google account. */
      return constraint === "integrations_tenant_provider_account_uq" ? "record-account-already-connected" : "credential-duplicate-live-credential";
    }
    throw error;
  }
}
