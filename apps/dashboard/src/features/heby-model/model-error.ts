/*
 * heby-model/model-error.ts — typed, redacted model-connectivity failures.
 *
 * Every failure in the model-connectivity layer is one of these codes. Messages
 * are safe by construction: no credential, secret, API key, or request header is
 * ever placed in an error. Retryability is declared explicitly; this layer does
 * NOT implement hidden retry loops — a caller (or a later phase that owns retry
 * policy) decides, and R2B prefers deterministic failure.
 */

export type ModelConnectivityErrorCode =
  | "connectivity-disabled"
  | "invalid-configuration"
  | "missing-credential"
  | "transport-unavailable"
  | "authentication-failed"
  | "timeout"
  | "rate-limited"
  | "provider-unavailable"
  | "malformed-response"
  | "unknown-provider-error";

const RETRYABLE: ReadonlySet<ModelConnectivityErrorCode> = new Set([
  "timeout",
  "rate-limited",
  "provider-unavailable",
]);

export class ModelConnectivityError extends Error {
  readonly code: ModelConnectivityErrorCode;
  readonly retryable: boolean;

  constructor(code: ModelConnectivityErrorCode, message?: string) {
    // The message is a fixed, safe description — never interpolated with secrets.
    super(message ?? code);
    this.name = "ModelConnectivityError";
    this.code = code;
    this.retryable = RETRYABLE.has(code);
  }
}

/**
 * Redact anything that could carry a secret out of an arbitrary thrown value.
 * The connectivity layer only ever surfaces a code + a static safe message, so a
 * raw provider/transport error is never propagated verbatim.
 */
export function toSafeConnectivityError(
  error: unknown,
  fallback: ModelConnectivityErrorCode = "unknown-provider-error",
): ModelConnectivityError {
  if (error instanceof ModelConnectivityError) return error;
  return new ModelConnectivityError(fallback);
}
