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

/**
 * THE ONE OUTPUT-TOKEN CEILING (R2G — K-1).
 *
 * ── THE CONTRADICTION THIS REPLACES ──────────────────────────────────────────
 *
 * Two constants used to disagree, in two features, with nothing connecting them: the default
 * here was 1024, and the live transport refused anything above 300. Because
 * `answerHebyModelRequest` sends `maxOutputTokens: 0`, the generation boundary always fell back
 * to the default — so a deployment that set the credential and every flag correctly would have
 * had EVERY live call refused with `invalid-configuration`, before any network I/O, forever. The
 * failure was safe and typed. It was also silent, and it was guaranteed.
 *
 * A default that the only real transport will always reject is not a default; it is a trap.
 *
 * ── WHY THE CEILING LIVES HERE AND NOT IN THE TRANSPORT ──────────────────────
 *
 * This module is the configuration authority for model connectivity, and the bound is
 * configuration. The live transport keeps enforcing it — defence in depth, and it is the last
 * thing before the wire — but it no longer *defines* it: it imports this constant, so the two
 * cannot drift apart again. The import is direct (file, not index) because `heby-model`'s index
 * already re-exports the transport selector, which reaches into `heby-model-live`.
 *
 * ── WHY 300 AND NOT 1024 ─────────────────────────────────────────────────────
 *
 * The conservative number wins because it is the one that was actually reasoned about: 300 was
 * chosen for the live path as a spend bound, and raising it would widen real external spend to
 * make a default convenient. Lowering the default costs nothing that has ever run. If a real
 * provider answer turns out not to fit the response validator's four provenance facets inside
 * 300 tokens, that is a MEASURED finding for the acceptance gate to report — not a reason to
 * pre-emptively widen the bound here.
 */
export const MODEL_OUTPUT_TOKEN_CEILING = 300;

/**
 * Default output bound when the variable is unset but connectivity is enabled.
 *
 * It IS the ceiling, deliberately: the default must be a value the live transport accepts, and
 * there is no second sensible number between "something smaller for no reason" and the bound.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = MODEL_OUTPUT_TOKEN_CEILING;

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
 * Resolve the configured output bound, FAIL-CLOSED, and WITHOUT a provider call.
 *
 * ABSENT      → the default (which is the ceiling).
 * PRESENT and a positive integer at or below the ceiling → that value.
 * PRESENT and anything else — garbage, zero, or a number ABOVE the ceiling → `0`.
 *
 * Zero is not a magic number here: `evaluateModelAvailability` already treats
 * `maxOutputTokens <= 0` as MISCONFIGURED, so an operator typo becomes an honest closed state
 * at the availability gate rather than a refusal at the wire. That matters because the two
 * failures look identical to a Director and are not the same thing — one is "you configured
 * something impossible", the other is "the provider rejected us".
 *
 * An over-ceiling value is REFUSED, never clamped. Clamping would silently answer a different
 * question than the operator asked, and a spend bound is exactly the wrong place to guess.
 */
function resolveOutputBound(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_MAX_OUTPUT_TOKENS;
  const parsed = parsePositiveInt(raw);
  if (parsed === undefined || parsed > MODEL_OUTPUT_TOKEN_CEILING) return 0;
  return parsed;
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
  const maxOutputTokens = resolveOutputBound(
    env[MODEL_CONNECTIVITY_ENV_KEYS.maxOutputTokens],
  );

  return Object.freeze({
    enabled,
    provider,
    modelId,
    credentialPresent,
    maxOutputTokens,
  });
}
