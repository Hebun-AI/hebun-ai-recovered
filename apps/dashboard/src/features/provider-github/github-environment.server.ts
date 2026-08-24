/*
 * provider-github/github-environment.server.ts — HEBUN'S OWN GITHUB APP.
 *
 * ── TWO SECRET CLASSES, AND THIS FILE OWNS EXACTLY ONE ───────────────────────
 *
 * DEPLOYMENT-OWNED (here): the App id, the App private key, the App slug, the configured setup
 * URL, and the state-signing secret. They identify HEBUN to GitHub, they are the same for every
 * tenant, they live in the environment, and they must NEVER reach `integration_credentials`.
 *
 * TENANT-OWNED (not here, and for GitHub not anywhere): Google needed a vault because a tenant's
 * grant IS a refresh token that Hebun holds. GitHub's grant is an INSTALLATION — a fact stored on
 * GitHub's side, referenced by an id. There is no tenant secret to keep, so this provider stores
 * none, and `integration_credentials` gains no row and no new kind.
 *
 * ── THE PRIVATE KEY IS THE MOST DANGEROUS VALUE IN THIS REPOSITORY ───────────
 *
 * It signs assertions that Hebun IS this GitHub App, for every installation on every organization
 * that has ever installed it. It is read here, held only as a `KeyObject` for the length of one
 * signature, and it is never returned from this module, never logged, never audited, never sent to
 * a client and never persisted. `resolveGitHubAppEnvironment` returns the key material; every
 * caller is server-only and a test asserts no client module can reach any of them.
 *
 * ── THE SETUP URL IS CONFIGURED, NEVER DERIVED ───────────────────────────────
 *
 * The same lesson INT-3 earned for Google's redirect URI, and it applies harder here: GitHub
 * redirects to the Setup URL registered in the App console, so a value Hebun derived from a `Host`
 * header would simply disagree with the provider. It is read from configuration and used verbatim,
 * and it exists here so the origin of the post-installation redirect is a configured fact rather
 * than a header an attacker can set.
 *
 * ── FAIL CLOSED ──────────────────────────────────────────────────────────────
 *
 * Absent, blank or malformed configuration yields `invalid`, and every GitHub surface refuses.
 * There is NO development fallback, NO generated state secret, NO default App id and NO generated
 * key. A generated state secret would silently accept states signed by a previous process; a
 * placeholder App id would fail at GitHub after a human had already installed the App on a real
 * organization, which is the worst possible moment to discover a configuration error.
 *
 * Server-only. Nothing here is ever returned to a client or written to a log.
 */
import { createPrivateKey, type KeyObject } from "node:crypto";

export const GITHUB_APP_ENV_KEYS = {
  appId: "HEBUN_GITHUB_APP_ID",
  privateKey: "HEBUN_GITHUB_APP_PRIVATE_KEY",
  /** The `github.com/apps/<slug>` segment. Needed to build the installation URL, and nothing else. */
  appSlug: "HEBUN_GITHUB_APP_SLUG",
  /** Registered in the GitHub App console. Compared with nothing; used as the redirect origin. */
  setupUrl: "HEBUN_GITHUB_SETUP_URL",
  /**
   * DEDICATED, and deliberately neither the session digest key nor Google's state secret. One
   * secret, one purpose: a key reused across two authentication contexts lets a value minted for
   * one be presented to the other.
   */
  stateSecret: "HEBUN_GITHUB_INSTALL_STATE_SECRET",
} as const;

/** 32 bytes of entropy, base64 — the shape `openssl rand -base64 32` produces. */
const MIN_STATE_SECRET_LENGTH = 32;

export interface ConfiguredGitHubApp {
  readonly status: "configured";
  /** GitHub's numeric App id, as a string — it is a JWT claim, never arithmetic. */
  readonly appId: string;
  readonly appSlug: string;
  readonly setupUrl: string;
  readonly stateSecret: string;
  /**
   * THE KEY AS A `KeyObject`, NEVER AS A STRING.
   *
   * A `KeyObject` does not serialise into a log line, a JSON body or an error message the way a
   * PEM string does — `JSON.stringify` of one yields `{}`. That is not a substitute for not
   * logging it, it is one more thing that has to go wrong before the key leaves the process.
   */
  readonly privateKey: KeyObject;
}

export type GitHubAppResolution =
  | ConfiguredGitHubApp
  | {
      readonly status: "invalid";
      readonly missingKeys: readonly string[];
      /** Env var NAMES only. Never a value, never a fragment of one. */
      readonly invalidKeys: readonly string[];
    };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The GitHub App environment is server-only.");
  }
}

/**
 * A setup URL GitHub could actually have been registered with.
 *
 * `https` is required except on loopback, which is the one exception a local development flow
 * needs. Any other plain-http host is a configuration error rather than something to tolerate.
 */
function isUsableSetupUrl(value: string): boolean {
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

/**
 * ── WHY THE KEY IS NORMALISED BEFORE PARSING ─────────────────────────────────
 *
 * GitHub issues a PEM file with real newlines. Most environment-variable UIs — Vercel's included —
 * accept a pasted multi-line value, but plenty of deployment tooling flattens it to a single line
 * with literal backslash-n sequences instead. Both spellings describe the same key, and refusing
 * the flattened one would be Hebun failing on a formatting detail rather than on a real problem.
 *
 * So a literal `\n` two-character sequence is converted to a newline before parsing. Nothing else
 * about the value is altered, and if the result is not a private key `createPrivateKey` throws and
 * the whole configuration reports invalid.
 *
 * PKCS#1 (`BEGIN RSA PRIVATE KEY`, which is what GitHub's console downloads) and PKCS#8
 * (`BEGIN PRIVATE KEY`) are both accepted, because `createPrivateKey` reads both and refusing one
 * would only force an operator to convert a key by hand for no security gain.
 */
function parsePrivateKey(raw: string): KeyObject | null {
  const pem = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  try {
    const key = createPrivateKey(pem);
    /* RS256 is required by GitHub. An EC or Ed25519 key would parse and then sign nothing usable. */
    if (key.asymmetricKeyType !== "rsa" && key.asymmetricKeyType !== "rsa-pss") return null;
    return key;
  } catch {
    return null;
  }
}

/** Present, non-blank, and not a quoted empty string. */
function readEnv(key: string): string | null {
  const value = process.env[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve Hebun's GitHub App configuration, or report exactly which variables are missing or
 * malformed — BY NAME, never by value.
 *
 * The distinction between `missingKeys` and `invalidKeys` is the one INT-4's incident showed was
 * worth having: "you did not set it" and "you set it to something unusable" are different problems
 * with different fixes, and an operator who cannot tell them apart has to read the values.
 */
export function resolveGitHubAppEnvironment(): GitHubAppResolution {
  assertServerOnly();

  const appId = readEnv(GITHUB_APP_ENV_KEYS.appId);
  const rawKey = readEnv(GITHUB_APP_ENV_KEYS.privateKey);
  const appSlug = readEnv(GITHUB_APP_ENV_KEYS.appSlug);
  const setupUrl = readEnv(GITHUB_APP_ENV_KEYS.setupUrl);
  const stateSecret = readEnv(GITHUB_APP_ENV_KEYS.stateSecret);

  const missingKeys: string[] = [];
  const invalidKeys: string[] = [];

  if (!appId) missingKeys.push(GITHUB_APP_ENV_KEYS.appId);
  else if (!/^[1-9][0-9]{0,19}$/.test(appId)) invalidKeys.push(GITHUB_APP_ENV_KEYS.appId);

  if (!rawKey) missingKeys.push(GITHUB_APP_ENV_KEYS.privateKey);

  if (!appSlug) missingKeys.push(GITHUB_APP_ENV_KEYS.appSlug);
  /* GitHub slugs are lowercase alphanumerics and hyphens. It lands in a URL path, so it is bounded. */
  else if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(appSlug)) invalidKeys.push(GITHUB_APP_ENV_KEYS.appSlug);

  if (!setupUrl) missingKeys.push(GITHUB_APP_ENV_KEYS.setupUrl);
  else if (!isUsableSetupUrl(setupUrl)) invalidKeys.push(GITHUB_APP_ENV_KEYS.setupUrl);

  if (!stateSecret) missingKeys.push(GITHUB_APP_ENV_KEYS.stateSecret);
  else if (stateSecret.length < MIN_STATE_SECRET_LENGTH) {
    invalidKeys.push(GITHUB_APP_ENV_KEYS.stateSecret);
  }

  /* Parsed LAST, and only when present, so a malformed key is reported without a throw escaping. */
  let privateKey: KeyObject | null = null;
  if (rawKey) {
    privateKey = parsePrivateKey(rawKey);
    if (!privateKey) invalidKeys.push(GITHUB_APP_ENV_KEYS.privateKey);
  }

  if (missingKeys.length > 0 || invalidKeys.length > 0 || !privateKey) {
    return { status: "invalid", missingKeys, invalidKeys };
  }

  return {
    status: "configured",
    appId: appId!,
    appSlug: appSlug!,
    setupUrl: setupUrl!,
    stateSecret: stateSecret!,
    privateKey,
  };
}

/**
 * Whether this deployment could start a GitHub installation at all.
 *
 * A BOOLEAN, and nothing more. A surface needs to know whether to offer the act; it does not need
 * the App id, the slug, the setup URL or any hint about which variable is missing. Returning the
 * resolution itself would put a `KeyObject` one careless spread away from a React component.
 */
export function isGitHubAppConfigured(): boolean {
  return resolveGitHubAppEnvironment().status === "configured";
}
