/*
 * heby-model/dev-proof-transport.server.ts — the explicit local PROOF transport (R2C).
 *
 * This is a deterministic, NO-network, NO-SDK simulation of a provider transport, used
 * ONLY to prove the authenticated end-to-end Heby model-answer PRODUCT FLOW without any
 * real provider. It is NEVER the default: it is returned solely when the operator sets an
 * explicit local flag (see model-transport-selection.server), and every answer it produces
 * is attributed as `transport: "fake"` so no surface can present it as a live Claude call.
 *
 * It performs no I/O of any kind. It echoes a bounded, clearly-simulated answer grounded in
 * the request the client actually sent, so the whole client → validator → response lifecycle
 * is provable in a browser against a running app — with zero external spend and no key.
 */

import type {
  ClaudeTransport,
  ClaudeTransportRequest,
  ClaudeTransportResponse,
} from "./claude-transport";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Dev proof transport is server-only.");
  }
}

/** How many grounding-context lines the simulated answer acknowledges (bounded). */
const GROUNDING_ACK_LIMIT = 3;

/**
 * A deterministic, honestly-simulated answer. It restates the question and acknowledges the
 * grounding context it was given as DATA — it never claims an action occurred, never invents
 * a record identifier, and never presents itself as authoritative. This is a test/proof path.
 */
function simulatedAnswer(request: ClaudeTransportRequest): string {
  const question = request.messages[request.messages.length - 1]?.content ?? "";
  const groundingLineCount = request.system.split("\n").filter((line) => /^\[\d+]/.test(line)).length;
  const ack =
    groundingLineCount > 0
      ? `It considered ${Math.min(groundingLineCount, GROUNDING_ACK_LIMIT)} of ${groundingLineCount} grounding line(s) as context.`
      : "No grounding context was provided.";
  return [
    "Simulated model answer (test transport — not a live provider).",
    `Question: ${question}`,
    ack,
    "This is advisory text only and changes nothing on its own.",
  ].join(" ");
}

/**
 * Create the local proof transport. Deterministic and side-effect-free. It reports synthetic,
 * clearly-fake usage/ids so downstream telemetry never mistakes it for real provider data.
 */
export function createDevProofTransport(): ClaudeTransport {
  assertServerRuntime();
  return Object.freeze({
    async send(request: ClaudeTransportRequest): Promise<ClaudeTransportResponse> {
      const text = simulatedAnswer(request);
      return {
        id: "fake_proof_request",
        model: request.model,
        content: [{ type: "text", text }],
        stopReason: "end_turn",
        // Synthetic, obviously-fake usage. Never presented as billable/real provider usage.
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    },
  });
}
