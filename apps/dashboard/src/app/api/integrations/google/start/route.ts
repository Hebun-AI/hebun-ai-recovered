/*
 * /api/integrations/google/start — WHERE A TENANT BEGINS AUTHORIZING GOOGLE.
 *
 * ── WHY A ROUTE HANDLER AND NOT A SERVER ACTION ──────────────────────────────
 *
 * This is the FIRST route handler in this repository, and it exists because OAuth is a browser
 * redirect protocol: the user must LEAVE Hebun for Google's consent screen and come back on a
 * plain GET. A server action cannot receive that return trip, so the pair has to be routes.
 *
 * ── WHAT THIS HANDLER REFUSES TO TAKE FROM THE REQUEST ───────────────────────
 *
 * Everything except the fact that it was called. NO tenant id, NO integration id, NO redirect
 * target, NO scopes. The tenant comes from the session; the redirect URI comes from configuration;
 * the scopes are constants. A parameter this handler honoured would be a parameter an attacker
 * could set.
 *
 * ── IT IS AUTHENTICATED TWICE ────────────────────────────────────────────────
 *
 * `middleware.ts` already redirects a request with no session cookie to `/login`, and that check
 * is deliberately not trusted here: the middleware runs on the edge and never touches the
 * database, so a present-but-invalid cookie reaches this code. `resolveTenantContext()` is the
 * authoritative check, and it is what produces the tenant this flow is bound to.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getControlPlaneDb } from "@/db/client.server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  createConnection,
  listConnections,
} from "@/features/integration-authority/integration-repository.server";
import {
  GOOGLE_AUTHORIZATION_ENDPOINT,
  GOOGLE_PROVIDER_KEY,
  GOOGLE_REQUESTED_SCOPES,
} from "@/features/provider-google/contracts";
import { resolveGoogleOAuthEnvironment } from "@/features/provider-google/google-environment.server";
import {
  GOOGLE_OAUTH_STATE_COOKIE,
  mintOAuthState,
  stateCookieOptions,
} from "@/features/provider-google/oauth-state.server";

/** This handler reads cookies and a database. It can never be statically rendered. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One page owns every outcome, so a failure is a state a human can read rather than a raw error. */
function back(reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/integrations/google?outcome=${encodeURIComponent(reason)}`,
      process.env.GOOGLE_OAUTH_REDIRECT_URI ?? "http://localhost:3000",
    ),
  );
}

export async function GET(): Promise<NextResponse> {
  const config = resolveGoogleOAuthEnvironment();
  /* FAIL CLOSED. An unconfigured deployment offers nothing rather than a broken consent screen. */
  if (config.status !== "configured") return back("not-configured");

  const tenant = await resolveTenantContext();
  if (!tenant) return back("not-authenticated");

  /*
   * The session reference binds the state to THIS session. It is read here and immediately
   * digested — the reference itself is never copied into the state cookie.
   */
  const store = await cookies();
  const sessionReference = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionReference) return back("not-authenticated");

  const db = getControlPlaneDb();

  /*
   * REUSE THE TENANT'S EXISTING NON-TERMINAL GOOGLE CONNECTION, or create one. Minting a second
   * `draft` on every click would leave a trail of abandoned rows, and the partial unique index
   * only constrains rows that have resolved an external account.
   */
  const listing = await listConnections(tenant, { getDb: () => db });
  const existing =
    listing.status === "read"
      ? listing.connections.find(
          (c) =>
            c.providerKey === GOOGLE_PROVIDER_KEY &&
            c.connectionState !== "disconnected" &&
            c.connectionState !== "revoked",
        )
      : undefined;

  let integrationId = existing?.integrationId;
  if (!integrationId) {
    const created = await createConnection(
      tenant,
      { providerKey: GOOGLE_PROVIDER_KEY, name: "Google Workspace" },
      { getDb: () => db },
    );
    if (created.status !== "created") return back(`connection-${created.reason}`);
    integrationId = created.connection.integrationId;
  }

  const minted = mintOAuthState(
    { tenantId: tenant.tenantId, sessionReference, integrationId },
    config.stateSecret,
  );

  const authorize = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorize.searchParams.set("client_id", config.clientId);
  /* THE CONFIGURED VALUE, VERBATIM. Never built from a Host header — see the environment module. */
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", GOOGLE_REQUESTED_SCOPES.join(" "));
  authorize.searchParams.set("state", minted.stateParameter);
  /* PKCE, in addition to the client secret. Defence in depth against code interception. */
  authorize.searchParams.set("code_challenge", minted.codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  /* A refresh token is only issued offline, and only on a consent Google treats as the first. */
  authorize.searchParams.set("access_type", "offline");
  authorize.searchParams.set("prompt", "consent");
  authorize.searchParams.set("include_granted_scopes", "false");

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set(
    GOOGLE_OAUTH_STATE_COOKIE,
    minted.cookieValue,
    stateCookieOptions(config.redirectUri),
  );
  return response;
}
