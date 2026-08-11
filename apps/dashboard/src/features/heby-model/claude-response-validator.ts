/*
 * heby-model/claude-response-validator.ts — the provider-output validation gate.
 *
 * All transport output crosses this boundary before it can become a
 * ModelGenerationResult. It rejects empty/malformed content and impossible token
 * counts, and never lets an arbitrary provider object leak through: it returns a
 * narrow, typed, provider-neutral result. Unknown provider values stay undefined
 * — never invented.
 */

import type { ModelGenerationResult } from "@/features/heby-runtime";
import { ModelConnectivityError } from "./model-error";
import type { ClaudeTransportResponse } from "./claude-transport";

export interface ValidationExpectation {
  readonly provider: string;
  readonly requestedModel: string;
  readonly correlationId: string;
}

function optionalTokenCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 0) {
    throw new ModelConnectivityError(
      "malformed-response",
      "Provider returned an impossible token count.",
    );
  }
  return value;
}

/** Extract the concatenated text from the content blocks, or fail closed. */
function extractText(response: ClaudeTransportResponse): string {
  if (!Array.isArray(response.content) || response.content.length === 0) {
    throw new ModelConnectivityError(
      "malformed-response",
      "Provider response had no content.",
    );
  }
  const text = response.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
  if (text.length === 0) {
    throw new ModelConnectivityError(
      "malformed-response",
      "Provider response contained no usable text.",
    );
  }
  return text;
}

/**
 * Validate a transport response into a narrow, untrusted model result. Latency
 * and correlation are supplied by the client (measured / request-scoped); token
 * usage and request id are preserved only when the provider actually returned
 * them.
 */
export function validateClaudeResponse(
  response: ClaudeTransportResponse,
  expectation: ValidationExpectation,
): ModelGenerationResult {
  const text = extractText(response);
  const inputTokens = optionalTokenCount(response.usage?.inputTokens);
  const outputTokens = optionalTokenCount(response.usage?.outputTokens);
  const totalTokens =
    inputTokens !== undefined && outputTokens !== undefined
      ? inputTokens + outputTokens
      : undefined;

  return Object.freeze({
    text,
    provider: expectation.provider,
    // The provider may echo a model id; when absent we report the requested one.
    model:
      typeof response.model === "string" && response.model.length > 0
        ? response.model
        : expectation.requestedModel,
    origin: "model",
    correlationId: expectation.correlationId,
    providerRequestId:
      typeof response.id === "string" && response.id.length > 0
        ? response.id
        : undefined,
    inputTokens,
    outputTokens,
    totalTokens,
    stopReason:
      typeof response.stopReason === "string" && response.stopReason.length > 0
        ? response.stopReason
        : undefined,
  });
}
