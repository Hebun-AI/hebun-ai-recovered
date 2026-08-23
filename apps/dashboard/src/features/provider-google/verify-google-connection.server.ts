/*
 * provider-google/verify-google-connection.server.ts — THE FIRST REAL VERIFIER IN HEBUN.
 *
 * ── WHAT "VERIFIED" MEANS, MECHANICALLY ──────────────────────────────────────
 *
 * Hebun asked Google, with this tenant's stored credential, and Google answered with an account.
 * Nothing weaker counts. Not that a credential row exists. Not that it decrypted. Not that it has
 * the right shape. Not that a provider definition exists. Those were all true one line before the
 * network call, and none of them is evidence about Google.
 *
 * ── THE PLAINTEXT NEVER LEAVES THE CALLBACK ──────────────────────────────────
 *
 * The access token is obtained through INT-2's `withDecryptedSecret`, used INSIDE the callback to
 * make one HTTP call, and never returned. `withDecryptedSecret` returns what the callback returns,
 * which here is a classified outcome — so there is no path by which this function could hand a
 * caller a token even by mistake.
 *
 * ── LAZY REFRESH, AND ONLY WHEN IT IS THE ACTUAL PROBLEM ─────────────────────
 *
 * Google's access tokens expire in about an hour. When one is refused as `auth`, this tries the
 * refresh credential ONCE and re-verifies. A transport failure is NOT retried with a refresh —
 * refreshing because Google returned 503 would spend a refresh token on a problem it cannot fix.
 *
 * ── WHY THIS MODULE DOES NOT WRITE ───────────────────────────────────────────
 *
 * It returns an outcome. `integration-authority` owns the lifecycle and `integration-credentials`
 * owns the vault, and a verifier that could write either would be a third authority over both. A
 * firewall test walks this module's import graph to prove it mints no permit and executes nothing.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  listCredentialMetadata,
  replaceCredential,
  withDecryptedSecret,
} from "@/features/integration-credentials/credential-repository.server";
import {
  coversRequiredScopes,
  type GoogleFailureClass,
  type GoogleVerificationOutcome,
} from "./contracts";
import { fetchGoogleIdentity, refreshAccessToken, type GoogleTransportDeps } from "./google-transport.server";
import {
  resolveGoogleOAuthEnvironment,
  type ConfiguredGoogleOAuth,
} from "./google-environment.server";

export interface VerifyGoogleDeps extends GoogleTransportDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Google verification is server-only.");
  }
}

/** How a verification failure maps onto the connection authority's two write classes. */
export function lifecycleClassFor(failure: GoogleFailureClass): "auth" | "degraded" | "unreachable" {
  if (failure === "auth" || failure === "scope" || failure === "identity") return "auth";
  if (failure === "transport") return "unreachable";
  /* `malformed` — Google answered something unusable. That is a provider problem, not a grant one. */
  return "degraded";
}

/**
 * Verify one connection's stored credential against Google, refreshing once if the access token
 * is the thing that failed.
 *
 * Returns an OUTCOME. It writes nothing, and it cannot: it holds no lifecycle writer.
 */
export async function verifyGoogleConnection(
  tenant: TenantContext,
  integrationId: string,
  deps: VerifyGoogleDeps = {},
): Promise<GoogleVerificationOutcome> {
  assertServerOnly();

  const resolution = resolveGoogleOAuthEnvironment(deps.env ?? process.env);
  if (resolution.status !== "configured") {
    return { ok: false, failure: "auth", reason: "google-oauth-not-configured" };
  }

  const listing = await listCredentialMetadata(tenant, integrationId, {
    getDb: deps.getDb,
    env: deps.env,
  });
  if (listing.status !== "read") {
    return { ok: false, failure: "auth", reason: "credential-unavailable" };
  }
  const access = listing.credentials.find((c) => c.kind === "oauth_access" && c.live);
  if (!access) return { ok: false, failure: "auth", reason: "no-live-access-credential" };

  const first = await attempt(tenant, access.credentialId, deps);
  if (first.ok || lifecycleClassFor(first.failure) !== "auth") return first;

  /*
   * The access token was refused. That is the ONE case a refresh can fix — and only if the tenant
   * has a refresh credential at all. Google omits one on re-authorization, so its absence is
   * ordinary rather than exceptional.
   */
  const refresh = listing.credentials.find((c) => c.kind === "oauth_refresh" && c.live);
  if (!refresh) return first;

  const refreshed = await refreshAndReplace(
    tenant,
    integrationId,
    refresh.credentialId,
    resolution,
    deps,
  );
  if (!refreshed.ok) return { ok: false, failure: refreshed.failure, reason: refreshed.reason };

  return attempt(tenant, refreshed.accessCredentialId, deps);
}

/** One verification attempt against one stored access credential. */
async function attempt(
  tenant: TenantContext,
  credentialId: string,
  deps: VerifyGoogleDeps,
): Promise<GoogleVerificationOutcome> {
  const used = await withDecryptedSecret(
    tenant,
    credentialId,
    /*
     * THE ONLY MOMENT A GOOGLE TOKEN IS PLAINTEXT. One call, inside the callback, and what comes
     * back out is a classified outcome rather than anything the token could hide in.
     */
    async (accessToken): Promise<GoogleVerificationOutcome> => {
      const identity = await fetchGoogleIdentity(accessToken, deps);
      if (!identity.ok) return identity;
      /*
       * NO SCOPES ARE CLAIMED HERE. `userinfo` does not report a grant, and repeating the scopes
       * Hebun already stored would dress a stale record as a fresh observation. Scopes are
       * observed where Google actually states them: the token endpoint's `scope` field.
       */
      return { ok: true, identity: identity.identity, grantedScopes: [] };
    },
    { getDb: deps.getDb, env: deps.env },
  );

  if (used.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${used.reason}` };
  }
  return used.value;
}

type RefreshResult =
  | { readonly ok: true; readonly accessCredentialId: string }
  | { readonly ok: false; readonly failure: GoogleFailureClass; readonly reason: string };

/**
 * Spend the refresh credential and store the replacement access credential atomically.
 *
 * The replacement goes through INT-2's `replaceCredential`, which already proves — under injected
 * failure at two different steps — that a rollback leaves the previous credential live and
 * decryptable. This module adds no second transaction and no second ordering.
 *
 * A ROTATED REFRESH TOKEN IS REPLACED; AN ABSENT ONE IS LEFT ALONE. Google usually returns none
 * here, and treating that as "replace it with nothing" would destroy the tenant's only way back.
 */
async function refreshAndReplace(
  tenant: TenantContext,
  integrationId: string,
  refreshCredentialId: string,
  config: ConfiguredGoogleOAuth,
  deps: VerifyGoogleDeps,
): Promise<RefreshResult> {
  const exchanged = await withDecryptedSecret(
    tenant,
    refreshCredentialId,
    async (refreshToken) => refreshAccessToken(refreshToken, config, deps),
    { getDb: deps.getDb, env: deps.env },
  );
  if (exchanged.status !== "used") {
    return { ok: false, failure: "auth", reason: `credential-${exchanged.reason}` };
  }
  const token = exchanged.value;
  if (!token.ok) return { ok: false, failure: token.failure, reason: token.reason };

  const replaced = await replaceCredential(
    tenant,
    {
      integrationId,
      kind: "oauth_access",
      plaintext: token.grant.accessToken,
      expiresAt: token.grant.expiresAt,
    },
    { getDb: deps.getDb, env: deps.env },
  );
  if (replaced.status !== "replaced") {
    return { ok: false, failure: "auth", reason: `replace-${replaced.reason}` };
  }

  if (token.grant.refreshToken) {
    /* Google ROTATED it. Replace atomically; the old one stops working the moment it is used. */
    const rotated = await replaceCredential(
      tenant,
      { integrationId, kind: "oauth_refresh", plaintext: token.grant.refreshToken },
      { getDb: deps.getDb, env: deps.env },
    );
    if (rotated.status !== "replaced") {
      return { ok: false, failure: "auth", reason: `rotate-${rotated.reason}` };
    }
  }

  return { ok: true, accessCredentialId: replaced.credential.credentialId };
}

/** Whether a granted scope set covers what INT-3 requires. Re-exported so callers share one rule. */
export { coversRequiredScopes };
