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
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  parseScopes,
  type GoogleAccountIdentity,
  type GoogleFailure,
  type GoogleIdentityResult,
  type GoogleTokenResult,
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
    /* 403 is ambiguous at Google: insufficient scope AND some quota errors share it. */
    return errorCode === "insufficientPermissions" || errorCode === "insufficient_scope"
      ? fail("scope", "google-insufficient-scope")
      : fail("auth", "google-forbidden");
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
