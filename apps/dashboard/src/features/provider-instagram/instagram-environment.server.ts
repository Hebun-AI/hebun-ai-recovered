/*
 * provider-instagram/instagram-environment.server.ts — HEBUN'S OWN INSTAGRAM APPLICATION.
 *
 * ── THE SAME TWO SECRET CLASSES THE GOOGLE MODULE NAMES ─────────────────────
 *
 * DEPLOYMENT-OWNED (here): the Instagram App id, the App secret, the registered redirect URI and
 * the state-signing secret. They identify HEBUN to Meta, they are identical for every tenant, and
 * they must NEVER reach `integration_credentials`.
 *
 * TENANT-OWNED (not here): the access token a human authorized. It identifies ONE TENANT'S Instagram
 * account, it differs per tenant, and it lives only in the credential vault. It must never reach the
 * environment.
 *
 * This file is a second instance of that boundary, not a second authority: it reads four variables
 * and answers one question. It stores nothing, opens nothing and decides no lifecycle.
 *
 * ── THE REDIRECT URI IS CONFIGURED, NEVER DERIVED ───────────────────────────
 *
 * Read verbatim from the environment. NOT built from `Host`, `x-forwarded-host` or any
 * `NEXT_PUBLIC_*` value. A redirect URI derived from a header an attacker can set is the
 * redirect-confusion vector, and Meta's exact-match requirement only protects Hebun if the value
 * sent is the value registered rather than the value we were told.
 *
 * ── AND IT IS STRICTER THAN GOOGLE'S ON ONE POINT ───────────────────────────
 *
 * Google's module permits plain http on loopback, because Google itself makes that exception for
 * local development. Meta does not: Instagram requires an HTTPS redirect URI. Copying Google's
 * loopback exception here would produce a configuration Meta rejects AFTER a human has already
 * consented, so `https` is required unconditionally. This is a real difference between two
 * providers, discovered rather than assumed.
 *
 * ── FAIL CLOSED ─────────────────────────────────────────────────────────────
 *
 * Absent, blank or malformed configuration yields `invalid`, and every Instagram OAuth surface
 * refuses. There is NO development fallback, NO generated state secret and NO default redirect URI.
 * A generated state secret would silently accept states signed by a previous process.
 *
 * A CONFIG CONTRACT IS NOT A CONFIGURATION. This file existing means Hebun knows what it would need.
 * It says nothing about whether any deployment has it.
 *
 * Server-only. Nothing here is ever returned to a client or written to a log.
 */
import { createHash } from "node:crypto";

export const INSTAGRAM_OAUTH_ENV_KEYS = {
  clientId: "INSTAGRAM_OAUTH_CLIENT_ID",
  clientSecret: "INSTAGRAM_OAUTH_CLIENT_SECRET",
  redirectUri: "INSTAGRAM_OAUTH_REDIRECT_URI",
  /**
   * DEDICATED. Not the session digest key, and not Google's state secret: one key serving two
   * authentication contexts lets a value minted for one be presented to the other.
   */
  stateSecret: "HEBUN_INSTAGRAM_OAUTH_STATE_SECRET",
} as const;

/** 32 bytes of entropy, base64 — the shape `openssl rand -base64 32` produces. */
const MIN_STATE_SECRET_LENGTH = 32;

export interface ConfiguredInstagramOAuth {
  readonly status: "configured";
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly stateSecret: string;
}

export type InstagramOAuthResolution =
  | ConfiguredInstagramOAuth
  | {
      readonly status: "invalid";
      readonly missingKeys: readonly string[];
      /** Env var NAMES only. Never a value, never a fragment of one. */
      readonly invalidKeys: readonly string[];
    };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Instagram OAuth environment is server-only.");
  }
}

/**
 * A redirect URI Meta could actually have registered.
 *
 * HTTPS ONLY — see the header. A query string or fragment is refused too: Meta compares the URI
 * exactly, and a redirect URI carrying state is a redirect URI somebody will later be tempted to
 * vary per request.
 */
function isUsableRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash.length > 0 || url.search.length > 0) return false;
  return url.protocol === "https:";
}

/** Read Hebun's Instagram application configuration, or say exactly which key is wrong. */
export function resolveInstagramOAuthEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): InstagramOAuthResolution {
  assertServerOnly();

  const clientId = env[INSTAGRAM_OAUTH_ENV_KEYS.clientId]?.trim();
  const clientSecret = env[INSTAGRAM_OAUTH_ENV_KEYS.clientSecret]?.trim();
  const redirectUri = env[INSTAGRAM_OAUTH_ENV_KEYS.redirectUri]?.trim();
  const stateSecret = env[INSTAGRAM_OAUTH_ENV_KEYS.stateSecret]?.trim();

  const missingKeys = Object.values(INSTAGRAM_OAUTH_ENV_KEYS).filter((key) => !env[key]?.trim());
  if (missingKeys.length > 0) {
    return Object.freeze({ status: "invalid" as const, missingKeys, invalidKeys: [] });
  }

  const invalidKeys: string[] = [];
  if (!isUsableRedirectUri(redirectUri!)) invalidKeys.push(INSTAGRAM_OAUTH_ENV_KEYS.redirectUri);
  if (stateSecret!.length < MIN_STATE_SECRET_LENGTH) {
    invalidKeys.push(INSTAGRAM_OAUTH_ENV_KEYS.stateSecret);
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
 * Whether Instagram can be offered at all — a BOOLEAN, so a surface can render "Connect" or "not
 * configured" without the configuration passing anywhere near a component.
 */
export function isInstagramOAuthConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return resolveInstagramOAuthEnvironment(env).status === "configured";
}

/**
 * A non-reversible fingerprint of the APP ID, for operator diagnostics.
 *
 * The App id is not a secret — it appears in every authorization URL a browser sees — but there is
 * still no reason to print it, and a digest lets an operator confirm two environments agree without
 * either of them quoting configuration at each other.
 */
export function instagramClientFingerprint(resolution: ConfiguredInstagramOAuth): string {
  return createHash("sha256").update(resolution.clientId).digest("hex").slice(0, 12);
}
