/*
 * provider-google/oauth-state.server.ts — THE THING THAT MAKES A CALLBACK TRUSTWORTHY.
 *
 * ── WHAT AN OAUTH CALLBACK ACTUALLY IS ───────────────────────────────────────
 *
 * A GET request from the user's browser, carrying a `code` and a `state`, arriving at Hebun from
 * an external site. Anyone can send one. Without state, an attacker sends a callback carrying
 * THEIR authorization code to a logged-in victim's browser, and the victim's tenant ends up
 * connected to the attacker's Google account — which then receives whatever the tenant later
 * syncs. That is the whole reason this file exists.
 *
 * ── FOUR PROPERTIES, EACH ENFORCED BY MECHANISM ──────────────────────────────
 *
 *   RANDOM        a 256-bit nonce from `randomBytes`. Never a counter, a timestamp or a uuid v4
 *                 pretending to be entropy.
 *   BOUND         the signed payload carries the tenant AND a digest of the session reference.
 *                 A state minted in one session cannot be completed in another, and one minted
 *                 for tenant A cannot be completed while acting as tenant B.
 *   SINGLE-USE    the cookie is deleted before the code is exchanged. A replayed callback finds
 *                 no cookie and is refused, so an intercepted URL is worth one attempt at most.
 *   SHORT-LIVED   ten minutes, carried INSIDE the signed payload rather than trusted from the
 *                 cookie's own Max-Age, because a cookie lifetime is a browser's opinion.
 *
 * ── WHY THE SECRET IS ITS OWN ────────────────────────────────────────────────
 *
 * `HEBUN_GOOGLE_OAUTH_STATE_SECRET`, never the session digest key. Two authentication contexts
 * sharing one key means a value minted for one can be presented to the other; the cost of a second
 * environment variable is nothing next to that.
 *
 * ── WHY THE PKCE VERIFIER LIVES HERE ─────────────────────────────────────────
 *
 * PKCE needs the verifier at exchange time and it must never reach the browser's address bar. The
 * signed HttpOnly cookie is exactly a server-to-itself envelope, so the verifier rides inside it
 * while only its SHA-256 challenge goes to Google. Hebun is a confidential client and sends a
 * client secret too — PKCE is defence in depth against code interception, not a replacement.
 *
 * ── SameSite=Lax IS DELIBERATE ───────────────────────────────────────────────
 *
 * `Strict` would not be sent on the top-level cross-site GET that Google performs, so the callback
 * would find no cookie and every connection would fail. `Lax` sends it on exactly that navigation
 * and withholds it from cross-site subrequests, which is the property needed.
 *
 * Server-only. The nonce is the only part that ever reaches a URL.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The cookie the browser carries between the authorization request and the callback. */
export const GOOGLE_OAUTH_STATE_COOKIE = "hebun_google_oauth_state";

/** Ten minutes. Long enough to read a consent screen, short enough that a leaked URL rots. */
export const GOOGLE_OAUTH_STATE_TTL_SECONDS = 600;

/** Bumped if the payload shape ever changes, so an old cookie is refused rather than misread. */
const STATE_VERSION = "v1" as const;

export interface OAuthStatePayload {
  readonly version: typeof STATE_VERSION;
  /** Sent to Google as `state`, and compared on return. */
  readonly nonce: string;
  readonly tenantId: string;
  /** A digest of the session reference — the session itself never leaves the cookie jar. */
  readonly sessionDigest: string;
  /** The `integrations` row this authorization is for. */
  readonly integrationId: string;
  /** PKCE. Never sent to Google; only its challenge is. */
  readonly codeVerifier: string;
  /** Absolute expiry, seconds since epoch. Inside the signature, so it cannot be extended. */
  readonly expiresAt: number;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Google OAuth state is server-only.");
  }
}

/** base64url without padding — safe in a cookie and in a query parameter. */
function b64url(input: Buffer): string {
  return input.toString("base64url");
}

/**
 * A digest of the session reference.
 *
 * The reference itself is never copied into another cookie: a second place holding a live session
 * token is a second place to steal it from. A digest is enough to answer "is this the same session
 * that started the flow", which is the only question being asked.
 */
export function digestSessionReference(reference: string, secret: string): string {
  return createHmac("sha256", secret).update(`session:${reference}`).digest("base64url");
}

/** The PKCE challenge Google receives. S256, never `plain`. */
export function codeChallengeFor(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export interface MintedState {
  readonly payload: OAuthStatePayload;
  /** The signed envelope for the cookie. */
  readonly cookieValue: string;
  /** The opaque value for Google's `state` parameter. */
  readonly stateParameter: string;
  readonly codeChallenge: string;
}

/**
 * Mint one state for one authorization attempt.
 *
 * `nowSeconds` is injected so a test can prove expiry rather than sleep through it.
 */
export function mintOAuthState(
  input: {
    readonly tenantId: string;
    readonly sessionReference: string;
    readonly integrationId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): MintedState {
  assertServerOnly();

  const payload: OAuthStatePayload = Object.freeze({
    version: STATE_VERSION,
    nonce: b64url(randomBytes(32)),
    tenantId: input.tenantId,
    sessionDigest: digestSessionReference(input.sessionReference, secret),
    integrationId: input.integrationId,
    codeVerifier: b64url(randomBytes(64)),
    expiresAt: nowSeconds + GOOGLE_OAUTH_STATE_TTL_SECONDS,
  });

  return {
    payload,
    cookieValue: sealState(payload, secret),
    /* ONLY the nonce goes to Google. The tenant, the session and the verifier stay server-side. */
    stateParameter: payload.nonce,
    codeChallenge: codeChallengeFor(payload.codeVerifier),
  };
}

/** `<base64url(payload)>.<base64url(hmac)>` — the payload is signed, not encrypted. */
function sealState(payload: OAuthStatePayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = createHmac("sha256", secret).update(`state:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

/**
 * Why a callback's state was not accepted.
 *
 * Every arm is a refusal. NONE of them is reported to the browser in detail — a caller maps them
 * all to one generic failure, because telling an attacker which check failed is a free oracle.
 */
export type StateRefusal =
  | "missing"
  | "malformed"
  | "bad-signature"
  | "expired"
  | "nonce-mismatch"
  | "session-mismatch"
  | "tenant-mismatch";

export type StateVerification =
  | { readonly ok: true; readonly payload: OAuthStatePayload }
  | { readonly ok: false; readonly reason: StateRefusal };

/**
 * Verify a returned state against the cookie that minted it.
 *
 * THE SIGNATURE IS CHECKED BEFORE THE PAYLOAD IS TRUSTED, and compared in constant time. Parsing
 * first and validating later is how a forged payload gets to influence the code that decides
 * whether to trust it.
 */
export function verifyOAuthState(
  input: {
    readonly cookieValue: string | undefined;
    readonly stateParameter: string | undefined;
    readonly sessionReference: string;
    readonly tenantId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): StateVerification {
  assertServerOnly();

  if (!input.cookieValue || !input.stateParameter) return { ok: false, reason: "missing" };

  const parts = input.cookieValue.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, signature] = parts as [string, string];

  const expected = createHmac("sha256", secret).update(`state:${body}`).digest("base64url");
  const givenBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (givenBuf.length !== expectedBuf.length || !timingSafeEqual(givenBuf, expectedBuf)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload.version !== STATE_VERSION) return { ok: false, reason: "malformed" };
  if (typeof payload.expiresAt !== "number" || payload.expiresAt <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }

  /* The value Google handed back must be the value this cookie minted. */
  const nonceBuf = Buffer.from(input.stateParameter, "utf8");
  const mintedBuf = Buffer.from(payload.nonce ?? "", "utf8");
  if (nonceBuf.length !== mintedBuf.length || !timingSafeEqual(nonceBuf, mintedBuf)) {
    return { ok: false, reason: "nonce-mismatch" };
  }

  /* The session that finishes must be the session that started. */
  const digest = digestSessionReference(input.sessionReference, secret);
  const digestBuf = Buffer.from(digest, "utf8");
  const storedBuf = Buffer.from(payload.sessionDigest ?? "", "utf8");
  if (digestBuf.length !== storedBuf.length || !timingSafeEqual(digestBuf, storedBuf)) {
    return { ok: false, reason: "session-mismatch" };
  }

  /*
   * And the tenant must match. Redundant with the session digest today — a session resolves to one
   * tenant — and kept because workspace switching exists: the same human may hold one session and
   * two tenants, and a state minted while acting as one must not complete while acting as another.
   */
  if (payload.tenantId !== input.tenantId) return { ok: false, reason: "tenant-mismatch" };

  return { ok: true, payload };
}

/** Cookie attributes. `secure` follows the redirect URI, so localhost development still works. */
export function stateCookieOptions(redirectUri: string): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: redirectUri.startsWith("https://"),
    path: "/api/integrations/google",
    maxAge: GOOGLE_OAUTH_STATE_TTL_SECONDS,
  };
}
