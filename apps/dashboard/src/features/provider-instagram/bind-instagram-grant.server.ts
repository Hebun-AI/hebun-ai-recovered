/*
 * provider-instagram/bind-instagram-grant.server.ts — WHERE AN INSTAGRAM GRANT BECOMES A BOUND
 * CONNECTION, IN ONE COMMIT (INSTAGRAM-OAUTH-INTEGRITY-AUDIT-1).
 *
 * ── THE INVARIANT ─────────────────────────────────────────────────────────────
 *
 *     the live credential of an Instagram connection  ==  a token for the account the row is bound to
 *
 * The callback used to store the long-lived token (one commit), read `/me` with the stored copy, and
 * bind the account (a second commit). Measured against the released code on a disposable Postgres:
 *
 *   - a non-switch reconnect of a BOUND row with a different account replaced the token first and was
 *     refused `account-changed` last — the row stayed bound to A, `unverified`, holding B's token;
 *   - two first-binding callbacks for one unbound row could interleave — the row ended bound to A,
 *     `connected` and `healthy`, holding B's token.
 *
 * ── THE ORDER ─────────────────────────────────────────────────────────────────
 *
 *   1. WHO. The caller has already read `/me` for the NEW token while it was only in memory
 *      (`verifyInstagramAccessToken`) — network I/O, outside any transaction, holding no lock. Its
 *      facts arrive here; nothing was written to obtain them.
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
 * against the account the first bound. Other rows and other tenants never wait on each other.
 *
 * Instagram is not Google: there is no refresh credential (Meta issues none), the identity is the
 * app-scoped `/me` id, and the switch flow's candidate row is still a separate, unbound row — this
 * module changes none of that. Server-only. No token or provider body is logged or returned.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isAccountChange,
  lockConnectionWithin,
  recordVerifiedConnectionWithin,
  type VerifiedConnectionFacts,
} from "@/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
  type CredentialRepositoryDeps,
} from "@/features/integration-credentials/credential-repository.server";

export interface InstagramGrantToBind {
  /** The LONG-LIVED token. The short-lived one is never stored. */
  readonly accessToken: string;
  /** Meta's own `expires_in`, as an instant; absent when Meta stated none. */
  readonly expiresAt: Date | null | undefined;
}

export type InstagramGrantOutcome =
  | "connected"
  | "record-account-changed"
  | "record-account-already-connected"
  | "record-not-found"
  | "record-persistence-unavailable"
  | `record-${string}`
  | `credential-${string}`;

export interface CommitInstagramGrantDeps {
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
  constructor(readonly outcome: InstagramGrantOutcome) {
    super(outcome);
  }
}

const UNIQUE_VIOLATION = "23505";

export async function commitInstagramGrant(
  tenant: TenantContext,
  integrationId: string,
  grant: InstagramGrantToBind,
  /** The verifier's facts for THIS token — `verifyInstagramAccessToken`, never the token response. */
  facts: VerifiedConnectionFacts,
  now: Date,
  deps: CommitInstagramGrantDeps,
): Promise<InstagramGrantOutcome> {
  if (typeof window !== "undefined") throw new Error("Instagram grant binding is server-only.");
  const db = deps.getDb();
  if (!db) return "record-persistence-unavailable";

  try {
    return await db.transaction(async (tx): Promise<InstagramGrantOutcome> => {
      /* 2a. Lock the row; the binding compared below cannot move until this commits. */
      const current = await lockConnectionWithin(tx, tenant, integrationId);
      if (!current) return "record-not-found";
      if (deps.whileLockedForTest) await deps.whileLockedForTest();

      /* 2b. The CURRENT binding. A different account leaves with nothing written. */
      if (isAccountChange(current.externalAccountId, facts.externalAccountId)) return "record-account-changed";

      /* 2c. The credential, through INT-2, inside this transaction. */
      const credentialDeps: CredentialRepositoryDeps = { getDb: () => tx, transaction: tx, now: () => now, env: deps.env };
      const existing = await listCredentialMetadata(tenant, integrationId, credentialDeps);
      if (existing.status !== "read") throw new Abort("record-persistence-unavailable");
      const live = existing.credentials.filter((c) => c.live);

      /*
       * There is no `oauth_refresh` row to write beside it: Instagram issues no separate refresh
       * credential, so there is nothing such a row could hold.
       */
      const access = {
        integrationId,
        kind: "oauth_access" as const,
        plaintext: grant.accessToken,
        ...(grant.expiresAt ? { expiresAt: grant.expiresAt } : {}),
      };
      const stored = live.some((c) => c.kind === "oauth_access")
        ? await replaceCredential(tenant, access, credentialDeps)
        : await storeCredential(tenant, access, credentialDeps);
      if (stored.status === "refused") throw new Abort(`credential-${stored.reason}`);

      /* 2d. The binding, in the same commit as the credential it describes. */
      const recorded = await recordVerifiedConnectionWithin(tx, tenant, integrationId, facts, now);
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
      /* This tenant already holds another live Instagram connection for that same account. */
      return constraint === "integrations_tenant_provider_account_uq" ? "record-account-already-connected" : "credential-duplicate-live-credential";
    }
    throw error;
  }
}
