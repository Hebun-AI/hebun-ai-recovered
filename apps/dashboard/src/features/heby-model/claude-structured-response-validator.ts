/*
 * heby-model/claude-structured-response-validator.ts — the generic gate for a STRUCTURED transport
 * response (RELEVANCE-2A).
 *
 * The sibling of `claude-response-validator.ts`, which stays the gate for every text answer and is
 * unchanged. This one answers a narrower question: did the transport complete a structured request
 * and hand back a JSON object? It does not know what the object means. Shape, membership and limits
 * belong to the consumer that asked for the object — a provider's schema enforcement, when one is
 * eventually accepted, is not a substitute for that consumer's own validation.
 *
 * Fail closed:
 *   - no structured value, or a value that is not a plain object        → malformed-response
 *   - the answer stopped because it ran out of tokens                    → malformed-response
 *     (a truncated object is not an object the caller asked for)
 *   - the provider refused                                               → malformed-response
 *   - impossible token counts                                            → malformed-response
 *
 * It never parses text into an object. A text answer that happens to contain JSON is not a
 * structured answer, so leading-JSON or fenced-JSON recovery has no place here.
 */

import { ModelConnectivityError } from "./model-error";
import type { ClaudeTransportResponse } from "./claude-transport";

export interface StructuredValidationExpectation {
  readonly requestedModel: string;
}

/** A completed structured answer. `value` is an object of unknown shape — the consumer decides. */
export interface ClaudeStructuredResult {
  readonly value: Readonly<Record<string, unknown>>;
  readonly model: string;
  readonly providerRequestId?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly stopReason?: string;
}

/** Stop reasons after which an object cannot be trusted to be the whole answer. */
const INCOMPLETE_STOP_REASONS: ReadonlySet<string> = new Set(["max_tokens", "refusal"]);

function tokenCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw new ModelConnectivityError("malformed-response", "Provider returned an impossible token count.");
  }
  return value;
}

export function validateClaudeStructuredResponse(
  response: ClaudeTransportResponse,
  expectation: StructuredValidationExpectation,
): ClaudeStructuredResult {
  const stopReason =
    typeof response.stopReason === "string" && response.stopReason.length > 0 ? response.stopReason : undefined;
  if (stopReason !== undefined && INCOMPLETE_STOP_REASONS.has(stopReason)) {
    throw new ModelConnectivityError("malformed-response", "The structured answer did not complete.");
  }
  const value = response.structured;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ModelConnectivityError("malformed-response", "Provider response carried no structured object.");
  }
  return Object.freeze({
    value: value as Readonly<Record<string, unknown>>,
    model: typeof response.model === "string" && response.model.length > 0 ? response.model : expectation.requestedModel,
    providerRequestId: typeof response.id === "string" && response.id.length > 0 ? response.id : undefined,
    inputTokens: tokenCount(response.usage?.inputTokens),
    outputTokens: tokenCount(response.usage?.outputTokens),
    stopReason,
  });
}
