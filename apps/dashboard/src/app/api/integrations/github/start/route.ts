/*
 * /api/integrations/github/start — WHERE A TENANT BEGINS INSTALLING HEBUN'S GITHUB APP.
 *
 * ── WHAT THIS HANDLER REFUSES TO TAKE FROM THE REQUEST ───────────────────────
 *
 * EVERYTHING except the fact that it was called. No tenant id, no integration id, no organization,
 * no repository list, no redirect target, no permissions. The tenant comes from the session; the
 * App slug and the setup URL come from configuration; the permissions are whatever the App is
 * registered with at GitHub and are re-read from GitHub's answer afterwards.
 *
 * Google's equivalent accepts one thing — a capability name resolved through a frozen map — because
 * an OAuth authorization request carries the scopes. A GitHub App installation does not: the
 * permission set is a property of the App registration, chosen once in the console, not per
 * request. So this handler accepts NOTHING, and that is a smaller attack surface rather than a
 * missing feature.
 *
 * ── IT IS AUTHENTICATED TWICE ────────────────────────────────────────────────
 *
 * `middleware.ts` already redirects a request with no session cookie to `/login`, and that check is
 * deliberately not trusted here: the middleware runs on the edge and never touches the database, so
 * a present-but-invalid cookie reaches this code. `resolveTenantContext()` is the authoritative
 * check, and it is what produces the tenant this flow is bound to.
 *
 * ── THE ROW EXISTS BEFORE THE INSTALLATION DOES ──────────────────────────────
 *
 * A `draft` connection is created here so the signed state can name it. `draft` claims nothing: it
 * is a connection RECORD, not a connection, and a tenant who abandons the GitHub screen is left
 * with a row that says exactly that.
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
import { GITHUB_PROVIDER_KEY } from "@/features/provider-github/contracts";
import { resolveGitHubAppEnvironment } from "@/features/provider-github/github-environment.server";
import {
  GITHUB_INSTALL_STATE_COOKIE,
  installStateCookieOptions,
  mintInstallState,
} from "@/features/provider-github/install-state.server";

/** This handler reads cookies and a database. It can never be statically rendered. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * One page owns every outcome, so a failure is a state a human can read rather than a raw error.
 *
 * The origin comes from the CONFIGURED setup URL when there is one. When configuration is missing
 * entirely there is no configured origin to use, and a localhost fallback is the only honest
 * option left — it is used solely to build a relative-looking redirect and never sent to GitHub.
 */
function back(reason: string, setupUrl: string | null): NextResponse {
  return NextResponse.redirect(
    new URL(
      `/integrations/github?outcome=${encodeURIComponent(reason)}`,
      setupUrl ?? "http://localhost:3000",
    ),
  );
}

export async function GET(): Promise<NextResponse> {
  const config = resolveGitHubAppEnvironment();
  /* FAIL CLOSED. An unconfigured deployment offers nothing rather than a broken GitHub screen. */
  if (config.status !== "configured") return back("not-configured", null);

  const tenant = await resolveTenantContext();
  if (!tenant) return back("not-authenticated", config.setupUrl);

  /*
   * The session reference binds the state to THIS session. It is read here and immediately
   * digested — the reference itself is never copied into the state cookie.
   */
  const store = await cookies();
  const sessionReference = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionReference) return back("not-authenticated", config.setupUrl);

  const db = getControlPlaneDb();

  /*
   * REUSE THE TENANT'S EXISTING NON-TERMINAL GITHUB CONNECTION, or create one. Minting a second
   * `draft` on every click would leave a trail of abandoned rows, and the partial unique index only
   * constrains rows that have resolved an external account.
   */
  const listing = await listConnections(tenant, { getDb: () => db });
  const existing =
    listing.status === "read"
      ? listing.connections.find(
          (c) =>
            c.providerKey === GITHUB_PROVIDER_KEY &&
            c.connectionState !== "disconnected" &&
            c.connectionState !== "revoked",
        )
      : undefined;

  let integrationId = existing?.integrationId;
  if (!integrationId) {
    const created = await createConnection(
      tenant,
      { providerKey: GITHUB_PROVIDER_KEY, name: "GitHub" },
      { getDb: () => db },
    );
    if (created.status !== "created") return back(`connection-${created.reason}`, config.setupUrl);
    integrationId = created.connection.integrationId;
  }

  const minted = mintInstallState(
    { tenantId: tenant.tenantId, sessionReference, integrationId },
    config.stateSecret,
  );

  /*
   * ── THE INSTALLATION URL ──────────────────────────────────────────────────
   *
   * `https://github.com/apps/<slug>/installations/new`, with `state`. GitHub's own sharing
   * documentation describes this: "To preserve a state, add it to the installation URL:
   * https://github.com/apps/<app name>/installations/new?state=AB12t".
   *
   * The slug comes from validated configuration and is bounded to lowercase alphanumerics and
   * hyphens, so nothing caller-supplied can shape this path. Only the nonce travels; the tenant,
   * the session digest and the integration id stay inside the signed cookie.
   *
   * WHICH ORGANIZATION AND WHICH REPOSITORIES ARE CHOSEN ON GITHUB'S SCREEN, by the human, and
   * Hebun deliberately does not preselect either. Naming a target here would be Hebun asking to be
   * installed somewhere the human had not chosen.
   */
  const install = new URL(`https://github.com/apps/${config.appSlug}/installations/new`);
  install.searchParams.set("state", minted.stateParameter);

  const response = NextResponse.redirect(install.toString());
  response.cookies.set(
    GITHUB_INSTALL_STATE_COOKIE,
    minted.cookieValue,
    installStateCookieOptions(config.setupUrl),
  );
  return response;
}
