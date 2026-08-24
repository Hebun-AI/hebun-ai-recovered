/*
 * provider-github/github-app-jwt.server.ts — PROVING HEBUN IS THIS GITHUB APP.
 *
 * ── WHAT THIS ASSERTION ACTUALLY IS ──────────────────────────────────────────
 *
 * A GitHub App JWT is not a tenant credential and it is not scoped to an installation. It says
 * "I am App N", and it is the key that can list and read EVERY installation this App has on every
 * organization that has ever installed it. That is why it is minted here, per call, from a key
 * this module never returns, and why it expires in minutes rather than hours.
 *
 * ── VERIFIED AGAINST GITHUB'S CURRENT DOCUMENTATION, NOT FROM MEMORY ─────────
 *
 *   "your JWT must be signed using the `RS256` algorithm"
 *   `iat` — "Set this 60 seconds in the past and ensure that your server's date and time is set
 *            accurately"
 *   `exp` — "The time must be no more than 10 minutes into the future."
 *   `iss` — "The client ID or application ID of your GitHub App."
 *   header — `Authorization: Bearer <JWT>`
 *
 * ── WHY THE LIFETIME IS NINE MINUTES AND NOT TEN ─────────────────────────────
 *
 * Ten minutes is the MAXIMUM GitHub accepts, and `iat` is deliberately backdated 60 seconds for
 * clock drift. A token issued at `now - 60` and expiring at `now + 600` spans 660 seconds of
 * GitHub's clock, which is over the limit if GitHub's clock is behind ours. Nine minutes leaves
 * the whole drift allowance inside the bound, so the request cannot be refused for a reason that
 * has nothing to do with the App.
 *
 * ── NO JWT LIBRARY ───────────────────────────────────────────────────────────
 *
 * Three base64url segments and one RSA-SHA256 signature. A dependency here would be a package
 * with a signing key in its hands, added for forty lines of formatting, and this repository has
 * already refused a bundled parser it could not patch. `node:crypto` is the platform.
 *
 * Server-only. The token is returned to one caller, used once, and never stored.
 */
import { createSign, type KeyObject } from "node:crypto";

/**
 * The signed lifetime, in seconds. Under GitHub's ten-minute ceiling by a full drift allowance —
 * see the header.
 */
export const GITHUB_APP_JWT_TTL_SECONDS = 540;

/** GitHub's own recommendation, applied to `iat` so a fast local clock cannot invalidate a token. */
export const GITHUB_APP_JWT_CLOCK_SKEW_SECONDS = 60;

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("GitHub App JWT minting is server-only.");
  }
}

function segment(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * Mint one App JWT.
 *
 * `nowSeconds` is injected so a test can assert the claim arithmetic exactly rather than compare
 * against a moving clock — the same reason `mintOAuthState` takes one.
 *
 * The return value is a bare string on purpose: there is no wrapper object for a caller to
 * accidentally log, and no field named `token` for a serialiser to find interesting.
 */
export function mintGitHubAppJwt(
  appId: string,
  privateKey: KeyObject,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  assertServerOnly();

  const header = segment({ alg: "RS256", typ: "JWT" });
  const payload = segment({
    /* Backdated per GitHub's clock-drift recommendation. */
    iat: nowSeconds - GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
    exp: nowSeconds + GITHUB_APP_JWT_TTL_SECONDS,
    iss: appId,
  });

  const signingInput = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey, "base64url");

  return `${signingInput}.${signature}`;
}
