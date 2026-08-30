/*
 * provider-google/picker-environment.server.ts — THE GOOGLE PICKER'S TWO CONFIGURATION VALUES.
 *
 * ── NEITHER OF THESE IS A SECRET, AND SAYING SO IS THE POINT ─────────────────
 *
 * `google-environment.server.ts` owns Hebun's OAuth client id, client secret, redirect URI and
 * state secret. Three of those are deployment SECRETS and its header says exactly what happens if
 * they are put in the wrong home. This file owns something different, and classifying it correctly
 * matters as much as protecting the other kind:
 *
 *   GOOGLE_PICKER_API_KEY   a BROWSER API key. Google issues it to be sent by a browser, and it is
 *                           protected by an HTTP-referrer restriction rather than by concealment.
 *                           It is browser-safe CONFIGURATION.
 *   GOOGLE_PICKER_APP_ID    the Cloud PROJECT NUMBER. Google requires it as the Picker's app id so
 *                           it can associate a picked file with the app that will read it. It is a
 *                           public project identifier, not a credential.
 *
 * Both reach the browser BY DESIGN — the Picker runs there and cannot work without them. Treating
 * them as secrets would be a false claim in the other direction, and it would push somebody to
 * invent a proxy for values Google intends the client to hold.
 *
 * WHAT IS NOT HERE, AND MUST NEVER BE: the client secret, any refresh token, any credential
 * identifier, any vault material. This module reads two environment keys and nothing else.
 *
 * ── THE PROJECT MUST BE THE SAME ONE ─────────────────────────────────────────
 *
 * Google's requirement, recorded rather than assumed: the app id and the OAuth client id must
 * belong to the SAME Cloud project, because that pairing is what authorizes the app to read the
 * file the user picked. This module cannot verify that — a project number and a client id do not
 * compare — so it does not claim to. It is a deployment fact, stated here so it is not forgotten.
 *
 * ── FAIL CLOSED, LIKE ITS SIBLING ────────────────────────────────────────────
 *
 * Absent or blank configuration yields `unconfigured`, and the Picker surface says the Picker is
 * unavailable rather than rendering a control that will fail inside Google's own iframe. There is
 * no default key, no development fallback and no derivation from a request header.
 *
 * Server-only. The VALUES are browser-safe; reading the environment is not.
 */

export const GOOGLE_PICKER_ENV_KEYS = {
  /** Browser API key, referrer-restricted at Google. Browser-safe configuration. */
  apiKey: "GOOGLE_PICKER_API_KEY",
  /** Cloud project number. A public project identifier. Browser-safe configuration. */
  appId: "GOOGLE_PICKER_APP_ID",
} as const;

export type GooglePickerConfiguration =
  | { readonly status: "configured"; readonly apiKey: string; readonly appId: string }
  | { readonly status: "unconfigured"; readonly missingKeys: readonly string[] };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Google Picker environment is server-only.");
  }
}

/**
 * Read the Picker's configuration, or say exactly which key is absent.
 *
 * `missingKeys` carries env var NAMES only — the same rule the OAuth environment follows, and it
 * holds here even though these particular values are not secret, because a diagnostic that quotes
 * configuration teaches people to paste configuration into places it should not go.
 */
export function resolveGooglePickerEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): GooglePickerConfiguration {
  assertServerOnly();

  const missingKeys = Object.values(GOOGLE_PICKER_ENV_KEYS).filter((key) => !env[key]?.trim());
  if (missingKeys.length > 0) {
    return Object.freeze({ status: "unconfigured" as const, missingKeys: Object.freeze(missingKeys) });
  }

  return Object.freeze({
    status: "configured" as const,
    apiKey: env[GOOGLE_PICKER_ENV_KEYS.apiKey]!.trim(),
    appId: env[GOOGLE_PICKER_ENV_KEYS.appId]!.trim(),
  });
}

/** Whether the Picker can be offered at all — a BOOLEAN, so a surface can decide without the values. */
export function isGooglePickerConfigured(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return resolveGooglePickerEnvironment(env).status === "configured";
}
