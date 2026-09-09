/*
 * provider-instagram/instagram-access-token-call.server.ts — spend the connection's Instagram token
 * inside one callback frame, and never hold it.
 *
 * ── THE SAME NARROW OPENER, A DIFFERENT KIND ────────────────────────────────
 *
 * `withConnectionScopedSecret` takes a CONNECTION and a KIND and resolves the credential itself.
 * There is no credential parameter, so this module cannot ask for a credential — only for "the one
 * this connection holds for this purpose". YouTube passes `api_key`; Instagram passes
 * `oauth_access`. The seam is unchanged and gains nothing: no new credential kind, no new authority,
 * and `withDecryptedSecret` — which still requires the branded human context — is untouched.
 *
 * ── WHY `oauth_access` AND NOT A NEW KIND ───────────────────────────────────
 *
 * Instagram issues a long-lived ACCESS token. It has no separate, durable refresh credential the way
 * Google does: the access token is renewed by presenting itself, so there is nothing an
 * `oauth_refresh` row could hold. The released union already expresses what Instagram issues, and
 * inventing a fourth kind would describe a credential that does not exist.
 *
 * ── AND THE RENEWAL IS NOT SOLVED HERE ──────────────────────────────────────
 *
 * A long-lived Instagram token expires in about 60 days. This module does not renew it, does not
 * pretend to, and no lazy path elsewhere renews it either: Google's refresh works because a durable
 * refresh credential exists to spend, and Instagram has none. That is a REAL, RECORDED LIMITATION of
 * this phase — see the closure notes — and not something a comment here may quietly claim is handled.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { withConnectionScopedSecret } from "@/features/integration-credentials/credential-repository.server";
import type { InstagramResult } from "./contracts";

export interface AuthorizedInstagramRead {
  readonly tenantId: string;
  readonly integrationId: string;
}

export interface InstagramAccessTokenCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** Spend the live `oauth_access` credential of the authorized connection, inside one callback frame. */
export async function withAuthorizedInstagramToken<T>(
  authorized: AuthorizedInstagramRead,
  call: (accessToken: string) => Promise<InstagramResult<T>>,
  deps: InstagramAccessTokenCallDeps = {},
): Promise<InstagramResult<T>> {
  if (typeof window !== "undefined") {
    throw new Error("Instagram credential access is server-only.");
  }
  const used = await withConnectionScopedSecret(
    { tenantId: authorized.tenantId },
    authorized.integrationId,
    "oauth_access",
    call,
    { getDb: deps.getDb, env: deps.env },
  );
  if (used.status !== "used") {
    /*
     * A MISSING OR UNOPENABLE CREDENTIAL IS AN AUTH FAILURE, reported as this provider's own fact
     * rather than as a transport fault. Nothing was contacted, and the refusal says which half
     * failed without naming the credential.
     */
    return { ok: false, failure: "auth", reason: `credential-${used.reason}` };
  }
  return used.value;
}
