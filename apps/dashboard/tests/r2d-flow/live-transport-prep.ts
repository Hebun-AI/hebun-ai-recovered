/*
 * R2D — live Claude transport PREP (no real network).
 *
 * Proves the prepared live transport is correct and safe WITHOUT ever calling Anthropic: an
 * injected fake fetch stands in for the network, so request construction, usage/id extraction,
 * error mapping, the hard budget, and the double-gated selector are all provable with no real
 * request, no key, and no spend. No ordinary test here touches the real network.
 */

import assert from "node:assert/strict";
import {
  createLiveClaudeTransport,
  isLiveCredentialPresent,
  MAX_LIVE_OUTPUT_TOKENS,
  ANTHROPIC_MESSAGES_URL,
  type FetchLike,
} from "../../src/features/heby-model-live/claude-http-transport.server";
import { selectModelTransport } from "../../src/features/heby-model";
import { ModelConnectivityError, generateHebyModelAnswer } from "../../src/features/heby-model";
import type { ClaudeTransportRequest } from "../../src/features/heby-model";
import type { ModelGenerationRequest } from "../../src/features/heby-runtime";

const REQUEST: ClaudeTransportRequest = {
  model: "claude-real-model",
  system: "You are Heby.",
  messages: [{ role: "user", content: "Ping" }],
  maxTokens: 100,
};

const ANTHROPIC_OK = {
  id: "msg_live_0001",
  model: "claude-real-model",
  content: [{ type: "text", text: "A live-shaped answer." }],
  stop_reason: "end_turn",
  usage: { input_tokens: 11, output_tokens: 5 },
};

/** A fake fetch that records the last request and returns a scripted response. */
function scriptedFetch(status: number, payload: unknown): { fetchImpl: FetchLike; last: () => { url: string; init: Parameters<FetchLike>[1] } | undefined } {
  let captured: { url: string; init: Parameters<FetchLike>[1] } | undefined;
  const fetchImpl: FetchLike = async (url, init) => {
    captured = { url, init };
    return { ok: status >= 200 && status < 300, status, json: async () => payload };
  };
  return { fetchImpl, last: () => captured };
}

async function rejectsCode(run: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(run, (e: unknown) => e instanceof ModelConnectivityError && e.code === code);
}

async function main(): Promise<void> {
  // 1. Missing key fails closed at construction.
  assert.throws(() => createLiveClaudeTransport({ apiKey: "" }), (e: unknown) => e instanceof ModelConnectivityError && (e as ModelConnectivityError).code === "missing-credential");

  // 2. Over-budget output bound is rejected BEFORE any fetch.
  {
    const s = scriptedFetch(200, ANTHROPIC_OK);
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl });
    await rejectsCode(() => transport.send({ ...REQUEST, maxTokens: MAX_LIVE_OUTPUT_TOKENS + 1 }), "invalid-configuration");
    assert.equal(s.last(), undefined, "no request was dispatched over budget");
  }

  // 3. Success: request is built correctly and usage/id are extracted (no real network).
  {
    const s = scriptedFetch(200, ANTHROPIC_OK);
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl });
    const response = await transport.send(REQUEST);
    const call = s.last()!;
    assert.equal(call.url, ANTHROPIC_MESSAGES_URL);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.headers["x-api-key"], "sk-fake");
    assert.ok(call.init.headers["anthropic-version"]);
    const body = JSON.parse(call.init.body);
    assert.equal(body.model, "claude-real-model");
    assert.equal(body.max_tokens, 100);
    assert.equal(body.messages[0].content, "Ping");
    // Extracted response.
    assert.equal(response.id, "msg_live_0001");
    assert.equal(response.content[0]!.text, "A live-shaped answer.");
    assert.equal(response.usage?.inputTokens, 11);
    assert.equal(response.usage?.outputTokens, 5);
  }

  // 4. Hard budget: the default is one call; a second send is refused.
  {
    const s = scriptedFetch(200, ANTHROPIC_OK);
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl });
    await transport.send(REQUEST);
    await rejectsCode(() => transport.send(REQUEST), "rate-limited");
  }

  // 5. Error mapping — statuses map to typed, redacted errors.
  for (const [status, code] of [[401, "authentication-failed"], [429, "rate-limited"], [400, "invalid-configuration"], [500, "provider-unavailable"]] as const) {
    const s = scriptedFetch(status, { error: "should never surface" });
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl, maxLiveCalls: 5 });
    await rejectsCode(() => transport.send(REQUEST), code);
  }

  // 6. Timeout: an aborted fetch maps to `timeout`.
  {
    const fetchImpl: FetchLike = async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    };
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl });
    await rejectsCode(() => transport.send(REQUEST), "timeout");
  }

  // 7. The live transport is a drop-in for the R2B seam: a scripted response becomes a
  //    validated model result — origin "model", provider from config, real usage — no network.
  {
    const s = scriptedFetch(200, ANTHROPIC_OK);
    const transport = createLiveClaudeTransport({ apiKey: "sk-fake", fetchImpl: s.fetchImpl });
    const request: ModelGenerationRequest = {
      correlationId: "corr-live", tenantId: "t", systemInstructions: "sys", userPrompt: "Ping", evidence: [],
      modelId: "ignored", maxOutputTokens: 100,
    };
    const outcome = await generateHebyModelAnswer(request, {
      env: { HEBUN_MODEL_CONNECTIVITY_ENABLED: "true", HEBUN_MODEL_PROVIDER: "claude", HEBUN_MODEL_ID: "claude-real-model", HEBUN_MODEL_CREDENTIAL: "sk-fake", HEBUN_MODEL_MAX_OUTPUT_TOKENS: "100" },
      transport,
    });
    assert.equal(outcome.status, "generated");
    if (outcome.status === "generated") {
      assert.equal(outcome.result.origin, "model");
      assert.equal(outcome.result.provider, "claude");
      assert.equal(outcome.result.inputTokens, 11);
      assert.equal(outcome.result.outputTokens, 5);
    }
  }

  // 8. Selector (single-authority since H1D): live is SELECTED by deployment mode + a credential to
  //    construct it. It is NOT authorization to dispatch — the durable R2E Director control gates
  //    that (proven in tests/r2e-flow/kill-switch.ts). Selection performs no I/O.
  assert.deepEqual(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "live" }), {}, "live closed without a credential");
  assert.equal(isLiveCredentialPresent({}), false);
  {
    // Live + a credential → live transport constructed (inert). No authorization flag needed.
    const selection = selectModelTransport({ HEBUN_MODEL_TRANSPORT: "live", ANTHROPIC_API_KEY: "sk-fake" });
    assert.equal(selection.transportProvenance, "live");
    assert.ok(selection.transport, "live selection constructs the transport (inert, no I/O)");
  }
  {
    // REGRESSION: the retired `HEBUN_MODEL_LIVE_CALL_AUTHORIZED` flag CANNOT act as a second
    // authority — it neither enables nor blocks selection. Only mode + credential decide selection.
    const base = { HEBUN_MODEL_TRANSPORT: "live", ANTHROPIC_API_KEY: "sk-fake" } as const;
    assert.equal(selectModelTransport({ ...base }).transportProvenance, "live", "no flag → still live");
    assert.equal(selectModelTransport({ ...base, HEBUN_MODEL_LIVE_CALL_AUTHORIZED: "true" }).transportProvenance, "live", "flag true → unchanged");
    assert.equal(selectModelTransport({ ...base, HEBUN_MODEL_LIVE_CALL_AUTHORIZED: "false" }).transportProvenance, "live", "flag false → STILL live (retired, inert)");
    // Absent credential stays closed regardless of the retired flag.
    assert.deepEqual(selectModelTransport({ HEBUN_MODEL_TRANSPORT: "live", HEBUN_MODEL_LIVE_CALL_AUTHORIZED: "true" }), {}, "no credential → closed even with the retired flag set");
  }

  console.log("r2d live transport prep checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
