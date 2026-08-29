/*
 * heby-model/claude-model-client.ts — Claude-specific client over the neutral seam.
 *
 * Translates a provider-neutral ModelGenerationRequest into a Claude transport
 * request, delegates the actual send to an INJECTED transport (never owning the
 * network itself), then validates the response into a provider-neutral result. It
 * measures real latency and maps any transport failure to a safe, typed
 * connectivity error. With the default transport this cannot reach a provider.
 */

import type { ModelGenerationRequest, ModelGenerationResult } from "@/features/heby-runtime";
import { GROUNDING_CONTEXT_PREFIX } from "@/features/heby-runtime";
import { ModelConnectivityError, toSafeConnectivityError } from "./model-error";
import {
  unavailableClaudeTransport,
  type ClaudeTransport,
  type ClaudeTransportRequest,
} from "./claude-transport";
import { validateClaudeResponse } from "./claude-response-validator";

export interface ClaudeModelClient {
  generate(request: ModelGenerationRequest): Promise<ModelGenerationResult>;
}

export interface ClaudeModelClientDeps {
  readonly provider: string;
  /** Defaults to the no-network transport, so a missing transport fails closed. */
  readonly transport?: ClaudeTransport;
}

/**
 * Compose the Claude transport request. Evidence is folded into the system
 * message as clearly-delimited grounding CONTEXT (data), never mixed into the
 * user turn as instructions.
 *
 * THIS IS WHERE TB-1'S TYPED SEPARATION MEETS THE PROVIDER API. Up to here, instruction, question,
 * evidence and history are four separate fields of `ModelGenerationRequest`. The Claude API takes
 * one `system` string, so trusted instruction and untrusted content are concatenated here — and
 * from this line onward the separation is a delimiter the model is asked to respect rather than
 * anything the provider enforces. `MODEL_CONTEXT_BOUNDARY` records that limit rather than implying
 * it away, and the delimiter itself is owned by the boundary module rather than spelled here, so
 * an unrelated edit to this file cannot quietly reword the marker.
 *
 * Evidence stays in `system`. It must never move into a message turn, where it would sit exactly
 * where the operator's own words go.
 */
function translate(request: ModelGenerationRequest): ClaudeTransportRequest {
  const system =
    request.evidence.length > 0
      ? `${request.systemInstructions}\n\n${GROUNDING_CONTEXT_PREFIX}\n${request.evidence
          .map((line, index) => `[${index + 1}] ${line}`)
          .join("\n")}`
      : request.systemInstructions;

  // Bounded recent history (oldest→newest) is prepended as prior conversational turns, then the
  // current user request is the final turn. History is DATA for continuity only — the system
  // message (above) states it is not authoritative evidence. Evidence stays in `system`, never
  // mixed into a turn. An absent/empty history yields exactly the previous single-message shape.
  const history = request.history ?? [];
  const messages = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user" as const, content: request.userPrompt },
  ];

  return {
    model: request.modelId,
    system,
    messages,
    maxTokens: request.maxOutputTokens,
  };
}

export function createClaudeModelClient(
  deps: ClaudeModelClientDeps,
): ClaudeModelClient {
  const transport = deps.transport ?? unavailableClaudeTransport;

  return {
    async generate(request: ModelGenerationRequest): Promise<ModelGenerationResult> {
      const transportRequest = translate(request);
      const startedAt = Date.now();
      let raw;
      try {
        raw = await transport.send(transportRequest);
      } catch (error) {
        // Never propagate a raw transport/provider error (it may carry headers).
        throw toSafeConnectivityError(error);
      }
      const latencyMs = Math.max(0, Date.now() - startedAt);
      const validated = validateClaudeResponse(raw, {
        provider: deps.provider,
        requestedModel: request.modelId,
        correlationId: request.correlationId,
      });
      return Object.freeze({ ...validated, latencyMs });
    },
  };
}

export { ModelConnectivityError };
