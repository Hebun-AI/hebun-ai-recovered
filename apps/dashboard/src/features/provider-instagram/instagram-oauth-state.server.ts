/*
 * provider-instagram/instagram-oauth-state.server.ts — WHAT MAKES AN INSTAGRAM CALLBACK TRUSTWORTHY.
 *
 * ── THE ATTACK THIS FILE EXISTS FOR ─────────────────────────────────────────
 *
 * An OAuth callback is a GET from the user's browser, carrying a `code`, arriving at Hebun from an
 * external site. Anyone can send one. Without state, an attacker completes consent with THEIR
 * Instagram account, keeps the resulting callback URL, and gets a logged-in victim to visit it —
 * and the victim's tenant is now bound to the attacker's account, with everything Hebun later
 * observes coming from somewhere the tenant never chose.
 *
 * ── WHY THIS IS A THIRD MODULE AND NOT A SHARED FRAMEWORK ───────────────────
 *
 * This repository has no shared OAuth-ceremony framework. It has two per-provider state modules —
 * `provider-google/oauth-state.server.ts` and `provider-github/install-state.server.ts` — which is
 * a CONVENTION, measured rather than assumed: each provider owns its own state, and neither imports
 * the other. Instagram follows it. Extracting a common core would mean rewriting two released
 * ceremonies inside a slice that was authorized to add one, so the duplication is recorded as debt
 * instead of paid for here with someone else's risk.
 *
 * ── FOUR PROPERTIES, EACH ENFORCED BY MECHANISM ─────────────────────────────
 *
 *   RANDOM        a 256-bit nonce from `randomBytes`. Never a counter, a timestamp or a uuid.
 *   BOUND         the signed payload carries the tenant AND a digest of the session reference. A
 *                 state minted in one session cannot be completed in another, and one minted for
 *                 tenant A cannot be completed while acting as tenant B.
 *   SINGLE-USE    the cookie is deleted before the code is exchanged, so an intercepted callback
 *                 URL is worth one attempt at most.
 *   SHORT-LIVED   ten minutes, carried INSIDE the signed payload rather than trusted from the
 *                 cookie's own Max-Age, because a cookie lifetime is a browser's opinion.
 *
 * ── WHAT IS ABSENT HERE, AND WHY THAT IS NOT AN OVERSIGHT ───────────────────
 *
 * NO PKCE. Google's equivalent carries a code verifier because Google's authorization endpoint
 * accepts `code_challenge`. Meta's documented contract for Business Login for Instagram does not:
 * the authorization endpoint takes `client_id`, `redirect_uri`, `response_type`, `scope` and
 * `state`, and nothing else. Minting a verifier Hebun could never send would be theatre — a field
 * in a payload that proves nothing — so it is not minted. Hebun is a confidential client and the
 * exchange is authenticated by the App secret, server to server.
 *
 * ── SameSite=Lax IS DELIBERATE ──────────────────────────────────────────────
 *
 * `Strict` would not be sent on the top-level cross-site GET that Meta performs, so the callback
 * would find no cookie and every connection would fail. `Lax` sends it on exactly that navigation
 * and withholds it from cross-site subrequests, which is the property needed.
 *
 * Server-only. The nonce is the only part that ever reaches a URL.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The cookie the browser carries between the authorization request and the callback. */
export const INSTAGRAM_OAUTH_STATE_COOKIE = "hebun_instagram_oauth_state";

/** Ten minutes. Long enough to read a consent screen, short enough that a leaked URL rots. */
export const INSTAGRAM_OAUTH_STATE_TTL_SECONDS = 600;

/** Bumped if the payload shape ever changes, so an old cookie is refused rather than misread. */
const STATE_VERSION = "v1" as const;

export interface InstagramOAuthStatePayload {
  readonly version: typeof STATE_VERSION;
  /** Sent to Instagram as `state`, and compared on return. */
  readonly nonce: string;
  readonly tenantId: string;
  /** A digest of the session reference — the session itself never leaves the cookie jar. */
  readonly sessionDigest: string;
  /** The `integrations` row this authorization is for. */
  readonly integrationId: string;
  /** Absolute expiry, seconds since epoch. Inside the signature, so it cannot be extended. */
  readonly expiresAt: number;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Instagram OAuth state is server-only.");
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
 * token is a second place to steal it from. A digest answers "is this the same session that started
 * the flow", which is the only question being asked.
 */
export function digestSessionReference(reference: string, secret: string): string {
  return createHmac("sha256", secret).update(`session:${reference}`).digest("base64url");
}

export interface MintedInstagramState {
  readonly payload: InstagramOAuthStatePayload;
  /** The signed envelope for the cookie. */
  readonly cookieValue: string;
  /** The opaque value for Instagram's `state` parameter. */
  readonly stateParameter: string;
}

/**
 * Mint one state for one authorization attempt.
 *
 * `nowSeconds` is injected so a test can prove expiry rather than sleep through it.
 */
export function mintInstagramOAuthState(
  input: {
    readonly tenantId: string;
    readonly sessionReference: string;
    readonly integrationId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): MintedInstagramState {
  assertServerOnly();

  const payload: InstagramOAuthStatePayload = Object.freeze({
    version: STATE_VERSION,
    nonce: b64url(randomBytes(32)),
    tenantId: input.tenantId,
    sessionDigest: digestSessionReference(input.sessionReference, secret),
    integrationId: input.integrationId,
    expiresAt: nowSeconds + INSTAGRAM_OAUTH_STATE_TTL_SECONDS,
  });

  return {
    payload,
    cookieValue: sealState(payload, secret),
    /* ONLY the nonce goes to Instagram. The tenant and the session stay server-side. */
    stateParameter: payload.nonce,
  };
}

/** `<base64url(payload)>.<base64url(hmac)>` — the payload is signed, not encrypted. */
function sealState(payload: InstagramOAuthStatePayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = createHmac("sha256", secret).update(`state:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

/**
 * Why a callback's state was not accepted.
 *
 * Every arm is a refusal. NONE is reported to the browser in detail — the callback maps them all to
 * one generic failure, because telling an attacker which check failed is a free oracle.
 */
export type InstagramStateRefusal =
  | "missing"
  | "malformed"
  | "bad-signature"
  | "expired"
  | "nonce-mismatch"
  | "session-mismatch"
  | "tenant-mismatch";

export type InstagramStateVerification =
  | { readonly ok: true; readonly payload: InstagramOAuthStatePayload }
  | { readonly ok: false; readonly reason: InstagramStateRefusal };

/**
 * Verify a returned state against the cookie that minted it.
 *
 * THE SIGNATURE IS CHECKED BEFORE THE PAYLOAD IS TRUSTED, and compared in constant time. Parsing
 * first and validating later is how a forged payload gets to influence the code deciding whether to
 * trust it.
 */
export function verifyInstagramOAuthState(
  input: {
    readonly cookieValue: string | undefined;
    readonly stateParameter: string | undefined;
    readonly sessionReference: string;
    readonly tenantId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): InstagramStateVerification {
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

  let payload: InstagramOAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as InstagramOAuthStatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload.version !== STATE_VERSION) return { ok: false, reason: "malformed" };
  if (typeof payload.expiresAt !== "number" || payload.expiresAt <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }

  /* The value Instagram handed back must be the value this cookie minted. */
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

/**
 * Cookie attributes.
 *
 * `secure` is UNCONDITIONAL, unlike Google's equivalent, which follows its redirect URI so that
 * plain-http loopback development works. Meta requires an HTTPS redirect URI, so there is no
 * configuration in which this cookie should travel in the clear, and making it conditional would
 * only create one.
 *
 * The path is the Instagram ceremony's own, so the cookie is never sent to Google's routes or to
 * anything else under `/api`.
 */
export function instagramStateCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: true;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/api/integrations/instagram",
    maxAge: INSTAGRAM_OAUTH_STATE_TTL_SECONDS,
  };
}
