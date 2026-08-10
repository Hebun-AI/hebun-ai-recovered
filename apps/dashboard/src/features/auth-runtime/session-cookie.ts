/*
 * Session cookie contract (isomorphic constants only — no next/headers here so
 * this module stays edge- and test-safe). The value stored is the opaque session
 * reference; the authoritative session record lives in the control plane.
 */

export const SESSION_COOKIE_NAME = "hebun_session_ref";

export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge: number;
}

/**
 * Cookie options for a session reference. `secure` follows the deployment: on in
 * production, off for local http development so the pilot proof works over
 * http://localhost.
 */
export function sessionCookieOptions(
  maxAgeSeconds: number,
  isProduction: boolean = process.env.NODE_ENV === "production",
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}
