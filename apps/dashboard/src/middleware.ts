/*
 * Edge auth gate (cheap, non-authoritative).
 *
 * Only active when HEBUN_AUTH_ENABLED=true. It performs a fast fail-closed
 * redirect when no session cookie is present on a protected path. It deliberately
 * does NOT resolve the session against the database (edge runtime, no pg) — the
 * authoritative check is the server-side dashboard layout, which re-validates the
 * session and tenant on every render. A present-but-invalid cookie is caught
 * there, not here.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";

/*
 * The paths the edge gate lets through unauthenticated.
 *
 * `/login` is the sign-in flow. `/register` is the self-service signup flow — an anonymous visitor
 * must be able to reach it, by definition, and it is the ONE route this list gained for that. It
 * reads no tenant data and renders none: its page is a form, and its action creates a brand-new
 * human and a brand-new organization or refuses. `/privacy` and `/terms` are the public legal
 * notices — documents a signed-out reader, and Google's OAuth review, must be able to open.
 * `/contact` (PUB-1) is where the public site's one call to action leads; it holds an address and no
 * form, so nothing can be submitted through it.
 *
 * NONE of them is a dashboard route: no surface under `(dashboard)` appears here, so no product data
 * is reachable through this list. Adding `/register` widened anonymous reach by exactly one form and
 * changed nothing about what an unauthenticated request may READ.
 */
const PUBLIC_PREFIXES = ["/login", "/register", "/privacy", "/terms", "/contact"];

/*
 * The public paths matched EXACTLY, never as a prefix.
 *
 * ── WHY `/` CANNOT GO IN THE LIST ABOVE ──────────────────────────────────────
 *
 * `PUBLIC_PREFIXES` is consumed as `pathname === prefix || pathname.startsWith(`${prefix}/`)`. For
 * `"/"` that second test is `startsWith("//")`, which is false for every ordinary path — so today
 * adding `"/"` there would happen to work. It would work by ACCIDENT. Any future rewrite of that
 * predicate to the obvious `pathname.startsWith(prefix)` would turn one list entry into a
 * blanket exemption for the entire application, and the diff that did it would look like a
 * simplification.
 *
 * So the public homepage is matched by equality, in its own list, where no prefix semantics exist
 * to be reinterpreted. This list is for paths with no children.
 */
/*
 * THE MACHINE INGRESS, MATCHED EXACTLY (TRH-25).
 *
 * ── WHY IT IS HERE AT ALL ────────────────────────────────────────────────────
 *
 * The matcher below covers `/api/...`, so a scheduler's request — which carries no session cookie,
 * because no human is present — would be REDIRECTED TO `/login` and the route would never run. A
 * sign-in page returned to a cron is not a security property; it is a scan that silently never
 * happens.
 *
 * ── WHY IT IS ONE EXACT PATH AND NOT `/api` ─────────────────────────────────
 *
 * Exempting the prefix would unauthenticate the three OAuth handlers beside it, which rely on the
 * browser session this middleware proves. So exactly one path is listed, in the EXACT list, where
 * no prefix semantics exist to be reinterpreted later — the same reasoning `/` is written down for
 * directly above.
 *
 * ── WHAT THIS EXEMPTS, AND WHAT IT DOES NOT ─────────────────────────────────
 *
 * It exempts the route from the SESSION check only. The route is not public: it verifies a bearer
 * secret in constant time before it reads anything, and an unset secret refuses every request. This
 * line moves the authentication, it does not remove it.
 */
const MACHINE_INGRESS_PATHS = ["/api/observation/scan"];

const PUBLIC_EXACT_PATHS = ["/"];

export function middleware(request: NextRequest): NextResponse {
  if (process.env.HEBUN_AUTH_ENABLED !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (PUBLIC_EXACT_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  /*
   * THE MACHINE INGRESS IS CHECKED SEPARATELY, AND THAT SEPARATION IS THE POINT.
   *
   * The obvious move was to append it to `PUBLIC_EXACT_PATHS`. It would have worked and it would
   * have been wrong: PUB-1 closed that list at the public homepage and asserts it, because that
   * list means "a signed-out HUMAN may read this". A bearer-authenticated machine endpoint means
   * something else entirely, and a future reader deciding what may join a list reasons from what is
   * already in it. Two meanings, two lists, and PUB-1's invariant survives untouched.
   */
  if (MACHINE_INGRESS_PATHS.includes(pathname)) {
    return NextResponse.next();
  }
  if (
    PUBLIC_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static asset files.
  matcher: ["/((?!_next/|favicon.ico|.*\\.[^/]+$).*)"],
};
