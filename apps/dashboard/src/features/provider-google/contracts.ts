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
/*
 * Drive metadata listing. `files.list` ONLY — there is deliberately no `alt=media` download
 * endpoint constant in this file, so a content read has no address to be written against.
 */
export const GOOGLE_DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

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
 *   disabled    The API itself is switched off in the Google Cloud project. NOTHING is wrong with
 *               the tenant's grant, the credential, or the scopes — a human must enable the API.
 *
 * ── WHY `disabled` IS ITS OWN CLASS (INT-4, FOUND DURING REAL ACCEPTANCE) ────
 *
 * Google answers `accessNotConfigured` as a 403 whose reason is neither `insufficientPermissions`
 * nor `insufficient_scope`, so it used to fall through to `auth` — "Google refused this
 * credential". That statement is FALSE twice over: the credential is perfect, and the tenant's
 * grant covers the call. Worse, `auth` is the one class a refresh is attempted for, so Hebun would
 * have spent a refresh token on a problem no token can fix, on every single call.
 *
 * It was found by pointing the released seam at real Google, not by review — the scope was granted
 * correctly and the Drive API was simply not enabled in the Cloud project.
 */
export type GoogleFailureClass =
  | "auth"
  | "scope"
  | "identity"
  | "transport"
  | "malformed"
  | "disabled";

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

/* ── Drive metadata capability (INT-4) ──────────────────────────────────────── */

/**
 * THE CAPABILITY KEY. One string, and the availability seam's whole vocabulary for Drive.
 *
 * It names METADATA READ and nothing else, because that is what the scope below permits and what
 * the seam below implements. A key like `google.drive.read` would be a promise the phase does not
 * keep the first time somebody asked it for a file's contents.
 */
export const GOOGLE_DRIVE_METADATA_CAPABILITY = "google.drive.metadata.read" as const;

/**
 * THE NARROWEST GOOGLE SCOPE THAT CAN DISCOVER FILES.
 *
 * `drive.metadata.readonly` accepts `files.list` and `files.get` — verified against Google's method
 * references, not assumed — and it CANNOT download content: `alt=media` requires `drive.readonly`
 * or wider. That asymmetry is the reason it was chosen over `drive.readonly`, which permits "view
 * and download all your Drive files".
 *
 * So "INT-4 reads no file content" is enforced by GOOGLE, not only by this repository. A mistake
 * in Hebun's own code cannot turn this grant into a content read.
 *
 * It is a RESTRICTED scope. A test user may grant it while the OAuth app is in Testing status; a
 * production deployment requires Google verification and a CASA security assessment. That is
 * recorded as release debt, not worked around.
 */
export const GOOGLE_DRIVE_METADATA_SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";

/**
 * THE DRIVE CONTENT-READ CAPABILITY (KID-1).
 *
 * It is a SECOND capability, not a widening of the first, and the two are never merged. A tenant
 * may have granted the metadata scope and not this one; the availability seam answers each
 * independently, so `google.drive.metadata.read` keeps meaning exactly what INT-4 made it mean.
 *
 *     METADATA READ != CONTENT READ        DISCOVERY != DOWNLOAD
 */
export const GOOGLE_DRIVE_CONTENT_CAPABILITY = "google.drive.content.read" as const;

/**
 * THE SCOPE THIS CAPABILITY REQUESTS, AND THE ONE HEBUN DELIBERATELY COULD NOT USE.
 *
 * Verified against Google's current method references rather than assumed:
 *
 *   `files.get?alt=media` and `files.export` both accept `drive`, `drive.file`,
 *   `drive.meet.readonly` and `drive.readonly`. `drive.metadata.readonly` accepts `files.get` for
 *   METADATA only — INT-4's grant cannot download, which is why this capability exists at all.
 *
 * `drive.file` IS THE NARROWER SCOPE AND IT IS NOT USABLE HERE YET. Google classifies it as
 * NON-SENSITIVE precisely because it grants per-file access only to files the user hands the app
 * through the Google Picker or the app's own picker. Hebun has no Picker: this repository discovers
 * documents with `files.list` against the user's Drive, and under `drive.file` that call returns
 * only files already granted — which on a fresh connection is nothing. Choosing it today would
 * ship a capability that reports available and reads an empty Drive.
 *
 * So `drive.readonly` is chosen, and the cost is stated rather than softened: Google classifies it
 * RESTRICTED, it reads "view and download all your Drive files", and it makes Google verification
 * plus a CASA assessment a production prerequisite. That is recorded as release debt, exactly as
 * INT-4 recorded the same debt for the metadata scope.
 *
 * THE LEAST-PRIVILEGE PATH IS NOT CLOSED, it is sequenced: the capability→scope map below is keyed
 * by CAPABILITY, so a later Picker-based capability can request `drive.file` without touching this
 * entry or re-interpreting this one.
 */
export const GOOGLE_DRIVE_CONTENT_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/**
 * WHAT KIND OF CONTENT A DRIVE READ RETURNED — a CLOSED vocabulary owned here.
 *
 * KID-0 recorded the blocker this answers: a native Google Doc has no filename extension, and the
 * Knowledge file boundary derives its source type from one. This is the provider's normalized
 * answer to "what did I just hand you", and it exists so a LATER milestone can map it through an
 * explicit allowlist instead of trusting a provider-declared MIME string.
 *
 * It is three values because three formats are supported. It is not a taxonomy.
 */
export type GoogleDriveContentKind = "google-doc-text" | "plain-text" | "markdown";

/**
 * WHICH DRIVE MIME TYPES THIS CAPABILITY READS, AND HOW — a closed map, and the ONLY way in.
 *
 * A MIME type absent from this map is refused. That is the fail-closed direction: an unsupported
 * type must never fall through to a generic download, because "whatever Drive returns" is how a
 * spreadsheet, an image or an executable becomes text somebody later ingests.
 *
 * `export` names a Google Workspace document, which cannot be downloaded with `alt=media` at all
 * and must go through `files.export`. `download` names a real stored file.
 */
export const GOOGLE_DRIVE_READABLE_TYPES: Readonly<
  Record<string, { readonly method: "export" | "download"; readonly kind: GoogleDriveContentKind }>
> = Object.freeze({
  "application/vnd.google-apps.document": Object.freeze({
    method: "export" as const,
    kind: "google-doc-text" as const,
  }),
  "text/plain": Object.freeze({ method: "download" as const, kind: "plain-text" as const }),
  "text/markdown": Object.freeze({ method: "download" as const, kind: "markdown" as const }),
  "text/x-markdown": Object.freeze({ method: "download" as const, kind: "markdown" as const }),
});

/** The MIME type a Google Workspace document is exported AS. Never caller-supplied. */
export const GOOGLE_DRIVE_EXPORT_MIME = "text/plain" as const;

/**
 * THE MOST CONTENT ONE READ MAY RETURN.
 *
 * Google's own export cap is 10 MB. This is far below it, deliberately and for INT-4's stated
 * reason: a read seam bounded at the provider's maximum is a data export waiting for a caller. It
 * is also enforced TWICE — once from the metadata Drive reports before the body is fetched, and
 * again on the bytes actually received, because a declared size is a claim and a byte count is a
 * measurement.
 */
export const MAX_DRIVE_CONTENT_BYTES = 1_000_000;

/** One document's content, and the identity a later milestone needs to attribute it. */
export interface GoogleDriveContent {
  readonly fileId: string;
  readonly name: string;
  /** What Drive said the document IS. */
  readonly providerMimeType: string;
  /** What Hebun actually received — for an exported Doc these differ, and both are reported. */
  readonly returnedMimeType: string;
  /** The closed normalized kind. A later boundary maps THIS, never `providerMimeType`. */
  readonly contentKind: GoogleDriveContentKind;
  /** The decoded text. Never interpreted, never executed, never treated as an instruction. */
  readonly text: string;
  /** Measured from the received body, never taken from Drive's declared size. */
  readonly byteLength: number;
}

export type GoogleDriveContentResult =
  | { readonly ok: true; readonly content: GoogleDriveContent }
  | GoogleFailure;

/**
 * WHICH EXTRA SCOPES A CAPABILITY UPGRADE MAY REQUEST — a closed map, keyed by capability.
 *
 * The authorization route accepts a CAPABILITY, never a scope. A handler that took scopes would
 * take whatever an attacker put in the query string, and the consent screen would ask for it in
 * Hebun's name. Here the only reachable values are the ones written on this line.
 *
 * `include_granted_scopes=false` is unchanged, so an upgrade must ask for the identity scopes TOO
 * or Google would return a grant without them and the connection would fail its own required-scope
 * check. The caller composes base + extra for exactly that reason.
 */
export const GOOGLE_CAPABILITY_SCOPE_REQUESTS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    [GOOGLE_DRIVE_METADATA_CAPABILITY]: Object.freeze([GOOGLE_DRIVE_METADATA_SCOPE]),
    /*
     * KID-1. A SEPARATE ENTRY, so a caller asking for content consent cannot silently obtain
     * metadata consent or the reverse. The route still accepts a capability and never a scope.
     */
    [GOOGLE_DRIVE_CONTENT_CAPABILITY]: Object.freeze([GOOGLE_DRIVE_CONTENT_SCOPE]),
  });

/** The capability names an authorization request may legitimately carry. */
export const GOOGLE_UPGRADEABLE_CAPABILITIES: readonly string[] = Object.freeze(
  Object.keys(GOOGLE_CAPABILITY_SCOPE_REQUESTS),
);

/**
 * Resolve a caller-supplied capability to the extra scopes it needs, or `null`.
 *
 * `null` for anything unrecognized — an unknown capability is not an error to report back with the
 * offending value, it is simply not a capability.
 */
export function extraScopesForCapability(capability: string | null): readonly string[] | null {
  if (!capability) return null;
  /*
   * ── `Object.hasOwn`, NOT A BARE LOOKUP ────────────────────────────────────
   *
   * A plain `map[capability]` reaches the PROTOTYPE CHAIN. `"__proto__"` returns an object,
   * `"constructor"` returns a function, and `"toString"` returns a method — none of them `undefined`,
   * so the `?? null` fallback never fires. This function's whole job is to make a caller-supplied
   * string resolve only to scopes written in this file, and a bare lookup quietly fails at exactly
   * that. Found by INT-4's own hostile-input assertion, not by review.
   *
   * `Array.isArray` is the second gate: even an own property must be a scope list to be returned.
   */
  if (!Object.hasOwn(GOOGLE_CAPABILITY_SCOPE_REQUESTS, capability)) return null;
  const scopes = GOOGLE_CAPABILITY_SCOPE_REQUESTS[capability];
  return Array.isArray(scopes) ? scopes : null;
}

/**
 * ONE DRIVE FILE, AS HEBUN SEES IT.
 *
 * A NORMALIZED, PROVIDER-OWNED shape — never Google's response object. Returning the raw payload
 * would put every field Google adds in future on Hebun's surfaces without anybody deciding, and
 * Drive's `File` resource carries permissions, owners, sharing links and thumbnails that this
 * capability has no business holding.
 *
 * `sizeBytes` is null for Google-native files (Docs, Sheets), which genuinely have no byte size.
 * That is a fact about Drive, not a missing value.
 */
export interface GoogleDriveFileView {
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedAt: string | null;
  readonly sizeBytes: number | null;
  /** Drive's own flag. Reported so a surface never presents a trashed file as live. */
  readonly trashed: boolean;
}

/** A bounded page of Drive metadata. */
export interface GoogleDriveListing {
  readonly files: readonly GoogleDriveFileView[];
  /** Google's opaque continuation token, or null. Never a cursor Hebun invents. */
  readonly nextPageToken: string | null;
}

export type GoogleDriveListResult =
  | { readonly ok: true; readonly listing: GoogleDriveListing }
  | GoogleFailure;

/**
 * The most files one Drive read may return.
 *
 * Google's own `files.list` maximum is 1000; this is far below it on purpose. A read seam whose
 * bound is the provider's maximum is a data export waiting for a caller, and every released Hebun
 * listing is bounded well under what the store could serve.
 */
export const MAX_DRIVE_FILES_PER_PAGE = 50;
