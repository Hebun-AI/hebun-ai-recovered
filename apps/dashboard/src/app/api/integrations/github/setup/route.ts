/*
 * /api/integrations/github/setup — WHERE A GITHUB INSTALLATION BECOMES A CONNECTION.
 *
 * ── THIS IS THE URL GITHUB REDIRECTS TO, AND ANYONE CAN CALL IT ──────────────
 *
 * GitHub's Setup URL documentation says so in its own words:
 *
 *   "Bad actors can hit this URL with a spoofed `installation_id`. Therefore, you should not rely
 *    on the validity of the `installation_id` parameter."
 *
 * So this handler treats every part of the request as hostile and establishes, in order:
 *
 *   1. Is this OUR tenant's flow?      signed, session-bound, single-use state
 *   2. Is that a plausible id?         a bounded positive integer, nothing else
 *   3. What does it actually name?     a JWT-authenticated read of GitHub's own record
 *
 * Steps 1 and 2 are cheap and prove nothing about the installation. Step 3 is the only source of
 * truth, and every fact persisted afterwards comes from ITS response rather than from this URL.
 *
 * ── THE COOKIE IS CLEARED BEFORE THE VERIFICATION, NOT AFTER ─────────────────
 *
 * Single-use has to mean single-use even when the attempt fails. Clearing on success only would
 * leave a valid state cookie alive after a refused attempt, and an intercepted URL would be worth
 * as many tries as the attacker wanted rather than one.
 *
 * ── WHAT IS NEVER REPORTED BACK ──────────────────────────────────────────────
 *
 * Which state check failed. All seven refusals collapse into one `invalid-request`, because
 * telling an attacker whether the signature, the nonce, the session or the tenant was wrong is a
 * free oracle. A tenant who genuinely hit an expired state simply starts again.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { connectGitHubInstallation } from "@/features/provider-github/connect-installation.server";
import { resolveGitHubAppEnvironment } from "@/features/provider-github/github-environment.server";
import {
  GITHUB_INSTALL_STATE_COOKIE,
  installStateCookieOptions,
  verifyInstallState,
} from "@/features/provider-github/install-state.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GitHub installation ids are positive integers. The parameter is parsed STRICTLY — `Number()`
 * would accept `" 12 "`, `"0x1f"`, `"1e3"` and `""`, and each of those would then be interpolated
 * into an API path. A digit-only string of bounded length, converted, and range-checked.
 */
function parseInstallationId(raw: string | null): number | null {
  if (!raw || !/^[1-9][0-9]{0,17}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = resolveGitHubAppEnvironment();
  if (config.status !== "configured") {
    return NextResponse.redirect(
      new URL("/integrations/github?outcome=not-configured", "http://localhost:3000"),
    );
  }

  const done = (reason: string): NextResponse => {
    const response = NextResponse.redirect(
      new URL(`/integrations/github?outcome=${encodeURIComponent(reason)}`, config.setupUrl),
    );
    /* Clear the state cookie on EVERY path — see the header. */
    response.cookies.set(GITHUB_INSTALL_STATE_COOKIE, "", {
      ...installStateCookieOptions(config.setupUrl),
      maxAge: 0,
    });
    return response;
  };

  const tenant = await resolveTenantContext();
  if (!tenant) return done("not-authenticated");

  const store = await cookies();
  const sessionReference = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionReference) return done("not-authenticated");

  /* ── 1. IS THIS OUR TENANT'S FLOW? ────────────────────────────────────────── */
  const state = verifyInstallState(
    {
      cookieValue: store.get(GITHUB_INSTALL_STATE_COOKIE)?.value,
      stateParameter: request.nextUrl.searchParams.get("state") ?? undefined,
      sessionReference,
      tenantId: tenant.tenantId,
    },
    config.stateSecret,
  );
  /* One reason for all seven refusals. See the header. */
  if (!state.ok) return done("invalid-request");

  /* ── 2. IS THAT A PLAUSIBLE ID? It is still a claim after this passes. ────── */
  const installationId = parseInstallationId(request.nextUrl.searchParams.get("installation_id"));
  if (installationId === null) return done("invalid-request");

  /*
   * ── 3. WHAT DOES IT ACTUALLY NAME? ────────────────────────────────────────
   *
   * The integration id comes from the SIGNED STATE, never from the query string, so a caller
   * cannot point a verified installation at somebody else's connection row. The authority's own
   * tenant predicate is the second gate on the same question.
   */
  const outcome = await connectGitHubInstallation(
    tenant,
    state.payload.integrationId,
    installationId,
  );

  if (outcome.status === "connected") return done("connected");
  return done(outcome.reason);
}
