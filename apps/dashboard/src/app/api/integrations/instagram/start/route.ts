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

/**
 * The one query parameter this route reads, and why reading it is safe.
 *
 * `?switch=1` asks Meta to re-authenticate rather than silently reuse the Instagram account the
 * browser is already signed in to. It is the ONLY thing a caller may influence here: the tenant
 * comes from the session, the integration is derived from that tenant's own connections, the scopes
 * come from a frozen constant, and the redirect URI comes from configuration.
 *
 * A forged value can therefore only ask for MORE authentication, never less and never wider. There
 * is no value of this parameter that reaches another tenant, another integration or another scope.
 */
const SWITCH_ACCOUNT_PARAM = "switch" as const;

export async function GET(request: Request): Promise<NextResponse> {
  const switchAccount =
    new URL(request.url).searchParams.get(SWITCH_ACCOUNT_PARAM) === "1";
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
   * ── WHICH ROW THIS AUTHORIZATION IS FOR ─────────────────────────────────
   *
   * A RECONNECT reuses the tenant's existing non-terminal Instagram connection. A SWITCH does not:
   * a different account is a new connection, which is what the integration authority has always
   * said, and reusing the row is exactly the defect that produced `record-account-changed` in
   * production. The active connection must stay usable until the replacement is proven.
   */
  const listing = await listConnections(tenant, { getDb: () => db });
  const instagram =
    listing.status === "read"
      ? listing.connections.filter(
          (c) =>
            c.providerKey === INSTAGRAM_PROVIDER_KEY &&
            c.connectionState !== "disconnected" &&
            c.connectionState !== "revoked",
        )
      : [];

  /*
   * An "active" connection is one already bound to a provider account. A row that has never been
   * verified names no account, so replacing it would retire nothing — it is a candidate, not an
   * incumbent, and the reuse branch below is the right home for it.
   */
  const active = instagram.find((c) => c.externalAccountId !== null);
  const replacing = switchAccount && active !== undefined;

  let integrationId: string | undefined;
  let supersedesIntegrationId: string | undefined;

  if (replacing) {
    /*
     * REUSE AN ABANDONED CANDIDATE BEFORE MINTING ANOTHER. A human who starts a switch, sees Meta's
     * account picker and closes the tab leaves an accountless `draft` behind; minting a fresh row
     * per click would accumulate them. Any accountless non-terminal row is that same candidate.
     */
    const candidate = instagram.find((c) => c.externalAccountId === null);
    if (candidate) {
      integrationId = candidate.integrationId;
    } else {
      const created = await createConnection(
        tenant,
        { providerKey: INSTAGRAM_PROVIDER_KEY, name: INSTAGRAM_PROVIDER_LABEL },
        { getDb: () => db },
      );
      if (created.status !== "created") return back(`connection-${created.reason}`);
      integrationId = created.connection.integrationId;
    }
    supersedesIntegrationId = active.integrationId;
  } else {
    integrationId = instagram[0]?.integrationId;
    if (!integrationId) {
      const created = await createConnection(
        tenant,
        { providerKey: INSTAGRAM_PROVIDER_KEY, name: INSTAGRAM_PROVIDER_LABEL },
        { getDb: () => db },
      );
      if (created.status !== "created") return back(`connection-${created.reason}`);
      integrationId = created.connection.integrationId;
    }
  }

  /*
   * THE SWITCH INTENT AND THE ROW IT REPLACES TRAVEL INSIDE THE SIGNATURE, NOT THE QUERY STRING.
   *
   * Meta is asked to re-authenticate via `force_reauth` below, but that only changes what the HUMAN
   * sees. The CALLBACK also has to know that this authorization is a replacement, and WHICH
   * connection it replaces, because it is the callback that retires the old one once the new one is
   * proven. A browser can append anything to a callback URL; nothing it appends is inside this HMAC.
   */
  const minted = mintInstagramOAuthState(
    {
      tenantId: tenant.tenantId,
      sessionReference,
      integrationId,
      accountSwitch: switchAccount,
      ...(supersedesIntegrationId ? { supersedesIntegrationId } : {}),
    },
    config.stateSecret,
  );

  /*
   * THE SCOPES ARE NOT ASSEMBLED HERE. The URL builder reads a frozen constant, so this handler
   * cannot widen the request even by accident, and the App secret is not part of what it builds.
   */
  const response = NextResponse.redirect(
    buildInstagramAuthorizationUrl(config, minted.stateParameter, {
      forceReauth: switchAccount,
    }),
  );
  response.cookies.set(
    INSTAGRAM_OAUTH_STATE_COOKIE,
    minted.cookieValue,
    instagramStateCookieOptions(),
  );
  return response;
}
