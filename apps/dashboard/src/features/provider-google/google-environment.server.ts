/*
 * provider-google/google-environment.server.ts — HEBUN'S OWN GOOGLE OAUTH APPLICATION.
 *
 * ── TWO SECRET CLASSES, AND THIS FILE OWNS EXACTLY ONE ───────────────────────
 *
 * DEPLOYMENT-OWNED (here): the OAuth client id, the client secret, the registered redirect URI,
 * and the state-signing secret. They identify HEBUN to Google. They are the same for every tenant,
 * they live in the environment, and they must NEVER reach `integration_credentials`.
 *
 * TENANT-OWNED (not here): the access and refresh tokens a human authorized. They identify A
 * TENANT'S ACCOUNT to Google, they differ per tenant, and they live only in INT-2's vault. They
 * must never reach the environment.
 *
 * Putting either in the other's home is the single most consequential mistake this phase could
 * make: a client secret in a tenant row is a deployment compromise scoped to one tenant's backup,
 * and a tenant refresh token in env is every tenant's secret in one variable.
 *
 * ── THE REDIRECT URI IS CONFIGURED, NEVER DERIVED ────────────────────────────
 *
 * It is read from the environment and used verbatim. It is NOT built from the request's `Host`
 * header, `x-forwarded-host`, or `NEXT_PUBLIC_*` anything. A redirect URI derived from a header an
 * attacker can set is the redirect-confusion vector, and Google's exact-match requirement is only
 * a protection if the value we send is the value we registered rather than the value we were told.
 *
 * ── FAIL CLOSED ──────────────────────────────────────────────────────────────
 *
 * Absent, blank or malformed configuration yields `invalid`, and every Google surface refuses.
 * There is NO development fallback, NO generated state secret and NO default redirect URI. A
 * generated state secret would silently accept states signed by a previous process; a default
 * redirect URI would be rejected by Google anyway, after the user had already consented.
 *
 * Server-only. Nothing here is ever returned to a client or written to a log.
 */
import { createHash } from "node:crypto";

export const GOOGLE_OAUTH_ENV_KEYS = {
  clientId: "GOOGLE_OAUTH_CLIENT_ID",
  clientSecret: "GOOGLE_OAUTH_CLIENT_SECRET",
  redirectUri: "GOOGLE_OAUTH_REDIRECT_URI",
  /**
   * DEDICATED, and deliberately not the session digest key. One secret, one purpose: a key reused
   * across two authentication contexts lets a token minted for one be presented to the other.
   */
  stateSecret: "HEBUN_GOOGLE_OAUTH_STATE_SECRET",
} as const;

/** 32 bytes of entropy, base64 — the shape `openssl rand -base64 32` produces. */
const MIN_STATE_SECRET_LENGTH = 32;

export interface ConfiguredGoogleOAuth {
  readonly status: "configured";
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly stateSecret: string;
}

export type GoogleOAuthResolution =
  | ConfiguredGoogleOAuth
  | {
      readonly status: "invalid";
      readonly missingKeys: readonly string[];
      /** Env var NAMES only. Never a value, never a fragment of one. */
      readonly invalidKeys: readonly string[];
    };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Google OAuth environment is server-only.");
  }
}

/**
 * A redirect URI Google could actually have registered.
 *
 * `https` is required except on loopback, which is the one exception Google itself makes for local
 * development. `localhost` over plain http is therefore allowed; any other plain-http host is a
 * configuration error rather than something to tolerate.
 */
function isUsableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash.length > 0 || url.search.length > 0) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol !== "http:") return false;
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/** Read Hebun's Google application configuration, or say exactly which key is wrong. */
export function resolveGoogleOAuthEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GoogleOAuthResolution {
  assertServerOnly();

  const clientId = env[GOOGLE_OAUTH_ENV_KEYS.clientId]?.trim();
  const clientSecret = env[GOOGLE_OAUTH_ENV_KEYS.clientSecret]?.trim();
  const redirectUri = env[GOOGLE_OAUTH_ENV_KEYS.redirectUri]?.trim();
  const stateSecret = env[GOOGLE_OAUTH_ENV_KEYS.stateSecret]?.trim();

  const missingKeys = Object.values(GOOGLE_OAUTH_ENV_KEYS).filter((key) => !env[key]?.trim());
  if (missingKeys.length > 0) {
    return Object.freeze({ status: "invalid" as const, missingKeys, invalidKeys: [] });
  }

  const invalidKeys: string[] = [];
  if (!isUsableRedirectUri(redirectUri!)) invalidKeys.push(GOOGLE_OAUTH_ENV_KEYS.redirectUri);
  if (stateSecret!.length < MIN_STATE_SECRET_LENGTH) {
    invalidKeys.push(GOOGLE_OAUTH_ENV_KEYS.stateSecret);
  }
  if (invalidKeys.length > 0) {
    return Object.freeze({ status: "invalid" as const, missingKeys: [], invalidKeys });
  }

  return Object.freeze({
    status: "configured" as const,
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    stateSecret: stateSecret!,
  });
}

/**
 * Whether Google can be offered at all — a BOOLEAN, so a surface can render "Connect" or "not
 * configured" without the configuration passing anywhere near a component.
 */
export function isGoogleOAuthConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return resolveGoogleOAuthEnvironment(env).status === "configured";
}

/**
 * A non-reversible fingerprint of the CLIENT ID, for operator diagnostics.
 *
 * The client id is not a secret — it appears in every authorization URL a browser sees — but there
 * is still no reason to print it, and a digest lets an operator confirm two environments agree
 * without either of them quoting configuration at each other.
 */
export function googleClientFingerprint(resolution: ConfiguredGoogleOAuth): string {
  return createHash("sha256").update(resolution.clientId).digest("hex").slice(0, 12);
}
