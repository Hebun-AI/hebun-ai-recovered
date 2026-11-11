/*
 * P5 BYOK — the customer's own Anthropic key (design gate `hebun-p5-byok-design-gate.md`, B1/B2).
 *
 * Pure: constants and one shape check, importable from anywhere and reaching nothing.
 *
 * `anthropic` is a CREDENTIAL-ONLY provider (`accountIdentity: "none"`), exactly like YouTube: the
 * connection holds one `api_key` and binds no account. The key is the TENANT's (B2) and lives in the
 * released encrypted credential store; no other place may hold it.
 */

export const ANTHROPIC_PROVIDER_KEY = "anthropic" as const;
export const ANTHROPIC_PROVIDER_LABEL = "Anthropic" as const;
export const ANTHROPIC_CONNECTION_NAME = "Anthropic (customer key)" as const;

/** The one capability a customer key will carry once verification and selection exist (B1). */
export const ANTHROPIC_MODEL_MESSAGES_CAPABILITY = "anthropic.model.messages" as const;

/**
 * A SHAPE check, not verification. It refuses obvious mistakes (a pasted sentence, an OpenAI key,
 * whitespace) before anything is sealed; whether the provider accepts the key is B5's verification
 * call, which needs its own approval. Bounds are generous so a future key format still passes.
 */
export const ANTHROPIC_KEY_PREFIX = "sk-ant-" as const;
const KEY_RE = /^sk-ant-[A-Za-z0-9_-]{20,500}$/;

export function isPlausibleAnthropicKey(value: string): boolean {
  return KEY_RE.test(value);
}
