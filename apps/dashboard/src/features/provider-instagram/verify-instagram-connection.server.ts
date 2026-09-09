/*
 * provider-instagram/verify-instagram-connection.server.ts — ONE real call that proves the token.
 *
 * Verification reads the connection's OWN account. A 200 with an id proves four things at once: the
 * token is accepted, it belongs to the account this connection claims, the grant covers
 * `instagram_business_basic`, and the account is a professional one — because this API answers for
 * no other kind.
 *
 * ── WHY THE PROBE IS THE ACCOUNT ITSELF ─────────────────────────────────────
 *
 * YouTube verifies against a public third-party channel, because its credential is an API key that
 * binds no account. Instagram's token IS the account's, so a third-party probe would prove the token
 * works and NOT that it works for this connection. The account is therefore both the probe and the
 * subject, and the id it returns is what binds them.
 *
 * It does not write, and it does not decide a lifecycle: it reports facts and a classified failure,
 * exactly as the released YouTube verifier does, and the caller records the outcome through the
 * lifecycle authority.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { VerifiedConnectionFacts } from "@/features/integration-authority/integration-repository.server";
import {
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_CONNECTION_LABEL,
  type InstagramFailure,
  type InstagramFailureClass,
} from "./contracts";
import {
  withAuthorizedInstagramToken,
  type InstagramAccessTokenCallDeps,
} from "./instagram-access-token-call.server";
import { readAccount } from "./instagram-transport.server";

export type VerifyInstagramDeps = InstagramAccessTokenCallDeps & {
  readonly fetchImpl?: import("@/features/provider-youtube/youtube-transport.server").FetchLike;
  readonly timeoutMs?: number;
};

export type InstagramVerificationOutcome =
  | { readonly ok: true; readonly facts: VerifiedConnectionFacts; readonly accountId: string }
  | InstagramFailure;

/**
 * How each failure reaches the connection lifecycle.
 *
 *   auth              the token is rejected — the grant is unusable: `expired`
 *   scope             the token is real, the grant does not cover the read — `expired`, because a
 *                     narrowed grant is a changed grant and reconnecting is what restores it
 *   not-professional  a permanent property of the ACCOUNT, not of the credential — `degraded`,
 *                     lifecycle untouched: reconnecting will not fix it, converting the account will
 *   not-found         the account this connection names is gone — `degraded`
 *   rate-limited      the token is fine, the window is spent — `degraded`, lifecycle untouched
 *   transport         nothing is known — `unreachable`, lifecycle untouched
 *   malformed         `degraded`
 */
export function lifecycleClassFor(
  failure: InstagramFailureClass,
): "auth" | "degraded" | "unreachable" {
  if (failure === "auth" || failure === "scope") return "auth";
  if (failure === "transport") return "unreachable";
  return "degraded";
}

/**
 * Verify one Instagram connection by reading the account it claims.
 *
 * `accountId` is the connection's own, supplied by the caller that owns the connection record — not
 * by a request parameter and not by a name a human typed.
 */
export async function verifyInstagramConnection(
  tenant: TenantContext,
  integrationId: string,
  accountId: string,
  deps: VerifyInstagramDeps = {},
): Promise<InstagramVerificationOutcome> {
  if (typeof window !== "undefined") {
    throw new Error("Instagram verification is server-only.");
  }
  const outcome = await withAuthorizedInstagramToken(
    { tenantId: tenant.tenantId, integrationId },
    (accessToken) => readAccount(accessToken, accountId, deps),
    deps,
  );
  if (!outcome.ok) return outcome;

  const account = outcome.value;
  return {
    ok: true,
    accountId: account.accountId,
    facts: {
      /*
       * THE PROVIDER'S OWN IMMUTABLE ID, never the username — a username is reassignable and this
       * field is what a connection is bound by.
       */
      externalAccountId: account.accountId,
      externalAccountLabel: account.username
        ? `@${account.username} · ${INSTAGRAM_CONNECTION_LABEL}`
        : INSTAGRAM_CONNECTION_LABEL,
      /*
       * WHAT THE READ PROVES WAS GRANTED, not what Hebun asked for. This call succeeding IS the
       * evidence that `instagram_business_basic` covers it; no wider scope is inferred, and none is
       * reported, because nothing here exercised one.
       */
      grantedScopes: Object.freeze([INSTAGRAM_BUSINESS_BASIC_SCOPE]),
    },
  };
}
