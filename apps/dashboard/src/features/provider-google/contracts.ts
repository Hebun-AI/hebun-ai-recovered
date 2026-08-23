/*
 * provider-google/contracts.ts — the typed vocabulary of "this tenant connected a Google account".
 *
 * THE QUESTIONS INT-3 ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   Did a human in this tenant authorize Hebun at Google, does Google still accept the
 *              credential, which Google account is it, and which scopes did Google actually grant?
 *   REFUSED    May Hebun read Drive? (No Drive scope is requested. None was granted.)
 *   REFUSED    May Hebun read Calendar? (Same.)
 *   REFUSED    Which Workspace customer is this? (Admin SDK scope — not requested, not faked.)
 *   REFUSED    May Hebun write anything at Google? (No write scope exists in this phase.)
 *
 * ── THE SCOPES, AND WHY EXACTLY THESE ─────────────────────────────────────────
 *
 * `openid email profile` and nothing else. A scope requested for a phase that cannot use it is a
 * permission a tenant granted for nothing, and the consent screen would say Hebun wants access it
 * does not have code to exercise.
 *
 * GOOGLE RETURNS THE LONG FORM. A request for `email` comes back in the token response as
 * `https://www.googleapis.com/auth/userinfo.email`, so the REQUIRED set below is written in the
 * form Google actually grants — comparing against what we asked for rather than what it returned
 * would pass while proving nothing.
 *
 * Pure types and frozen values. No I/O, no secrets, no database.
 */

/** The catalog key. One provider in INT-3, and it is the only real one in the repository. */
export const GOOGLE_PROVIDER_KEY = "google-workspace" as const;

/** What is sent to Google in the authorization request. */
export const GOOGLE_REQUESTED_SCOPES: readonly string[] = Object.freeze([
  "openid",
  "email",
  "profile",
]);

/**
 * What must come BACK, in Google's own spelling. A grant missing any of these cannot establish an
 * identity, so it cannot establish a connection.
 */
export const GOOGLE_REQUIRED_GRANTED_SCOPES: readonly string[] = Object.freeze([
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
]);

/** Google's endpoints. Constants, so no caller can point the transport somewhere else. */
export const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

/**
 * What a successful token exchange yields.
 *
 * `refreshToken` is OPTIONAL AND THAT IS NOT A DEFECT. Google returns one on first consent and
 * frequently omits it on re-authorization; a caller that treated the absence as "replace the
 * refresh credential with nothing" would destroy the only one the tenant has.
 */
export interface GoogleTokenGrant {
  readonly accessToken: string;
  readonly refreshToken: string | null;
  readonly expiresAt: Date | null;
  /** Google's own statement of what was granted. Never what was requested. */
  readonly grantedScopes: readonly string[];
  /** Present when `openid` was granted. Carries `sub`, `email`, and sometimes `hd`. */
  readonly idToken: string | null;
}

/**
 * The Google account a credential belongs to.
 *
 * `sub` IS THE IDENTITY. It is immutable and never reassigned. `email` is a LABEL: a Workspace
 * administrator can change it, and a freed address can later belong to someone else, so a
 * connection bound to an email would silently follow the address rather than the account.
 *
 * `hostedDomain` is the `hd` claim — a DOMAIN OBSERVATION, present only for accounts inside a
 * Google Workspace domain and absent for consumer accounts. It is NOT a Workspace customer id, it
 * is not admin-verified, and nothing in this phase treats it as one.
 */
export interface GoogleAccountIdentity {
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly hostedDomain: string | null;
}

/**
 * Why a Google call did not succeed — CLASSIFIED, because the classes mean different things to a
 * connection's lifecycle and confusing them is how a provider outage becomes a false revocation.
 *
 *   auth        Google definitively refused the credential (401, `invalid_grant`). The grant Hebun
 *               holds can no longer be used and cannot be restored from what Hebun has.
 *   scope       Google accepted the credential and the grant does not cover what is needed.
 *   identity    Google answered without a usable `sub`. Nothing can be bound to that.
 *   transport   5xx, 429, timeout, DNS, TLS. NOTHING IS KNOWN about the grant — it may be perfect.
 *   malformed   Google's response could not be parsed as the documented shape.
 */
export type GoogleFailureClass = "auth" | "scope" | "identity" | "transport" | "malformed";

export interface GoogleFailure {
  readonly ok: false;
  readonly failure: GoogleFailureClass;
  /**
   * A short, SAFE reason. Never a provider response body, never a token, never a code — a Google
   * error payload can echo request parameters, and this string reaches logs and screens.
   */
  readonly reason: string;
}

export type GoogleTokenResult = { readonly ok: true; readonly grant: GoogleTokenGrant } | GoogleFailure;
export type GoogleIdentityResult =
  | { readonly ok: true; readonly identity: GoogleAccountIdentity }
  | GoogleFailure;

/**
 * The outcome of verifying a stored credential against Google.
 *
 * `connected` is the ONLY arm that may move a connection to `connected`, and it can only be built
 * from a real Google response carrying a real `sub` and a covering scope grant.
 */
export type GoogleVerificationOutcome =
  | {
      readonly ok: true;
      readonly identity: GoogleAccountIdentity;
      readonly grantedScopes: readonly string[];
    }
  | GoogleFailure;

/** Normalize Google's space-delimited scope string. */
export function parseScopes(raw: string | null | undefined): readonly string[] {
  if (!raw) return Object.freeze([]);
  return Object.freeze(raw.split(/\s+/).filter((s) => s.length > 0));
}

/** Every required scope is in the granted set. Compared in GOOGLE'S spelling — see the header. */
export function coversRequiredScopes(granted: readonly string[]): boolean {
  return GOOGLE_REQUIRED_GRANTED_SCOPES.every((required) => granted.includes(required));
}
