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
 * ── WHY THEY ARE EXACT PATHS AND NOT `/api` ─────────────────────────────────
 *
 * Exempting the prefix would unauthenticate the three OAuth handlers beside them, which rely on the
 * browser session this middleware proves. So each ingress is listed individually, in the EXACT
 * list, where no prefix semantics exist to be reinterpreted later — the same reasoning `/` is
 * written down for directly above.
 *
 * ── WHY THERE ARE NOW THREE, AND WHY THAT IS STILL A CLOSED LIST ────────────
 *
 * The delivery scan was a SECOND scheduler knocking on a SECOND door, and the standing issuance
 * scan is a THIRD. Each is written down here one entry at a time for the same reason the first was.
 * This list grows only by a diff a reviewer reads as a decision; the firewalls pin it BY VALUE, so
 * a fourth entry fails a test rather than arriving quietly. Each ingress carries its OWN bearer
 * secret — sharing one would make these doors a single credential.
 *
 * THE THIRD ENTRY WAS FOUND BY THE SMOKE TEST, NOT BY THE DIFF. Deployed without it, the standing
 * issuance route answered a scheduler with `307 -> /login`: the sign-in page this file's own comment
 * above calls "a scan that silently never happens". The route was correct, its secret check was
 * correct, and it was unreachable. An ingress is not shipped until it is listed here.
 *
 * THE FOURTH IS NOT A SCHEDULER. `/api/media-storage/acceptance` is an operator-triggered proof that
 * the deployed runtime reaches the VPS media store. Same rule: its own bearer secret, refused when
 * unset, listed here by value so its reachability is a reviewed decision.
 *
 * ── WHAT THIS EXEMPTS, AND WHAT IT DOES NOT ─────────────────────────────────
 *
 * It exempts these routes from the SESSION check only. They are not public: each verifies a bearer
 * secret in constant time before it reads anything, and an unset secret refuses every request. This
 * line moves the authentication, it does not remove it.
 */
const MACHINE_INGRESS_PATHS = [
  "/api/observation/scan",
  "/api/machine-delivery/scan",
  "/api/standing-issuance/scan",
  "/api/media-storage/acceptance",
];

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
