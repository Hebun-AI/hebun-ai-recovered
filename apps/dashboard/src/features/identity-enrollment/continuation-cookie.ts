/*
 * identity-enrollment/continuation-cookie.ts — the continuation receipt contract.
 *
 * ── WHY A COOKIE AT ALL ──────────────────────────────────────────────────────
 *
 * Act 1 mints the continuation reference and returns it ONCE; Act 3 requires it. Between them sits
 * Act 2, performed by a different human, in a different browser, at an unpredictable time. So the
 * bearer has to hold the reference across a wait they do not control.
 *
 * Every place it could be held is worse than this one:
 *
 *   shown to the human   it lands in a clipboard, a notes app, a chat window — a second permanent
 *                        copy of a bearer secret, on a device Hebun knows nothing about
 *   localStorage         readable by any script that reaches the page; survives indefinitely
 *   sessionStorage       same exposure, and dies on a tab close mid-ceremony
 *   URL / query          browser history, the `Referer` header, and every access log in the path
 *
 * An `httpOnly` cookie is the only option where the value is never exposed to page script, never
 * appears in a URL, and expires by itself.
 *
 * ── IT IS THE SAME SHAPE AS THE SESSION COOKIE, DELIBERATELY ─────────────────
 *
 * `session-cookie.ts` stores an opaque reference whose keyed digest is the durable record. This
 * stores an opaque reference whose keyed digest is the durable record — `identity_enrollment_requests
 * .continuation_hash`. No new secret, no new token format, no new authority: the value is exactly the
 * reference `startIdentityEnrollment` already mints, carried rather than re-invented.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It authorizes nothing. Holding it does not authenticate, does not identify, does not name a tenant
 * and does not admit anybody anywhere. It continues ONE enrollment ceremony that a Governance
 * authority must still approve, and Act 3 re-checks the invitation, the approval and the expiry
 * server-side regardless of what the cookie says.
 *
 * Isomorphic constants only — no `next/headers` here, so this module stays edge- and test-safe, for
 * the same reason `session-cookie.ts` avoids it.
 */

/**
 * Distinct from `SESSION_COOKIE_NAME` on purpose. A session reference resolves through
 * `resolveSessionFromReference` against a durable session row; a continuation reference resolves
 * against an enrollment row and authorizes nothing. Two meanings must never share one name, or a
 * bearer's receipt would be read on a path that expects a session.
 */
export const ENROLLMENT_CONTINUATION_COOKIE_NAME = "hebun_enrollment_continuation";

/**
 * How long the receipt survives. Twelve hours: long enough for a Governance authority to notice and
 * decide within an ordinary working day, short enough that a forgotten browser is not carrying a live
 * secret for the invitation's full 72 hours.
 *
 * A receipt that OUTLIVES its ceremony grants nothing — Act 3 re-reads the invitation and refuses a
 * lapsed one. A receipt that DIES BEFORE its ceremony is the real hazard, and it is recoverable:
 * `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'`, so
 * a Governance authority who rejects the stranded ceremony frees the invitation and the bearer may
 * start again with the same capability. That is why a short window is safe to choose.
 */
export const ENROLLMENT_CONTINUATION_TTL_SECONDS = 12 * 60 * 60;

export interface ContinuationCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  /** Narrower than the session cookie's `/`: the receipt is sent ONLY to the surface that uses it. */
  readonly path: typeof ENROLLMENT_CONTINUATION_COOKIE_PATH;
  readonly maxAge: number;
}

/**
 * The one route the receipt is scoped to. Every other path in the application — the dashboard, the
 * sign-in form, the workspace picker — never receives it, so no unrelated handler can read or log it
 * by accident.
 */
export const ENROLLMENT_CONTINUATION_COOKIE_PATH = "/login/join" as const;

/**
 * Cookie options for a continuation receipt. `secure` follows the deployment exactly as
 * `sessionCookieOptions` does, so the local http pilot keeps working without a second rule.
 */
export function continuationCookieOptions(
  maxAgeSeconds: number = ENROLLMENT_CONTINUATION_TTL_SECONDS,
  isProduction: boolean = process.env.NODE_ENV === "production",
): ContinuationCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: ENROLLMENT_CONTINUATION_COOKIE_PATH,
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

/**
 * THE CUSTODY DECISION, as a value so a test asserts the sentence rather than the vibe.
 *
 * Stated as a limitation, not a credential: the receipt narrows where the secret lives, it does not
 * make the ceremony safe against a capability that was stolen before Act 1 ever ran.
 */
export const CONTINUATION_CUSTODY = Object.freeze({
  heldBy: "an httpOnly cookie scoped to /login/join, set by the server at Act 1",
  neverIn: Object.freeze([
    "localStorage",
    "sessionStorage",
    "a URL or query parameter",
    "the page's JavaScript",
    "the audit log",
    "any server log",
  ]),
  shownToTheHuman: false as const,
  authorizes: "nothing — it continues one ceremony that Governance must still approve",
  ifLost:
    "a Governance authority rejects the stranded ceremony, which frees the invitation for a fresh " +
    "submission with the same capability",
  limitation:
    "the receipt binds the ceremony to ONE browser. A bearer who starts on one device and returns " +
    "on another must have the stranded ceremony rejected and start again.",
});
