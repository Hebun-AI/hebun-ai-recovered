/*
 * /api/integrations/instagram/start — WHERE A TENANT BEGINS AUTHORIZING INSTAGRAM.
 *
 * ── WHAT THIS HANDLER REFUSES TO TAKE FROM THE REQUEST ───────────────────────
 *
 * EVERYTHING except the fact that it was called. No tenant id, no integration id, no redirect
 * target, no scopes, and — unlike Google's equivalent — not even a capability name. Google accepts
 * one because a tenant there may hold identity alone or identity plus Drive, so there is a real
 * choice to express. This provider has ONE capability and ONE scope: there is nothing to choose, so
 * there is no parameter, and that is a smaller attack surface rather than a missing feature.
 *
 * The tenant comes from the session. The redirect URI comes from configuration. The scopes come
 * from a frozen constant. A parameter this handler honoured would be a parameter an attacker could
 * set.
 *
 * ── IT IS AUTHENTICATED TWICE ────────────────────────────────────────────────
 *
 * `middleware.ts` already redirects a request with no session cookie to `/login`, and that check is
 * deliberately not trusted here: the middleware runs on the edge and never touches the database, so
 * a present-but-invalid cookie reaches this code. `resolveTenantContext()` is the authoritative
 * check, and it is what produces the tenant this flow is bound to.
 *
 * ── IT STARTS A CEREMONY AND NOTHING ELSE ────────────────────────────────────
 *
 * It mints no credential, grants no capability, writes no authorization and runs no observation. The
 * only row it may create is a `draft` connection, which claims nothing: a tenant who abandons the
 * consent screen is left with a record that says exactly that.
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
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_PROVIDER_LABEL,
} from "@/features/provider-instagram/contracts";
import { resolveInstagramOAuthEnvironment } from "@/features/provider-instagram/instagram-environment.server";
import { buildInstagramAuthorizationUrl } from "@/features/provider-instagram/instagram-oauth-transport.server";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  instagramStateCookieOptions,
  mintInstagramOAuthState,
} from "@/features/provider-instagram/instagram-oauth-state.server";

/** This handler reads cookies and a database. It can never be statically rendered. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One page owns every outcome, so a failure is a state a human can read rather than a raw error. */
function back(reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/integrations/instagram?outcome=${encodeURIComponent(reason)}`,
      process.env.INSTAGRAM_OAUTH_REDIRECT_URI ?? "http://localhost:3000",
    ),
  );
}

export async function GET(): Promise<NextResponse> {
  const config = resolveInstagramOAuthEnvironment();
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
   * REUSE THE TENANT'S EXISTING NON-TERMINAL INSTAGRAM CONNECTION, or create one. Minting a second
   * `draft` on every click would leave a trail of abandoned rows.
   */
  const listing = await listConnections(tenant, { getDb: () => db });
  const existing =
    listing.status === "read"
      ? listing.connections.find(
          (c) =>
            c.providerKey === INSTAGRAM_PROVIDER_KEY &&
            c.connectionState !== "disconnected" &&
            c.connectionState !== "revoked",
        )
      : undefined;

  let integrationId = existing?.integrationId;
  if (!integrationId) {
    const created = await createConnection(
      tenant,
      { providerKey: INSTAGRAM_PROVIDER_KEY, name: INSTAGRAM_PROVIDER_LABEL },
      { getDb: () => db },
    );
    if (created.status !== "created") return back(`connection-${created.reason}`);
    integrationId = created.connection.integrationId;
  }

  const minted = mintInstagramOAuthState(
    { tenantId: tenant.tenantId, sessionReference, integrationId },
    config.stateSecret,
  );

  /*
   * THE SCOPES ARE NOT ASSEMBLED HERE. The URL builder reads a frozen constant, so this handler
   * cannot widen the request even by accident, and the App secret is not part of what it builds.
   */
  const response = NextResponse.redirect(
    buildInstagramAuthorizationUrl(config, minted.stateParameter),
  );
  response.cookies.set(
    INSTAGRAM_OAUTH_STATE_COOKIE,
    minted.cookieValue,
    instagramStateCookieOptions(),
  );
  return response;
}
