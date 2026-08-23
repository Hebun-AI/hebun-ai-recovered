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
 * `/login` is the sign-in flow. `/privacy` and `/terms` are the public legal notices — documents
 * a signed-out reader, and Google's OAuth review, must be able to open. None of them is a
 * dashboard route: no surface under `(dashboard)` appears here, so no product data is reachable
 * through this list.
 */
const PUBLIC_PREFIXES = ["/login", "/privacy", "/terms"];

export function middleware(request: NextRequest): NextResponse {
  if (process.env.HEBUN_AUTH_ENABLED !== "true") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
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
