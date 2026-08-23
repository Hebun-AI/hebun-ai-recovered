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
 * ── THE PLAINTEXT NEVER LEAVES ───────────────────────────────────────────────
 *
 * The access token is spent inside `withGoogleAccessToken`'s callback and never returned. What
 * comes back out is a classified outcome, so there is no path by which this function could hand a
 * caller a token even by mistake.
 *
 * ── WHY THE REFRESH ORDERING IS NO LONGER IN THIS FILE (INT-4) ───────────────
 *
 * INT-3 kept the whole credential-and-refresh dance here, because verification was the only
 * authorized Google call in existence. INT-4 added a second — the Drive metadata read — and the
 * ordering is the single most dangerous thing to have two copies of: replace the access
 * credential, and replace the refresh credential ONLY IF GOOGLE RETURNED A NEW ONE. A tenant whose
 * refresh credential is overwritten with nothing has lost their only way back into their own
 * connection.
 *
 * So it moved to `google-authorized-call.server.ts` and BOTH callers run through it. This file
 * lost roughly a hundred lines and gained the bite-proof that guards them: the mutation which
 * overwrites a surviving refresh token now bites for this path too, which it never did while the
 * copy lived here.
 *
 * ── WHY THIS MODULE DOES NOT WRITE ───────────────────────────────────────────
 *
 * It returns an outcome. `integration-authority` owns the lifecycle and `integration-credentials`
 * owns the vault, and a verifier that could write either would be a third authority over both. A
 * firewall test walks this module's import graph to prove it mints no permit and executes nothing.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  coversRequiredScopes,
  type GoogleAccountIdentity,
  type GoogleFailureClass,
  type GoogleVerificationOutcome,
} from "./contracts";
import { fetchGoogleIdentity } from "./google-transport.server";
import {
  withGoogleAccessToken,
  type GoogleAuthorizedCallDeps,
} from "./google-authorized-call.server";

export type VerifyGoogleDeps = GoogleAuthorizedCallDeps;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Google verification is server-only.");
  }
}

/** How a verification failure maps onto the connection authority's two write classes. */
export function lifecycleClassFor(failure: GoogleFailureClass): "auth" | "degraded" | "unreachable" {
  if (failure === "auth" || failure === "scope" || failure === "identity") return "auth";
  if (failure === "transport") return "unreachable";
  /*
   * `malformed` — Google answered something unusable. `disabled` — the API is switched off in the
   * Cloud project. Both are PROVIDER problems, not grant problems, so neither may touch the
   * lifecycle: the tenant's authorization is entirely intact in both cases.
   */
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

  const outcome = await withGoogleAccessToken<GoogleAccountIdentity>(
    tenant,
    integrationId,
    async (accessToken) => {
      const identity = await fetchGoogleIdentity(accessToken, deps);
      if (!identity.ok) return identity;
      return { ok: true as const, value: identity.identity };
    },
    deps,
  );

  if (!outcome.ok) return outcome;

  /*
   * NO SCOPES ARE CLAIMED HERE. `userinfo` does not report a grant, and repeating the scopes Hebun
   * already stored would dress a stale record as a fresh observation. Scopes are observed where
   * Google actually states them: the token endpoint's `scope` field.
   */
  return { ok: true, identity: outcome.value, grantedScopes: [] };
}

/** Whether a granted scope set covers what INT-3 requires. Re-exported so callers share one rule. */
export { coversRequiredScopes };
