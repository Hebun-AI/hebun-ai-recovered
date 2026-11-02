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
  /* AI-FAILURE-TRUTH-1 — historical. Rows hold it from when one code meant both a local refusal and a provider 4xx. No released path raises it now. */
  | "invalid-configuration"
  | "missing-credential"
  | "transport-unavailable"
  | "authentication-failed"
  | "timeout"
  /* AI-FAILURE-TRUTH-1 — historical, as `invalid-configuration` is: it meant both the instance cap and a provider 429. */
  | "rate-limited"
  /* AI-FAILURE-TRUTH-1 — the request asked for more output than the live ceiling; refused before any fetch. */
  | "output-bound-exceeded"
  /* AI-FAILURE-TRUTH-1 — this transport instance already made its one call; refused before any fetch. */
  | "transport-call-limit"
  /* AI-FAILURE-TRUTH-1 — fetch was attempted and no HTTP response came back. Whether the provider received it is unknown. */
  | "provider-unreachable"
  /* AI-FAILURE-TRUTH-1 — the provider answered HTTP 402 or `billing_error`. A 400 spend or credit refusal is not recognised here: free text is never read. */
  | "provider-billing"
  /* AI-FAILURE-TRUTH-1 — the provider answered HTTP 429. */
  | "provider-rate-limited"
  /* AI-FAILURE-TRUTH-1 — the provider answered another 4xx. The general refusal: it names no cause. */
  | "provider-request-rejected"
  /* B1-C — Hebun's own per-process live-call budget refused before any request went out. Not the provider's 429. */
  | "budget-exhausted"
  | "provider-unavailable"
  | "malformed-response"
  /* HEBY-PROMPT-INJECTION-BOUNDARY-1 — the data boundary of a request could not be stated, so it was not sent. */
  | "boundary-unavailable"
  | "unknown-provider-error";

const RETRYABLE: ReadonlySet<ModelConnectivityErrorCode> = new Set([
  "timeout",
  "rate-limited",
  "provider-unreachable",
  "provider-rate-limited",
  "provider-unavailable",
]);

/**
 * AI-FAILURE-TRUTH-1 — what a failure code proves about the request, and nothing more.
 *
 *   not-sent            — no `fetch` was attempted, so nothing reached the provider
 *   receipt-unknown     — `fetch` was attempted, or the code cannot say: the provider may have it
 *   provider-responded  — an HTTP response came back: the provider's side had the request
 *
 * None of these means the work completed. A provider response is not a finished act; that is what
 * the later states record. TOTAL over the code union, so a new code fails to compile here rather
 * than being silently filed as not sent.
 */
export type ModelDispatchFact = "not-sent" | "receipt-unknown" | "provider-responded";

export const MODEL_DISPATCH_FACTS: Readonly<Record<ModelConnectivityErrorCode, ModelDispatchFact>> = Object.freeze({
  "connectivity-disabled": "not-sent",
  "missing-credential": "not-sent",
  "transport-unavailable": "not-sent",
  "boundary-unavailable": "not-sent",
  "budget-exhausted": "not-sent",
  "output-bound-exceeded": "not-sent",
  "transport-call-limit": "not-sent",
  /* Historical codes cannot prove either side, so they never prove "not sent". */
  "invalid-configuration": "receipt-unknown",
  "rate-limited": "receipt-unknown",
  "unknown-provider-error": "receipt-unknown",
  timeout: "receipt-unknown",
  "provider-unreachable": "receipt-unknown",
  "authentication-failed": "provider-responded",
  "provider-billing": "provider-responded",
  "provider-rate-limited": "provider-responded",
  "provider-request-rejected": "provider-responded",
  "provider-unavailable": "provider-responded",
  "malformed-response": "provider-responded",
});

/**
 * One runtime-log line for a failed live request: closed values only. No tenant, no prompt, no
 * provider text. It is what makes a billing refusal findable on the paths that keep no failure row.
 */
export function modelFailureLogLine(code: ModelConnectivityErrorCode): string {
  return JSON.stringify({ event: "model-request-failed", code, dispatch: MODEL_DISPATCH_FACTS[code] });
}

/** The invocation state a connectivity failure may claim: `not-dispatched` only when nothing was sent. */
export function dispatchStateForFailure(code: ModelConnectivityErrorCode): "not-dispatched" | "dispatch-failed" {
  return MODEL_DISPATCH_FACTS[code] === "not-sent" ? "not-dispatched" : "dispatch-failed";
}

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
