/*
 * /api/integrations/google/callback — WHERE A GOOGLE AUTHORIZATION BECOMES A CONNECTION.
 *
 * ── THIS IS THE MOST ATTACKABLE SURFACE HEBUN HAS ────────────────────────────
 *
 * It is a GET, reachable by anyone, carrying attacker-controllable parameters, and its job is to
 * bind an external account to a tenant. The classic attack is not subtle: an attacker completes
 * consent with THEIR Google account, keeps the resulting callback URL, and gets a logged-in victim
 * to visit it. Without state, the victim's tenant is now connected to the attacker's account, and
 * everything the tenant later syncs goes somewhere they never chose.
 *
 * So the order below is not stylistic. The state is verified BEFORE the code is exchanged, and the
 * cookie is destroyed BEFORE the exchange, so an intercepted URL is worth one attempt at most.
 *
 * ── EVERY REFUSAL LOOKS THE SAME FROM OUTSIDE ────────────────────────────────
 *
 * The `outcome` a browser receives is a coarse label. Which state check failed — signature, nonce,
 * session, tenant, expiry — is never disclosed, because that distinction is a free oracle for
 * someone probing the flow.
 *
 * ── NOTHING HERE IS LOGGED ───────────────────────────────────────────────────
 *
 * The authorization code, the tokens and the state cookie all pass through this function. There is
 * no `console` call in this file, and there is no error path that re-throws a provider response.
 *
 * ── AND A CREDENTIAL IS STILL NOT A CONNECTION ───────────────────────────────
 *
 * Only a real answer from Google for THIS token moves a row to `connected`. Since
 * GOOGLE-OAUTH-FIRST-BIND-RACE-1 that answer is obtained for the exact token before it is stored, and
 * the credential and the account it belongs to are committed together, or not at all
 * (`commitGoogleGrant`).
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getControlPlaneDb } from "@/db/client.server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { coversRequiredScopes } from "@/features/provider-google/contracts";
import { resolveGoogleOAuthEnvironment } from "@/features/provider-google/google-environment.server";
import { commitGoogleGrant } from "@/features/provider-google/bind-google-grant.server";
import { exchangeAuthorizationCode } from "@/features/provider-google/google-transport.server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/features/provider-google/oauth-state.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function outcome(reason: string): NextResponse {
  const response = NextResponse.redirect(
    new URL(
      `/integrations/google?outcome=${encodeURIComponent(reason)}`,
      process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3000",
    ),
  );
  /* SINGLE USE. The cookie is cleared on every exit path, success or failure. */
  response.cookies.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = resolveGoogleOAuthEnvironment();
  if (config.status !== "configured") return outcome("not-configured");

  const tenant = await resolveTenantContext();
  if (!tenant) return outcome("not-authenticated");

  const store = await cookies();
  const sessionReference = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionReference) return outcome("not-authenticated");

  const params = request.nextUrl.searchParams;

  /*
   * THE USER DECLINED, or Google refused. Handled before anything else so a denial is a calm
   * outcome rather than a state failure — and the state cookie still gets destroyed.
   */
  const googleError = params.get("error");
  if (googleError) return outcome(googleError === "access_denied" ? "declined" : "google-error");

  /* ── 1. STATE, BEFORE ANYTHING IS EXCHANGED ─────────────────────────────── */
  const verified = verifyOAuthState(
    {
      cookieValue: store.get(GOOGLE_OAUTH_STATE_COOKIE)?.value,
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

  /* ── 2. EXCHANGE ────────────────────────────────────────────────────────── */
  const exchanged = await exchangeAuthorizationCode(
    { code, codeVerifier: verified.payload.codeVerifier },
    config,
  );
  if (!exchanged.ok) return outcome(`exchange-${exchanged.failure}`);

  const grant = exchanged.grant;

  /*
   * ── 3. THE GRANT MUST COVER WHAT IDENTITY NEEDS ─────────────────────────
   *
   * Checked against what GOOGLE SAID it granted, not what Hebun asked for. A user can uncheck a
   * scope on the consent screen, and a connection built on a grant that cannot resolve an identity
   * would be a connection to nobody.
   */
  if (!coversRequiredScopes(grant.grantedScopes)) return outcome("insufficient-scope");

  /*
   * ── 4. ACCOUNT, CREDENTIAL AND BINDING — ONE COMMIT ─────────────────────
   *
   * GOOGLE-OAUTH-ACCOUNT-INTEGRITY-1 + GOOGLE-OAUTH-FIRST-BIND-RACE-1. Google is asked who this
   * token belongs to while it is only in memory; then, in ONE transaction with the connection row
   * locked, the current binding is compared by the connection authority's own rule, the credential
   * is stored through INT-2, and the account is bound `connected`. A different account, a refused
   * write or a refused binding commits nothing. A concurrent callback for the same connection waits
   * on the row and then sees the binding this one committed.
   */
  const bound = await commitGoogleGrant(
    tenant,
    integrationId,
    {
      accessToken: grant.accessToken,
      refreshToken: grant.refreshToken,
      expiresAt: grant.expiresAt,
      /* Google's own statement of the grant, from the token endpoint. */
      grantedScopes: grant.grantedScopes,
    },
    now,
    { getDb: () => db },
  );
  return outcome(bound);
}
