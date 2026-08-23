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
 * Storing succeeds, the row goes to `unverified`, and only a real answer from Google — obtained
 * afterwards, over the network, with that stored credential — moves it to `connected`.
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
import { storeCredential, replaceCredential, listCredentialMetadata } from "@/features/integration-credentials/credential-repository.server";
import { coversRequiredScopes } from "@/features/provider-google/contracts";
import { resolveGoogleOAuthEnvironment } from "@/features/provider-google/google-environment.server";
import { exchangeAuthorizationCode } from "@/features/provider-google/google-transport.server";
import {
  lifecycleClassFor,
  verifyGoogleConnection,
} from "@/features/provider-google/verify-google-connection.server";
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

  /* ── 4. STORE THROUGH INT-2. This moves the connection to `unverified`. ─── */
  const existing = await listCredentialMetadata(tenant, integrationId, { getDb: () => db });
  const live = existing.status === "read" ? existing.credentials.filter((c) => c.live) : [];

  const hasAccess = live.some((c) => c.kind === "oauth_access");
  const storedAccess = hasAccess
    ? await replaceCredential(
        tenant,
        {
          integrationId,
          kind: "oauth_access",
          plaintext: grant.accessToken,
          expiresAt: grant.expiresAt,
        },
        { getDb: () => db },
      )
    : await storeCredential(
        tenant,
        {
          integrationId,
          kind: "oauth_access",
          plaintext: grant.accessToken,
          expiresAt: grant.expiresAt,
        },
        { getDb: () => db },
      );
  if (storedAccess.status === "refused") return outcome(`credential-${storedAccess.reason}`);

  /*
   * A REFRESH TOKEN IS ONLY STORED IF GOOGLE SENT ONE. Google omits it on re-authorization, and
   * treating that absence as "replace what we have with nothing" would destroy the tenant's only
   * way back without another consent.
   */
  if (grant.refreshToken) {
    const hasRefresh = live.some((c) => c.kind === "oauth_refresh");
    const storedRefresh = hasRefresh
      ? await replaceCredential(
          tenant,
          { integrationId, kind: "oauth_refresh", plaintext: grant.refreshToken },
          { getDb: () => db },
        )
      : await storeCredential(
          tenant,
          { integrationId, kind: "oauth_refresh", plaintext: grant.refreshToken },
          { getDb: () => db },
        );
    if (storedRefresh.status === "refused") return outcome(`credential-${storedRefresh.reason}`);
  }

  /* ── 5. VERIFY. REAL NETWORK I/O, WITH THE CREDENTIAL JUST STORED. ──────── */
  const verification = await verifyGoogleConnection(tenant, integrationId, { getDb: () => db });

  if (!verification.ok) {
    /*
     * The lifecycle moves according to the CLASS of failure. A 5xx or a timeout touches health
     * only — a provider having a bad minute must never end a grant a tenant legitimately holds.
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

  /* ── 6. AND ONLY NOW, `connected`. ──────────────────────────────────────── */
  const recorded = await db.transaction(async (tx) =>
    recordVerifiedConnectionWithin(
      tx,
      tenant,
      integrationId,
      {
        externalAccountId: verification.identity.subject,
        externalAccountLabel: verification.identity.email,
        /* Google's own statement of the grant, from the token endpoint. */
        grantedScopes: grant.grantedScopes,
      },
      now,
    ),
  );
  if (recorded.status !== "verified") return outcome(`record-${recorded.reason}`);

  return outcome("connected");
}
