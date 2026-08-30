/*
 * provider-google/google-transport.server.ts — THE ONLY PLACE HEBUN TALKS TO GOOGLE.
 *
 * ── ONE SEAM, ON PURPOSE ─────────────────────────────────────────────────────
 *
 * Every `fetch` to a Google endpoint in this repository is in this file. Not because it is tidier,
 * but because a scattered provider call is a scattered place to log a token, to retry a
 * non-idempotent exchange, or to point at a host somebody passed in. A firewall test asserts the
 * count is exactly one file.
 *
 * The endpoints are CONSTANTS from `contracts.ts`. There is no base-URL parameter, no configurable
 * host and no way for a caller to redirect these calls somewhere else — the R3B lesson, where a
 * configurable endpoint turned a selected vendor into an arbitrary-URL hole.
 *
 * ── WHAT IS NEVER LOGGED, AND WHY THERE IS NO LOGGER HERE AT ALL ─────────────
 *
 * No `console`, no logger, no telemetry, no error re-throw carrying a response. An authorization
 * code, an access token and a refresh token all appear in this file's local variables, and a
 * Google error body can echo request parameters back. So failures become a CLASSIFIED reason
 * string written by this module — never a provider payload, never a status line with a body.
 *
 * ── CLASSIFICATION IS THE PRODUCT ────────────────────────────────────────────
 *
 * Callers need to know WHICH KIND of failure happened, because a 401 and a 503 mean opposite
 * things for a tenant's grant. The classes are decided here, once, from the status code and the
 * documented error field — never re-derived by a caller reading a string.
 *
 * Server-only. Returns data; never touches a database, a credential store or a lifecycle.
 */
import {
  GOOGLE_DRIVE_FILES_ENDPOINT,
  MAX_DRIVE_FILES_PER_PAGE,
  GOOGLE_DRIVE_EXPORT_MIME,
  GOOGLE_DRIVE_READABLE_TYPES,
  MAX_DRIVE_CONTENT_BYTES,
  type GoogleDriveContentResult,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  parseScopes,
  type GoogleAccountIdentity,
  type GoogleFailure,
  type GoogleIdentityResult,
  type GoogleTokenResult,
  type GoogleDriveFileView,
  type GoogleDriveListResult,
} from "./contracts";
import type { ConfiguredGoogleOAuth } from "./google-environment.server";

/** Injected in tests so the network seam is never real. Production leaves it unset. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GoogleTransportDeps {
  readonly fetchImpl?: FetchLike;
  readonly now?: () => Date;
  /** Bounded so a hung provider cannot hold a request open indefinitely. */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Google transport is server-only.");
  }
}

function fail(failure: GoogleFailure["failure"], reason: string): GoogleFailure {
  return { ok: false, failure, reason };
}

/**
 * `429` and `5xx` are TRANSPORT, never auth.
 *
 * This is the single most consequential line in the file: a tenant whose provider returned 503
 * still holds a perfectly valid grant, and classifying it as `auth` would end their connection
 * because Google had a bad minute.
 */
function classifyStatus(status: number, errorCode: string | null): GoogleFailure {
  if (status === 429) return fail("transport", "google-rate-limited");
  if (status >= 500) return fail("transport", "google-unavailable");
  if (status === 401) return fail("auth", "google-rejected-credential");
  if (status === 403) {
    /* 403 is ambiguous at Google: insufficient scope, a disabled API, AND some quota errors share it. */
    if (errorCode === "insufficientPermissions" || errorCode === "insufficient_scope") {
      return fail("scope", "google-insufficient-scope");
    }
    /*
     * THE API IS SWITCHED OFF IN THE CLOUD PROJECT — not a credential problem and not a grant
     * problem. Falling through to `auth` here would tell a tenant their Google account was
     * refused, and would make Hebun spend a refresh token on every call to fix something no token
     * can fix. Found by running the released seam against real Google.
     */
    if (errorCode === "accessNotConfigured" || errorCode === "SERVICE_DISABLED") {
      return fail("disabled", "google-api-not-enabled");
    }
    return fail("auth", "google-forbidden");
  }
  if (status === 400 && errorCode === "invalid_grant") {
    /*
     * `invalid_grant` is Google's ONE answer for several different facts: the user revoked, the
     * refresh token expired through disuse, or the grant lapsed under a testing-mode publishing
     * status. Google gives no discriminator, so this module reports what it can defend — the
     * credential can no longer be used — and the caller maps that to `expired`, never `revoked`.
     */
    return fail("auth", "google-grant-no-longer-usable");
  }
  if (status >= 400) return fail("auth", `google-refused-${status}`);
  return fail("malformed", "google-unexpected-status");
}

async function postForm(
  endpoint: string,
  body: URLSearchParams,
  deps: GoogleTransportDeps,
): Promise<{ ok: true; json: Record<string, unknown> } | GoogleFailure> {
  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await doFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch {
    /* DNS, TLS, timeout, connection reset — NOTHING is known about the grant. */
    return fail("transport", "google-unreachable");
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown> = {};
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) return classifyStatus(response.status, null);
    return fail("malformed", "google-unparseable-response");
  }

  if (!response.ok) {
    const code = typeof json.error === "string" ? json.error : null;
    return classifyStatus(response.status, code);
  }
  return { ok: true, json };
}

function grantFrom(json: Record<string, unknown>, now: Date): GoogleTokenResult {
  const accessToken = typeof json.access_token === "string" ? json.access_token : null;
  if (!accessToken) return fail("malformed", "google-response-missing-access-token");

  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  return {
    ok: true,
    grant: {
      accessToken,
      /* ABSENT IS NORMAL on re-authorization. `null` means "Google sent none", never "clear it". */
      refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
      expiresAt: expiresIn === null ? null : new Date(now.getTime() + expiresIn * 1000),
      /* GOOGLE'S OWN statement of the grant. Never the scopes Hebun asked for. */
      grantedScopes: parseScopes(typeof json.scope === "string" ? json.scope : null),
      idToken: typeof json.id_token === "string" ? json.id_token : null,
    },
  };
}

/**
 * Exchange an authorization code for tokens.
 *
 * The code, the client secret and the PKCE verifier are all in this call's body and in no other
 * place. `redirect_uri` is the CONFIGURED value — Google re-checks it against the registration and
 * against the one used at authorization, which is only a protection if we send the same one twice.
 */
export async function exchangeAuthorizationCode(
  input: { readonly code: string; readonly codeVerifier: string },
  config: ConfiguredGoogleOAuth,
  deps: GoogleTransportDeps = {},
): Promise<GoogleTokenResult> {
  assertServerOnly();
  const body = new URLSearchParams({
    code: input.code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  const result = await postForm(GOOGLE_TOKEN_ENDPOINT, body, deps);
  if (!("ok" in result) || result.ok !== true) return result as GoogleFailure;
  return grantFrom(result.json, (deps.now ?? (() => new Date()))());
}

/**
 * Trade a refresh token for a fresh access token.
 *
 * Google usually returns NO refresh token here, and occasionally rotates it. Both are handled by
 * the caller through `grant.refreshToken` being `null` versus present — this module states the
 * fact and makes no decision about the stored credential.
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: ConfiguredGoogleOAuth,
  deps: GoogleTransportDeps = {},
): Promise<GoogleTokenResult> {
  assertServerOnly();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
  const result = await postForm(GOOGLE_TOKEN_ENDPOINT, body, deps);
  if (!("ok" in result) || result.ok !== true) return result as GoogleFailure;
  return grantFrom(result.json, (deps.now ?? (() => new Date()))());
}

/**
 * Ask Google who this access token belongs to.
 *
 * THE REAL I/O THAT MAKES `connected` TRUE. Nothing else in Hebun can produce evidence that Google
 * accepts a credential, and no other module may claim it did.
 */
export async function fetchGoogleIdentity(
  accessToken: string,
  deps: GoogleTransportDeps = {},
): Promise<GoogleIdentityResult> {
  assertServerOnly();
  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(GOOGLE_USERINFO_ENDPOINT, {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return fail("transport", "google-unreachable");
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) return classifyStatus(response.status, null);
    return fail("malformed", "google-unparseable-response");
  }
  if (!response.ok) {
    const code = typeof json.error === "string" ? json.error : null;
    return classifyStatus(response.status, code);
  }

  const subject = typeof json.sub === "string" ? json.sub : null;
  const email = typeof json.email === "string" ? json.email : null;
  /* `sub` IS the identity. Without it there is nothing a connection could be bound to. */
  if (!subject) return fail("identity", "google-response-missing-subject");
  if (!email) return fail("identity", "google-response-missing-email");

  const identity: GoogleAccountIdentity = {
    subject,
    email,
    emailVerified: json.email_verified === true,
    /* `hd` is present only for a Workspace-domain account. Absent is a FACT, not a failure. */
    hostedDomain: typeof json.hd === "string" && json.hd.length > 0 ? json.hd : null,
  };
  return { ok: true, identity };
}

/**
 * Ask Google to revoke a grant. BEST EFFORT, and the caller must never present a failure here as
 * a reason not to disconnect locally: a tenant must always be able to end their own record.
 */
export async function revokeGoogleToken(
  token: string,
  deps: GoogleTransportDeps = {},
): Promise<{ readonly revoked: boolean }> {
  assertServerOnly();
  const body = new URLSearchParams({ token });
  const result = await postForm(GOOGLE_REVOKE_ENDPOINT, body, deps);
  return { revoked: "ok" in result && result.ok === true };
}

/* ── Drive metadata (INT-4) ─────────────────────────────────────────────────── */

/**
 * READ GOOGLE'S ERROR CODE OUT OF EITHER SHAPE IT USES.
 *
 * The OAuth endpoints answer `{"error": "invalid_grant"}` — a STRING. The Drive API answers
 * `{"error": {"code": 403, "errors": [{"reason": "insufficientPermissions"}]}}` — an OBJECT.
 *
 * `classifyStatus` reads a string, so a Drive 403 would arrive with `null` and be classified
 * `auth` — "Google refused this credential" — when the truth is a SCOPE GAP that the tenant can
 * fix by granting more. Getting that backwards would tell somebody to reconnect an account that
 * was never disconnected.
 */
function googleErrorCode(json: Record<string, unknown>): string | null {
  if (typeof json.error === "string") return json.error;
  const error = json.error;
  if (!error || typeof error !== "object") return null;
  const nested = error as { status?: unknown; errors?: unknown };
  if (Array.isArray(nested.errors)) {
    const first = nested.errors[0] as { reason?: unknown } | undefined;
    if (first && typeof first.reason === "string") return first.reason;
  }
  return typeof nested.status === "string" ? nested.status : null;
}

/** One Drive file, taken field by field. Anything Google also sent is left behind. */
function driveFileFrom(raw: unknown): GoogleDriveFileView | null {
  if (!raw || typeof raw !== "object") return null;
  const file = raw as Record<string, unknown>;
  const fileId = typeof file.id === "string" ? file.id : null;
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : null;
  if (!fileId || !mimeType) return null;

  /*
   * `size` arrives as a STRING and is absent for Google-native files, which have no byte size.
   * A missing size is a fact about Drive, so it becomes `null` rather than `0` — a zero would be
   * a measurement nobody took.
   */
  const rawSize = typeof file.size === "string" ? Number(file.size) : null;
  const sizeBytes = rawSize !== null && Number.isFinite(rawSize) ? rawSize : null;

  return {
    fileId,
    /* A file with no name is possible; an empty string is what Drive shows, so it is what Hebun shows. */
    name: typeof file.name === "string" ? file.name : "",
    mimeType,
    modifiedAt: typeof file.modifiedTime === "string" ? file.modifiedTime : null,
    sizeBytes,
    trashed: file.trashed === true,
  };
}

/**
 * LIST DRIVE FILE METADATA. The only Drive call in Hebun.
 *
 * ── `fields` IS A SECURITY CONTROL, NOT AN OPTIMIZATION ──────────────────────
 *
 * Drive's `File` resource carries owners, permissions, sharing links, thumbnails and export URLs.
 * Requesting `*` would pull all of it across the seam, where the next surface could render it.
 * The projection below asks for the six fields `GoogleDriveFileView` declares and no others, so
 * the data Hebun cannot leak is data Hebun never received.
 *
 * ── THERE IS NO CONTENT READ HERE, AND NO WAY TO ADD ONE BY ACCIDENT ────────
 *
 * `alt=media` is never set, no download endpoint constant exists, and the granted scope
 * (`drive.metadata.readonly`) could not perform one if it were. Three independent reasons.
 *
 * ── NO CALLER-SUPPLIED QUERY ────────────────────────────────────────────────
 *
 * `pageToken` is Google's own opaque continuation value and is the ONLY thing a caller may pass.
 * A `q` parameter taken from a caller would let one build a Drive search Hebun then executes with
 * the tenant's credential.
 */
export async function listDriveFiles(
  accessToken: string,
  options: { readonly pageToken?: string | null } = {},
  deps: GoogleTransportDeps = {},
): Promise<GoogleDriveListResult> {
  assertServerOnly();

  const url = new URL(GOOGLE_DRIVE_FILES_ENDPOINT);
  url.searchParams.set("pageSize", String(MAX_DRIVE_FILES_PER_PAGE));
  url.searchParams.set(
    "fields",
    "nextPageToken,files(id,name,mimeType,modifiedTime,size,trashed)",
  );
  /* Shared drives are not claimed by this capability, so the default corpus is what is read. */
  url.searchParams.set("supportsAllDrives", "false");
  if (options.pageToken) url.searchParams.set("pageToken", options.pageToken);

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await doFetch(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
      signal: controller.signal,
    });
  } catch {
    return fail("transport", "google-unreachable");
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) return classifyStatus(response.status, null);
    return fail("malformed", "google-unparseable-response");
  }
  if (!response.ok) return classifyStatus(response.status, googleErrorCode(json));

  const rawFiles = json.files;
  if (!Array.isArray(rawFiles)) return fail("malformed", "google-response-missing-files");

  /*
   * A single unparseable entry is DROPPED, not fatal. Refusing the whole page because Drive added
   * one odd row would turn a provider change into an outage; the count difference is visible to
   * the caller because the page is bounded and known.
   */
  const files = rawFiles
    .map(driveFileFrom)
    .filter((f): f is GoogleDriveFileView => f !== null)
    .slice(0, MAX_DRIVE_FILES_PER_PAGE);

  return {
    ok: true,
    listing: {
      files: Object.freeze(files),
      nextPageToken: typeof json.nextPageToken === "string" ? json.nextPageToken : null,
    },
  };
}

/**
 * READ ONE SELECTED DRIVE DOCUMENT'S CONTENT (KID-1).
 *
 * ── THE FILE ID IS THE ONLY THING A CALLER CHOOSES ───────────────────────────
 *
 * There is no `q`, no folder, no page and no MIME parameter, for `listDriveFiles`' stated reason
 * turned one notch tighter: a caller who could name the export type could ask Drive to render a
 * document as HTML and hand the bytes to something downstream that renders it. The export type is
 * a constant, and the readable-type map is closed and consulted here — not supplied.
 *
 * ── TWO STEPS, AND THE FIRST ONE IS A REFUSAL OPPORTUNITY ────────────────────
 *
 * The metadata is fetched FIRST, so an unsupported MIME type or an over-large document is refused
 * BEFORE any body is transferred. Refusing after the download would still be correct and would
 * already have spent the bytes.
 *
 * ── THE SIZE BOUND IS CHECKED TWICE, ON PURPOSE ──────────────────────────────
 *
 * Drive's declared `size` is a CLAIM, and it is absent entirely for Workspace documents. The bytes
 * actually received are a MEASUREMENT. The declared value gates the request; the measured value
 * gates the result, and neither is trusted to do the other's job.
 *
 * ── WHAT COMES BACK IS TEXT, AND ONLY EVER DATA ──────────────────────────────
 *
 * The body is decoded as UTF-8 and returned as a string. It is never parsed as HTML, never
 * evaluated, never logged, and never treated as an instruction by this module or by its type.
 */
export async function readDriveFileContent(
  accessToken: string,
  fileId: string,
  deps: GoogleTransportDeps = {},
): Promise<GoogleDriveContentResult> {
  assertServerOnly();

  if (typeof fileId !== "string" || fileId.trim().length === 0) {
    return fail("malformed", "google-file-id-required");
  }
  const id = fileId.trim();
  /*
   * Drive ids are opaque, but they are not arbitrary text. Refusing anything that could not BE an
   * id keeps a caller from steering the request path with slashes or a query string.
   */
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(id)) {
    return fail("malformed", "google-file-id-malformed");
  }

  const doFetch = deps.fetchImpl ?? fetch;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const call = async (url: string, accept: string): Promise<Response | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(url, {
        method: "GET",
        headers: { authorization: `Bearer ${accessToken}`, accept },
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  /* ── 1 · WHAT IS IT? Refuse an unreadable or over-large document before any body moves. ── */
  const metaUrl = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(id)}`);
  metaUrl.searchParams.set("fields", "id,name,mimeType,size,trashed");
  metaUrl.searchParams.set("supportsAllDrives", "false");

  const metaResponse = await call(metaUrl.toString(), "application/json");
  if (!metaResponse) return fail("transport", "google-unreachable");

  let meta: Record<string, unknown>;
  try {
    meta = (await metaResponse.json()) as Record<string, unknown>;
  } catch {
    if (!metaResponse.ok) return classifyStatus(metaResponse.status, null);
    return fail("malformed", "google-unparseable-response");
  }
  if (!metaResponse.ok) return classifyStatus(metaResponse.status, googleErrorCode(meta));

  const name = typeof meta.name === "string" ? meta.name : "";
  const providerMimeType = typeof meta.mimeType === "string" ? meta.mimeType : "";
  if (!name || !providerMimeType) return fail("malformed", "google-response-missing-file-fields");
  /* A trashed document is not organizational content a human meant to select. */
  if (meta.trashed === true) return fail("malformed", "google-file-trashed");

  const readable = GOOGLE_DRIVE_READABLE_TYPES[providerMimeType];
  if (!readable) return fail("malformed", "google-file-type-unsupported");

  /* Drive reports `size` as a STRING, and omits it for Workspace documents. */
  const declared = typeof meta.size === "string" ? Number(meta.size) : null;
  if (declared !== null && Number.isFinite(declared) && declared > MAX_DRIVE_CONTENT_BYTES) {
    return fail("malformed", "google-file-too-large");
  }

  /* ── 2 · READ IT, by the ONE method its type permits. ────────────────────── */
  const contentUrl =
    readable.method === "export"
      ? (() => {
          const u = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(id)}/export`);
          u.searchParams.set("mimeType", GOOGLE_DRIVE_EXPORT_MIME);
          return u;
        })()
      : (() => {
          const u = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(id)}`);
          u.searchParams.set("alt", "media");
          u.searchParams.set("supportsAllDrives", "false");
          return u;
        })();

  const contentResponse = await call(contentUrl.toString(), "text/plain");
  if (!contentResponse) return fail("transport", "google-unreachable");
  if (!contentResponse.ok) {
    /* An error body here is JSON; a success body is not, so only this branch parses one. */
    let errorJson: Record<string, unknown> = {};
    try {
      errorJson = (await contentResponse.json()) as Record<string, unknown>;
    } catch {
      return classifyStatus(contentResponse.status, null);
    }
    return classifyStatus(contentResponse.status, googleErrorCode(errorJson));
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await contentResponse.arrayBuffer();
  } catch {
    return fail("transport", "google-content-unreadable");
  }

  /* THE MEASUREMENT. A document with no declared size, or a lying one, is caught here. */
  if (buffer.byteLength > MAX_DRIVE_CONTENT_BYTES) {
    return fail("malformed", "google-file-too-large");
  }

  let text: string;
  try {
    /* Strict: bytes that are not UTF-8 are refused rather than replaced with U+FFFD. */
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return fail("malformed", "google-content-not-utf8");
  }

  return {
    ok: true,
    content: {
      fileId: id,
      name,
      providerMimeType,
      returnedMimeType:
        readable.method === "export" ? GOOGLE_DRIVE_EXPORT_MIME : providerMimeType,
      contentKind: readable.kind,
      text,
      byteLength: buffer.byteLength,
    },
  };
}
