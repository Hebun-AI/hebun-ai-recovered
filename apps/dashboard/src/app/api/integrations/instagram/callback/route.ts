/*
 * /api/integrations/instagram/callback — WHERE AN INSTAGRAM AUTHORIZATION BECOMES A CONNECTION.
 *
 * ── THIS IS AN ATTACKABLE SURFACE, AND IT IS ORDERED ACCORDINGLY ─────────────
 *
 * A GET, reachable by anyone, carrying attacker-controllable parameters, whose job is to bind an
 * external account to a tenant. The classic attack is not subtle: an attacker completes consent with
 * THEIR Instagram account, keeps the callback URL, and gets a logged-in victim to visit it. Without
 * state, the victim's tenant is now bound to the attacker's account and every later observation
 * describes somebody else.
 *
 * So the order is not stylistic. The state is verified BEFORE the code is exchanged, and the cookie
 * is destroyed on every exit, so an intercepted URL is worth one attempt at most.
 *
 * ── EVERY REFUSAL LOOKS THE SAME FROM OUTSIDE ────────────────────────────────
 *
 * Which state check failed — signature, nonce, session, tenant, expiry — is never disclosed. That
 * distinction is a free oracle for somebody probing the flow.
 *
 * ── NOTHING HERE IS LOGGED ───────────────────────────────────────────────────
 *
 * The authorization code, both tokens and the state cookie all pass through this function. There is
 * no `console` call in this file and no path that re-throws a provider response.
 *
 * ── WHAT THIS ROUTE IS NOT ALLOWED TO BECOME ─────────────────────────────────
 *
 * A completed OAuth ceremony is a CONNECTION and nothing more. It is not a Governance decision, not
 * a standing observation authorization, and not an observation. This file therefore imports no
 * governance authority, no standing-authorization writer and no observation runtime, and a firewall
 * test asserts that it never does. A tenant who connects Instagram has authorized Hebun to hold a
 * credential — not to go and look.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getControlPlaneDb } from "@/db/client.server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  recordVerificationFailureWithin,
  recordVerifiedConnectionWithin,
} from "@/features/integration-authority/integration-repository.server";
import {
  listCredentialMetadata,
  replaceCredential,
  storeCredential,
} from "@/features/integration-credentials/credential-repository.server";
import { coversRequiredScopes } from "@/features/provider-instagram/contracts";
import { resolveInstagramOAuthEnvironment } from "@/features/provider-instagram/instagram-environment.server";
import {
  exchangeAuthorizationCode,
  exchangeForLongLivedToken,
} from "@/features/provider-instagram/instagram-oauth-transport.server";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  verifyInstagramOAuthState,
} from "@/features/provider-instagram/instagram-oauth-state.server";
import {
  lifecycleClassFor,
  verifyInstagramConnection,
} from "@/features/provider-instagram/verify-instagram-connection.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function outcome(reason: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(
      `/integrations/instagram?outcome=${encodeURIComponent(reason)}`,
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI ?? "http://localhost:3000",
    ),
  );
  /* SINGLE USE. The cookie is cleared on every exit path, success or failure. */
  response.cookies.delete(INSTAGRAM_OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = resolveInstagramOAuthEnvironment();
  if (config.status !== "configured") return outcome("not-configured");

  const tenant = await resolveTenantContext();
  if (!tenant) return outcome("not-authenticated");

  const store = await cookies();
  const sessionReference = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionReference) return outcome("not-authenticated");

  const params = request.nextUrl.searchParams;

  /*
   * THE USER DECLINED, or Meta refused. Handled before anything else so a denial is a calm outcome
   * rather than a state failure — and the state cookie still gets destroyed.
   */
  const providerError = params.get("error");
  if (providerError) {
    return outcome(providerError === "access_denied" ? "declined" : "instagram-error");
  }

  /* ── 1. STATE, BEFORE ANYTHING IS EXCHANGED ─────────────────────────────── */
  const verified = verifyInstagramOAuthState(
    {
      cookieValue: store.get(INSTAGRAM_OAUTH_STATE_COOKIE)?.value,
      stateParameter: params.get("state") ?? undefined,
      sessionReference,
      tenantId: tenant.tenantId,
    },
    config.stateSecret,
  );
  /* ONE label for every reason. Which check failed is never disclosed. */
  if (!verified.ok) return outcome("invalid-state");

  const code = params.get("code");
  if (!code) return outcome("missing-code");

  const db = getControlPlaneDb();
  const now = new Date();
  const integrationId = verified.payload.integrationId;

  /* ── 2. EXCHANGE THE CODE. Short-lived token, account id, stated permissions. ── */
  const exchanged = await exchangeAuthorizationCode({ code }, config);
  if (!exchanged.ok) return outcome(`exchange-${exchanged.failure}`);

  /*
   * The token response must still be well formed — Meta states an account id on it, and a response
   * without one is not a grant this ceremony understands. It is NOT used as an identity: see the
   * verifier call below.
   */
  if (!exchanged.grant.accountId) return outcome("exchange-malformed");

  /*
   * ── 3. IF INSTAGRAM STATED THE GRANT, IT MUST COVER THIS CONNECTION ─────
   *
   * Checked against what INSTAGRAM SAID it granted, not what Hebun asked for. A user can decline a
   * permission on the consent screen, and a connection built on a grant that cannot read the
   * account would be a connection to nobody. THIS REFUSAL IS UNCHANGED.
   *
   * WHEN INSTAGRAM STATED NOTHING, THIS ROUTE DECIDES NOTHING. `null` is not an empty grant and is
   * not refused here: a route inventing a scope verdict from an absent field would be a second
   * scope authority, and this repository has exactly one — the verifier below, which reads the
   * account for real and cannot succeed without `instagram_business_basic`. So an unstated grant
   * proceeds to that read and is settled there, and a connection still cannot become `connected`
   * without a real provider answer.
   *
   * A grant stated in a shape Hebun could not read never reaches this line — the transport refuses
   * it as malformed.
   */
  const statedScopes = exchanged.grant.grantedScopes;
  if (statedScopes !== null && !coversRequiredScopes(statedScopes)) {
    return outcome("insufficient-scope");
  }

  /*
   * ── 4. AND ONLY A LONG-LIVED TOKEN IS WORTH STORING ─────────────────────
   *
   * The short-lived token dies in about an hour. Storing it would produce a connection that reports
   * itself healthy and stops working before anyone looks again — a connection that lies. If this
   * exchange fails, NOTHING is stored and the tenant is told to try again; a grant Hebun cannot hold
   * durably is a grant Hebun declines to half-hold.
   */
  const longLived = await exchangeForLongLivedToken(exchanged.grant.accessToken, config);
  if (!longLived.ok) return outcome(`long-lived-${longLived.failure}`);

  /* ── 5. STORE THROUGH THE CREDENTIAL AUTHORITY. This moves the connection to `unverified`. ── */
  const existing = await listCredentialMetadata(tenant, integrationId, { getDb: () => db });
  const live = existing.status === "read" ? existing.credentials.filter((c) => c.live) : [];

  const input = {
    integrationId,
    kind: "oauth_access" as const,
    plaintext: longLived.grant.accessToken,
    /*
     * A REAL INSTANT FROM META'S OWN `expires_in`, not a constant. There is no `oauth_refresh` row
     * to write beside it: Instagram issues no separate refresh credential, so there is nothing an
     * `oauth_refresh` row could hold and no fourth credential kind to invent.
     */
    ...(longLived.grant.expiresAt ? { expiresAt: longLived.grant.expiresAt } : {}),
  };

  const stored = live.some((c) => c.kind === "oauth_access")
    ? await replaceCredential(tenant, input, { getDb: () => db })
    : await storeCredential(tenant, input, { getDb: () => db });
  if (stored.status === "refused") return outcome(`credential-${stored.reason}`);

  /* ── 6. VERIFY. REAL NETWORK I/O, WITH THE CREDENTIAL JUST STORED. ──────── */
  /*
   * NO ACCOUNT ID IS PASSED. Identity is the verifier's to establish from the provider's own answer
   * at `/me`; a route that supplied one would be a second identity authority, and the id it had to
   * hand — the token response's `user_id` — is precisely the value that addressed nothing.
   */
  const verification = await verifyInstagramConnection(tenant, integrationId, {
    getDb: () => db,
  });

  if (!verification.ok) {
    /*
     * The lifecycle moves according to the CLASS of failure, decided by the provider's own verifier.
     * A rate limit or a 5xx touches health only — Instagram having a bad minute must never end a
     * grant a tenant legitimately holds.
     */
    await db.transaction(async (tx) => {
      await recordVerificationFailureWithin(
        tx,
        tenant,
        integrationId,
        { kind: lifecycleClassFor(verification.failure), reason: verification.reason },
        now,
      );
    });
    return outcome(`verification-${verification.failure}`);
  }

  /* ── 7. AND ONLY NOW, `connected`. ──────────────────────────────────────── */
  const recorded = await db.transaction(async (tx) =>
    recordVerifiedConnectionWithin(tx, tenant, integrationId, verification.facts, now),
  );
  if (recorded.status !== "verified") return outcome(`record-${recorded.reason}`);

  /*
   * THE CEREMONY ENDS HERE. No standing observation authorization is written, no subject is
   * admitted, and no observation is run. Hebun now holds a credential for an account it has proved
   * it can read — which is a different, smaller claim than being authorized to read it on a
   * schedule, and that claim belongs to Governance.
   */
  return outcome("connected");
}
