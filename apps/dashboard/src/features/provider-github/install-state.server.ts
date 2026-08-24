/*
 * provider-github/install-state.server.ts — THE THING THAT MAKES A SETUP CALLBACK TRUSTWORTHY.
 *
 * ── WHAT A GITHUB SETUP CALLBACK ACTUALLY IS ─────────────────────────────────
 *
 * A GET request from the user's browser, carrying `installation_id`, arriving at Hebun from
 * github.com. Anyone can send one. GitHub says so itself, in the Setup URL documentation:
 *
 *   "Bad actors can hit this URL with a spoofed `installation_id`. Therefore, you should not rely
 *    on the validity of the `installation_id` parameter."
 *
 * Without binding, an attacker sends a logged-in victim a setup URL naming the ATTACKER'S
 * installation, and the victim's tenant ends up connected to an organization they do not control —
 * which then appears in their Integrations surface as their own.
 *
 * ── WHY THIS IS NOT `provider-google/oauth-state.server.ts` ──────────────────
 *
 * Reuse was considered and REFUSED, on the evidence rather than on taste. That module is not
 * provider-neutral: its cookie is `hebun_google_oauth_state`, its secret is
 * `HEBUN_GOOGLE_OAUTH_STATE_SECRET`, its cookie `path` is `/api/integrations/google`, and its
 * payload carries a PKCE `codeVerifier` — a field the GitHub installation flow has no use for,
 * since there is no authorization code to exchange. Its own header states the rule that settles
 * it: "a key reused across two authentication contexts lets a value minted for one be presented
 * to the other."
 *
 * So this is a sibling with the same four properties and its own secret. The genuinely shared
 * thing — a provider-neutral state authority — would mean refactoring released Google code, which
 * is a separate change with its own gate. That is recorded as debt, not smuggled in here.
 *
 * ── FOUR PROPERTIES, EACH ENFORCED BY MECHANISM ──────────────────────────────
 *
 *   RANDOM        a 256-bit nonce from `randomBytes`.
 *   BOUND         the signed payload carries the tenant AND a digest of the session reference. A
 *                 state minted in one session cannot be completed in another, and one minted for
 *                 tenant A cannot be completed while acting as tenant B.
 *   SINGLE-USE    the cookie is cleared before the installation is verified, so an intercepted
 *                 URL is worth one attempt at most.
 *   SHORT-LIVED   ten minutes, carried INSIDE the signed payload rather than trusted from the
 *                 cookie's own Max-Age, because a cookie lifetime is a browser's opinion.
 *
 * ── AND THE STATE IS STILL NOT THE TRUTH ─────────────────────────────────────
 *
 * Passing every check above proves WHO is finishing the flow. It proves nothing whatsoever about
 * the installation. The `installation_id` remains untrusted after this module accepts it, and only
 * a JWT-authenticated `GET /app/installations/{id}` establishes what it names. This module answers
 * "is this our tenant's flow"; the verifier answers "is this a real installation, and whose".
 *
 * Server-only. The nonce is the only part that ever reaches a URL.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The cookie the browser carries between the installation redirect and the setup callback. */
export const GITHUB_INSTALL_STATE_COOKIE = "hebun_github_install_state";

/** Ten minutes. Long enough to pick an organization and repositories, short enough that a leaked URL rots. */
export const GITHUB_INSTALL_STATE_TTL_SECONDS = 600;

/** Bumped if the payload shape ever changes, so an old cookie is refused rather than misread. */
const STATE_VERSION = "gh-v1" as const;

export interface InstallStatePayload {
  readonly version: typeof STATE_VERSION;
  /** Sent to GitHub as `state`, and compared on return. */
  readonly nonce: string;
  readonly tenantId: string;
  /** A digest of the session reference — the session itself never leaves the cookie jar. */
  readonly sessionDigest: string;
  /** The `integrations` row this installation attempt is for. */
  readonly integrationId: string;
  /** Absolute expiry, seconds since epoch. Inside the signature, so it cannot be extended. */
  readonly expiresAt: number;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("GitHub install state is server-only.");
  }
}

function b64url(input: Buffer): string {
  return input.toString("base64url");
}

/**
 * A digest of the session reference.
 *
 * The reference itself is never copied into another cookie: a second place holding a live session
 * token is a second place to steal it from. A digest answers "is this the same session that
 * started the flow", which is the only question being asked.
 *
 * The `github-session:` label is deliberately not Google's `session:` label. Even with different
 * secrets, distinct domain separation means a digest from one flow can never equal one from the
 * other by construction rather than by key management.
 */
export function digestSessionReference(reference: string, secret: string): string {
  return createHmac("sha256", secret).update(`github-session:${reference}`).digest("base64url");
}

export interface MintedInstallState {
  readonly payload: InstallStatePayload;
  /** The signed envelope for the cookie. */
  readonly cookieValue: string;
  /** The opaque value for GitHub's `state` parameter. */
  readonly stateParameter: string;
}

/** `<base64url(payload)>.<base64url(hmac)>` — the payload is signed, not encrypted. */
function sealState(payload: InstallStatePayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const signature = createHmac("sha256", secret).update(`gh-state:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

/** Mint one state for one installation attempt. `nowSeconds` is injected so a test can prove expiry. */
export function mintInstallState(
  input: {
    readonly tenantId: string;
    readonly sessionReference: string;
    readonly integrationId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): MintedInstallState {
  assertServerOnly();

  const payload: InstallStatePayload = Object.freeze({
    version: STATE_VERSION,
    nonce: b64url(randomBytes(32)),
    tenantId: input.tenantId,
    sessionDigest: digestSessionReference(input.sessionReference, secret),
    integrationId: input.integrationId,
    expiresAt: nowSeconds + GITHUB_INSTALL_STATE_TTL_SECONDS,
  });

  return {
    payload,
    cookieValue: sealState(payload, secret),
    /* ONLY the nonce goes to GitHub. The tenant and the session stay server-side. */
    stateParameter: payload.nonce,
  };
}

/**
 * Why a setup callback's state was not accepted.
 *
 * Every arm is a refusal. NONE is reported to the browser in detail — the route maps them all to
 * one generic failure, because telling an attacker which check failed is a free oracle.
 */
export type InstallStateRefusal =
  | "missing"
  | "malformed"
  | "bad-signature"
  | "expired"
  | "nonce-mismatch"
  | "session-mismatch"
  | "tenant-mismatch";

export type InstallStateVerification =
  | { readonly ok: true; readonly payload: InstallStatePayload }
  | { readonly ok: false; readonly reason: InstallStateRefusal };

/**
 * Verify a returned state against the cookie that minted it.
 *
 * THE SIGNATURE IS CHECKED BEFORE THE PAYLOAD IS TRUSTED, and compared in constant time. Parsing
 * first and validating later is how a forged payload gets to influence the code deciding whether
 * to trust it.
 */
export function verifyInstallState(
  input: {
    readonly cookieValue: string | undefined;
    readonly stateParameter: string | undefined;
    readonly sessionReference: string;
    readonly tenantId: string;
  },
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): InstallStateVerification {
  assertServerOnly();

  if (!input.cookieValue || !input.stateParameter) return { ok: false, reason: "missing" };

  const parts = input.cookieValue.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, signature] = parts as [string, string];

  const expected = createHmac("sha256", secret).update(`gh-state:${body}`).digest("base64url");
  const givenBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (givenBuf.length !== expectedBuf.length || !timingSafeEqual(givenBuf, expectedBuf)) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: InstallStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InstallStatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (payload.version !== STATE_VERSION) return { ok: false, reason: "malformed" };
  if (typeof payload.expiresAt !== "number" || payload.expiresAt <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }

  /* The value GitHub handed back must be the value this cookie minted. */
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

/** Cookie attributes. `secure` follows the configured setup URL, so localhost development works. */
export function installStateCookieOptions(setupUrl: string): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    /*
     * `Strict` would not be sent on the top-level cross-site GET that GitHub performs, so the
     * callback would find no cookie and every installation would fail. `Lax` sends it on exactly
     * that navigation and withholds it from cross-site subrequests.
     */
    sameSite: "lax",
    secure: setupUrl.startsWith("https://"),
    path: "/api/integrations/github",
    maxAge: GITHUB_INSTALL_STATE_TTL_SECONDS,
  };
}
