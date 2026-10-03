/*
 * RELEVANCE-2A — the structured-output extension of the ONE model transport authority.
 *
 * Proves: a text request is byte-for-byte the request every released caller sends; the live transport
 * refuses a structured request before any I/O or budget spend (no provider mechanism is guessed); the
 * text client never sets the field; and the generic structured validator fails closed. No network.
 */
import assert from "node:assert/strict";
import { createLiveClaudeTransport, type FetchLike } from "../../src/features/heby-model-live/claude-http-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { createClaudeModelClient } from "../../src/features/heby-model/claude-model-client";
import { validateClaudeResponse } from "../../src/features/heby-model/claude-response-validator";
import { validateClaudeStructuredResponse } from "../../src/features/heby-model/claude-structured-response-validator";
import {
  ModelConnectivityError,
  type ClaudeTransport,
  type ClaudeTransportRequest,
  type ClaudeTransportResponse,
} from "../../src/features/heby-model";

const TEXT_REQUEST: ClaudeTransportRequest = {
  model: "test-model",
  system: "sys",
  messages: [{ role: "user", content: "hello" }],
  maxTokens: 100,
};

function capturingFetch() {
  const bodies: string[] = [];
  const fetchImpl: FetchLike = async (_url, init) => {
    bodies.push(init.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "req_1", model: "test-model", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }),
    };
  };
  return { bodies, fetchImpl };
}

async function main(): Promise<void> {
  /* ── 1. legacy text request: the wire body is exactly the released shape ── */
  {
    const { bodies, fetchImpl } = capturingFetch();
    const budget = createLiveSpendBudget(3);
    const transport = createLiveClaudeTransport({ apiKey: "k", fetchImpl, spendBudget: budget });
    const response = await transport.send(TEXT_REQUEST);
    assert.equal(bodies.length, 1);
    assert.deepEqual(
      JSON.parse(bodies[0]!),
      { model: "test-model", system: "sys", max_tokens: 100, messages: [{ role: "user", content: "hello" }] },
      "a text request serialises exactly as before",
    );
    assert.deepEqual(Object.keys(JSON.parse(bodies[0]!)).sort(), ["max_tokens", "messages", "model", "system"]);
    assert.equal(response.structured, undefined, "a text response carries no structured value");
    assert.equal(budget.spent(), 1);
  }

  /* ── 2. structured request on the live transport: refused before I/O and before spend ── */
  {
    const { bodies, fetchImpl } = capturingFetch();
    const budget = createLiveSpendBudget(3);
    const transport = createLiveClaudeTransport({ apiKey: "k", fetchImpl, spendBudget: budget });
    await assert.rejects(
      transport.send({ ...TEXT_REQUEST, structuredOutput: { name: "x", schema: { type: "object" } } }),
      (error: unknown) => error instanceof ModelConnectivityError && error.code === "transport-unavailable" && !error.retryable,
    );
    assert.equal(bodies.length, 0, "nothing reached the wire");
    assert.equal(budget.spent(), 0, "no budget unit was spent on a request that never went out");
    /* The refusal does not consume the instance's one call either. */
    await transport.send(TEXT_REQUEST);
    assert.equal(bodies.length, 1);
  }

  /* ── 3. the text client never asks for structured output ── */
  {
    let seen: ClaudeTransportRequest | undefined;
    const fake: ClaudeTransport = {
      async send(request) {
        seen = request;
        return { model: request.model, content: [{ type: "text", text: "answer" }], stopReason: "end_turn" };
      },
    };
    const client = createClaudeModelClient({ provider: "anthropic", transport: fake });
    const result = await client.generate({
      modelId: "m",
      systemInstructions: "s",
      userPrompt: "q",
      evidence: [],
      maxOutputTokens: 50,
      correlationId: "c",
    } as Parameters<typeof client.generate>[0]);
    assert.equal(result.text, "answer");
    assert.ok(seen && !("structuredOutput" in seen), "the text path request has no structuredOutput key");
  }

  /* ── 4. the text validator is unchanged by a structured value it does not read ── */
  {
    const r = validateClaudeResponse(
      { model: "m", content: [{ type: "text", text: "t" }], structured: { selected: [] } },
      { provider: "p", requestedModel: "m", correlationId: "c" },
    );
    assert.equal(r.text, "t");
    assert.throws(
      () => validateClaudeResponse({ model: "m", content: [], structured: { selected: [] } }, { provider: "p", requestedModel: "m", correlationId: "c" }),
      (e: unknown) => e instanceof ModelConnectivityError && e.code === "malformed-response",
      "a structured value never substitutes for a missing text answer",
    );
  }

  /* ── 5. the generic structured validator fails closed ── */
  {
    const ok: ClaudeTransportResponse = { model: "m", content: [], stopReason: "end_turn", structured: { selected: ["c1"] }, usage: { inputTokens: 5, outputTokens: 2 }, id: "req" };
    const good = validateClaudeStructuredResponse(ok, { requestedModel: "m" });
    assert.deepEqual(good.value, { selected: ["c1"] });
    assert.equal(good.inputTokens, 5);
    assert.equal(good.providerRequestId, "req");

    const malformed = (response: ClaudeTransportResponse, why: string) =>
      assert.throws(
        () => validateClaudeStructuredResponse(response, { requestedModel: "m" }),
        (e: unknown) => e instanceof ModelConnectivityError && e.code === "malformed-response",
        why,
      );
    malformed({ content: [{ type: "text", text: '{"selected":["c1"]}' }] }, "JSON in text is NOT a structured answer — no text parsing");
    malformed({ content: [], structured: null }, "null");
    malformed({ content: [], structured: ["c1"] }, "array");
    malformed({ content: [], structured: "{}" }, "string");
    malformed({ content: [], structured: 3 }, "number");
    malformed({ content: [], structured: { selected: [] }, stopReason: "max_tokens" }, "truncated by max_tokens");
    malformed({ content: [], structured: { selected: [] }, stopReason: "refusal" }, "refusal");
    malformed({ content: [], structured: { selected: [] }, usage: { inputTokens: -1 } }, "impossible tokens");
  }

  console.log("PASS relevance-2a structured transport");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
