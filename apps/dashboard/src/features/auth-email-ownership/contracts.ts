/*
 * auth-email-ownership/contracts.ts — the vocabulary of proving that a human reads mail at an address.
 *
 * ── WHAT THIS CAPABILITY IS ─────────────────────────────────────────────────
 *
 * One identity, one address, one single-use link. The human asks for a link while signed in, the
 * link is mailed to the identity's own address, and the human presents it back while signed in as
 * the SAME identity. Only then is `auth_identities.email_ownership_verified_at` written.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 *   - not a sign-in method: a link never creates or resumes a session
 *   - not password recovery (M2, separately authorized)
 *   - not an access gate: no existing sign-in, session, membership or Governance authority depends
 *     on it; only FUTURE genesis acceptance requires it
 *   - not a tenant-governed external send: it uses no permit, no recipient authority, no arming
 *
 * Pure types and frozen values. No I/O.
 */

export const EMAIL_VERIFICATION_PURPOSE = "email-verification" as const;

/** A link lives for one day. The database CHECK caps the same window independently. */
export const EMAIL_VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
/** Minimum spacing between two links for one identity. */
export const EMAIL_VERIFICATION_COOLDOWN_SECONDS = 60;
/** Links one identity may request in any rolling 24 hours, whatever happened to them. */
export const EMAIL_VERIFICATION_DAILY_LIMIT = 5;
/**
 * Links the whole deployment may issue in any rolling hour — a cost and abuse breaker, not a
 * per-human rule. ponytail: counted without a global lock, so a burst of concurrent issues can
 * overshoot by the concurrency; a per-hour counter row is the upgrade if that ever matters.
 */
export const AUTH_MAIL_GLOBAL_HOURLY_LIMIT = 200;

/** A raw link token: 32 random bytes, base64url, no padding. Anything else is not a token. */
export const EMAIL_VERIFICATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The fragment key the link carries. A fragment never reaches a server, a log or a Referer. */
export const EMAIL_VERIFICATION_FRAGMENT_KEY = "token" as const;

/** What the mail provider said. ACCEPTED is not DELIVERED — Hebun has no delivery-status seam. */
export type AuthMailDeliveryOutcome = "accepted" | "rejected" | "unreachable" | "ambiguous";

export type EmailVerificationIssueRefusal =
  /** The address is already proven. Nothing to send. */
  | "already-verified"
  /** A link was requested less than a minute ago. */
  | "cooldown"
  /** This identity reached its daily allowance. */
  | "daily-limit"
  /** The deployment-wide breaker is open. */
  | "global-limit"
  /** Hebun cannot send authentication mail in this deployment. Nothing was written. */
  | "delivery-unavailable"
  /** The identity is missing, suspended, revoked or archived. */
  | "identity-unavailable"
  /** No signed-in session, or authentication is not configured. */
  | "unauthenticated"
  | "persistence-unavailable";

export type EmailVerificationIssueResult =
  | { readonly status: "issued"; readonly delivery: AuthMailDeliveryOutcome }
  | { readonly status: "refused"; readonly reason: EmailVerificationIssueRefusal };

export type EmailVerificationConfirmRefusal =
  /** No signed-in session at all. */
  | "unauthenticated"
  /** Signed in, but no workspace has been chosen yet, so there is no authorized session. */
  | "workspace-not-selected"
  /**
   * The link is not usable: malformed, unknown, expired, already used, replaced by a newer link, or
   * issued for an address the identity no longer has. One answer, because the human's next step is
   * the same in every case — request a new link.
   */
  | "invalid-link"
  /** The link belongs to a different identity than the one signed in. */
  | "different-account"
  | "already-verified"
  | "identity-unavailable"
  | "persistence-unavailable";

export type EmailVerificationConfirmResult =
  | { readonly status: "verified" }
  | { readonly status: "refused"; readonly reason: EmailVerificationConfirmRefusal };

/** The most recent link, as the person who asked for it may see it. Never the token. */
export interface LatestEmailVerificationLink {
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** Null while the send is in flight, or if the process ended before recording it. */
  readonly delivery: AuthMailDeliveryOutcome | null;
}

export type EmailOwnershipState =
  | { readonly status: "verified"; readonly verifiedAt: string }
  | {
      readonly status: "unverified";
      /** The open, unexpired link, if any. */
      readonly latest: LatestEmailVerificationLink | null;
      /** False when this deployment cannot send authentication mail. */
      readonly deliveryAvailable: boolean;
    }
  | { readonly status: "unavailable" };
