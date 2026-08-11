import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE, isValidSession } from "@/lib/session";

/** /admin altındaki her şey oturum ister; giriş ekranı hariç. */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin/giris") return NextResponse.next();

  if (await isValidSession(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/admin/giris", request.url);
  loginUrl.searchParams.set("devam", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
