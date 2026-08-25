/*
 * heby-model — Hebun Runtime R2B: model connectivity FOUNDATION (server-only).
 *
 * Extends the Heby model boundary (`@/features/heby-runtime`) with an injectable,
 * provider-neutral connectivity layer: server-only configuration, an availability
 * evaluator, a Claude client over an injectable transport, a response validator,
 * and a typed error model. R2B ships NO network transport and NO SDK — the default
 * transport performs no I/O and fails closed, so nothing here can reach a live
 * provider. It never enables execution, tools, Computer Use, provider-invocation,
 * or runtime-activation, and holds no secret in any client-reachable surface.
 */

export {
  MODEL_CONNECTIVITY_ENV_KEYS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  MODEL_OUTPUT_TOKEN_CEILING,
  resolveModelConnectivityConfig,
  type ModelConnectivityConfig,
} from "./model-connectivity-environment.server";
export {
  evaluateModelAvailability,
  type AvailabilityInputs,
} from "./model-availability";
export {
  ModelConnectivityError,
  toSafeConnectivityError,
  type ModelConnectivityErrorCode,
} from "./model-error";
export {
  unavailableClaudeTransport,
  type ClaudeTransport,
  type ClaudeTransportMessage,
  type ClaudeTransportRequest,
  type ClaudeTransportResponse,
  type ClaudeTransportUsage,
  type ClaudeTransportContentBlock,
} from "./claude-transport";
export {
  validateClaudeResponse,
  type ValidationExpectation,
} from "./claude-response-validator";
export {
  createClaudeModelClient,
  type ClaudeModelClient,
  type ClaudeModelClientDeps,
} from "./claude-model-client";
export {
  generateHebyModelAnswer,
  type HebyModelGenerationDeps,
  type HebyModelOutcome,
} from "./heby-model-generation.server";
export {
  selectModelTransport,
  MODEL_TRANSPORT_ENV_KEY,
  type ModelTransportSelection,
} from "./model-transport-selection.server";
