/*
 * heby-model/model-connectivity-environment.server.ts — server-only config.
 *
 * The narrowest server-side configuration boundary for model connectivity. It
 * distinguishes: enabled/disabled, provider, model id, credential PRESENCE
 * (never the value), and an output bound. It mirrors the R1 auth-environment
 * discipline: server-only, no magic production default, fail-closed downstream.
 *
 * Discipline:
 * - Server only. Never import from client code.
 * - A model id never becomes "live" merely because a seeded Platform model
 *   record exists — configuration comes only from these explicit variables.
 * - The credential value is read once to compute a boolean and is otherwise
 *   never stored, returned, printed, logged, or sent to the client.
 * - R2B tests use SYNTHETIC credential values only; a real key is never required.
 */

export const MODEL_CONNECTIVITY_ENV_KEYS = {
  enabled: "HEBUN_MODEL_CONNECTIVITY_ENABLED",
  provider: "HEBUN_MODEL_PROVIDER",
  modelId: "HEBUN_MODEL_ID",
  /** Presence-only. Synthetic in R2B; a real key is introduced only at the live gate. */
  credential: "HEBUN_MODEL_CREDENTIAL",
  maxOutputTokens: "HEBUN_MODEL_MAX_OUTPUT_TOKENS",
} as const;

/** Default output bound when the variable is unset but connectivity is enabled. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export interface ModelConnectivityConfig {
  readonly enabled: boolean;
  readonly provider?: string;
  readonly modelId?: string;
  /** Whether a (synthetic or real) credential is present server-side. Never the value. */
  readonly credentialPresent: boolean;
  readonly maxOutputTokens: number;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Model connectivity environment is server-only.");
  }
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Resolve the model-connectivity configuration. Disabled unless the enable flag
 * is exactly "true". Never throws on missing values — it reports them, and the
 * availability evaluator fails closed.
 */
export function resolveModelConnectivityConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ModelConnectivityConfig {
  assertServerRuntime();

  const enabled = env[MODEL_CONNECTIVITY_ENV_KEYS.enabled] === "true";
  const provider = env[MODEL_CONNECTIVITY_ENV_KEYS.provider]?.trim() || undefined;
  const modelId = env[MODEL_CONNECTIVITY_ENV_KEYS.modelId]?.trim() || undefined;
  const credentialPresent = Boolean(
    env[MODEL_CONNECTIVITY_ENV_KEYS.credential]?.trim(),
  );
  const maxOutputTokens =
    parsePositiveInt(env[MODEL_CONNECTIVITY_ENV_KEYS.maxOutputTokens]) ??
    DEFAULT_MAX_OUTPUT_TOKENS;

  return Object.freeze({
    enabled,
    provider,
    modelId,
    credentialPresent,
    maxOutputTokens,
  });
}
