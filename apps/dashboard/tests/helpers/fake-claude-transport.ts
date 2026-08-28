/*
 * Fake Claude transport (tests only). Deterministic, NO network, NO SDK. It
 * records the translated request so tests can assert request translation, and it
 * produces controlled success/failure scenarios so the whole client + validator +
 * generation lifecycle is provable without ever reaching a provider.
 */

import {
  ModelConnectivityError,
  type ClaudeTransport,
  type ClaudeTransportRequest,
  type ClaudeTransportResponse,
} from "../../src/features/heby-model";

export type FakeClaudeScenario =
  | "success"
  | "success-no-usage"
  | "success-no-request-id"
  /*
   * AGENT-PROPOSAL-4A. A REAL transport response whose ANSWER the released response validator
   * refuses: the text claims an action Heby may never claim. The provider returned and the usage
   * is real, so a `ModelGenerationResult` exists — only the answer is withheld. This is the one
   * scenario that separates "a model was asked" from "a model answer was served".
   */
  | "success-invalid-answer"
  | "missing-text"
  | "malformed-empty-content"
  | "timeout"
  | "auth-failure"
  | "rate-limit"
  | "provider-unavailable"
  | "opaque-error";

export interface FakeClaudeTransport extends ClaudeTransport {
  /** The last request the client sent through this transport. */
  lastRequest?: ClaudeTransportRequest;
  /** How many times send() was called. */
  calls: number;
}

function successResponse(
  request: ClaudeTransportRequest,
  opts: { usage: boolean; requestId: boolean },
): ClaudeTransportResponse {
  return {
    id: opts.requestId ? "req_fake_0001" : undefined,
    model: request.model,
    content: [{ type: "text", text: `Deterministic fake answer for: ${request.messages[0]?.content ?? ""}` }],
    stopReason: "end_turn",
    usage: opts.usage ? { inputTokens: 42, outputTokens: 7 } : undefined,
  };
}

export function createFakeClaudeTransport(
  scenario: FakeClaudeScenario,
): FakeClaudeTransport {
  const transport: FakeClaudeTransport = {
    calls: 0,
    lastRequest: undefined,
    async send(request: ClaudeTransportRequest): Promise<ClaudeTransportResponse> {
      transport.calls += 1;
      transport.lastRequest = request;

      switch (scenario) {
        case "success":
          return successResponse(request, { usage: true, requestId: true });
        case "success-no-usage":
          return successResponse(request, { usage: false, requestId: true });
        case "success-no-request-id":
          return successResponse(request, { usage: true, requestId: false });
        case "success-invalid-answer":
          return {
            id: "req_fake_0003",
            model: request.model,
            content: [
              {
                type: "text",
                text: "I have executed the request and the change was deployed.",
              },
            ],
            stopReason: "end_turn",
            usage: { inputTokens: 42, outputTokens: 7 },
          };
        case "missing-text":
          return {
            id: "req_fake_0002",
            model: request.model,
            content: [{ type: "text" }],
            stopReason: "end_turn",
          };
        case "malformed-empty-content":
          return {
            id: "req_fake_0003",
            model: request.model,
            content: [],
          };
        case "timeout":
          throw new ModelConnectivityError("timeout", "Fake transport timed out.");
        case "auth-failure":
          throw new ModelConnectivityError(
            "authentication-failed",
            "Fake transport rejected credentials.",
          );
        case "rate-limit":
          throw new ModelConnectivityError("rate-limited", "Fake transport rate limited.");
        case "provider-unavailable":
          throw new ModelConnectivityError(
            "provider-unavailable",
            "Fake transport provider unavailable.",
          );
        case "opaque-error":
          // A raw, non-typed error — must be redacted to unknown-provider-error.
          throw new Error("secret-header: sk-should-never-surface");
      }
    },
  };
  return transport;
}
