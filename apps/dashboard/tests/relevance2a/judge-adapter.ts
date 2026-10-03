/*
 * RELEVANCE-2A — the model relevance judge adapter, driven ONLY by a fake transport.
 *
 * Proves the Hebun-side closed validation of a structured answer (shape, strings, known aliases, no
 * repeats, within the limit, empty allowed), that every failure voids the whole verdict and stays typed
 * through the RELEVANCE-0 contract, and the minimum payload: aliases and bounded text only.
 */
import assert from "node:assert/strict";
import {
  createModelRelevanceJudge,
  parseRelevanceSelection,
  renderModelRelevanceRequest,
  MODEL_RELEVANCE_JUDGE_MAX_TOKENS,
  type ModelRelevanceJudgeCall,
} from "../../src/features/relevance-judge/model-relevance-judge";
import {
  buildRelevanceCandidateSet,
  selectRelevant,
  type RelevanceSource,
} from "../../src/features/knowledge-retrieval/relevance";
import {
  ModelConnectivityError,
  MODEL_OUTPUT_TOKEN_CEILING,
  type ClaudeTransport,
  type ClaudeTransportRequest,
} from "../../src/features/heby-model";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function source(n: number, title: string, statement: string): RelevanceSource {
  const hex = n.toString(16).padStart(12, "0");
  return {
    nodeId: `00000000-0000-4000-8000-${hex}`,
    factId: `11111111-0000-4000-8000-${hex}`,
    factKey: `zt-fact-${n}`,
    knowledgeVersion: 1,
    domainKey: `zt-domain-${n}`,
    title,
    statement,
  };
}

const SOURCES = [
  source(1, "Shipping", "Zanzibar Textiles ships within five working days."),
  source(2, "Materials", "Rugs are woven from wool."),
  source(3, "Showroom", "The showroom is in Stone Town."),
];

/** A fake transport that answers with a fixed structured value (or throws), recording requests. */
function fakeTransport(answer: unknown | (() => never), extra: { stopReason?: string } = {}) {
  const requests: ClaudeTransportRequest[] = [];
  const transport: ClaudeTransport = {
    async send(request) {
      requests.push(request);
      if (typeof answer === "function") (answer as () => never)();
      return { id: "req_fake", model: request.model, content: [], stopReason: extra.stopReason ?? "end_turn", structured: answer, usage: { inputTokens: 300, outputTokens: 9 } };
    },
  };
  return { transport, requests };
}

async function run(answer: unknown, limit = 8, extra: { stopReason?: string } = {}) {
  const { transport, requests } = fakeTransport(answer, extra);
  const calls: ModelRelevanceJudgeCall[] = [];
  const judge = createModelRelevanceJudge({ transport, modelId: "fake-model", onCall: (c) => calls.push(c) });
  const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: { status: "established", eligible: SOURCES, withheldCount: 0 } });
  const outcome = await selectRelevant({ purpose: "internal-answer", task: "How fast do you ship?", limit }, set, judge);
  return { outcome, requests, calls };
}

async function main(): Promise<void> {
  /* ── 1. valid structured answers ── */
  {
    const { outcome, requests, calls } = await run({ selected: ["c1"] });
    assert.equal(outcome.status, "selected");
    assert.ok(outcome.status === "selected" && outcome.selections[0]!.candidate.nodeId === SOURCES[0]!.nodeId, "alias maps back to the set's own object");
    assert.ok(outcome.status === "selected" && outcome.judge.kind === "model");
    assert.equal(requests.length, 1);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { model: "fake-model", latencyMs: calls[0]!.latencyMs, inputTokens: 300, outputTokens: 9, providerRequestId: "req_fake" }, "observability carries numbers and ids only");

    const empty = await run({ selected: [] });
    assert.equal(empty.outcome.status, "none-relevant", "an empty selection is a valid answer");
    assert.ok(empty.outcome.status === "none-relevant" && empty.outcome.exhaustive, "the judge saw the whole eligible set");
  }

  /* ── 2. every structural failure voids the WHOLE verdict, typed as invalid ── */
  {
    const invalid: Array<[unknown, string, { stopReason?: string }?]> = [
      [undefined, "malformed-structured-output"],
      [{ selected: ["c1"] }, "malformed-structured-output", { stopReason: "max_tokens" }],
      [{ selected: ["c1"], relation: "direct" }, "unexpected-shape"],
      [{ selected: ["c1"], why: "it ships" }, "unexpected-shape"],
      [{}, "unexpected-shape"],
      [{ selected: "c1" }, "selected-not-array"],
      [{ selected: ["c1", 2] }, "non-string-selection"],
      [{ selected: ["c1", "c9"] }, "unknown-alias"],
      [{ selected: [SOURCES[0]!.nodeId] }, "unknown-alias"],
      [{ selected: ["c1", "c1"] }, "duplicate-alias"],
    ];
    for (const [answer, reason, extra] of invalid) {
      const { outcome } = await run(answer, 8, extra ?? {});
      assert.deepEqual(
        outcome.status === "unavailable" ? { reason: outcome.reason, detail: outcome.detail } : outcome,
        { reason: "judge-response-invalid", detail: reason },
        `${JSON.stringify(answer)} must void the verdict as ${reason}`,
      );
    }
    const over = await run({ selected: ["c1", "c2"] }, 1);
    assert.ok(over.outcome.status === "unavailable" && over.outcome.reason === "judge-response-invalid" && over.outcome.detail === "over-limit");
  }

  /* ── 3. RELEVANCE-0 membership stays authoritative even if the adapter were bypassed ── */
  {
    const aliases = new Map([["c1", "n1"]]);
    assert.deepEqual(parseRelevanceSelection({ selected: [] }, aliases, 1), { ok: true, aliases: [] });
    assert.deepEqual(parseRelevanceSelection({ selected: ["c1"] }, aliases, 0), { ok: false, reason: "over-limit" });
  }

  /* ── 4. transport failures are UNAVAILABLE (not invalid, not none), with the typed code only ── */
  {
    for (const code of ["transport-unavailable", "rate-limited", "provider-unavailable", "timeout"] as const) {
      const { outcome } = await run(() => {
        throw new ModelConnectivityError(code, "secret-bearing message sk-ant-xyz");
      });
      assert.ok(outcome.status === "unavailable" && outcome.reason === "judge-unavailable" && outcome.detail === `transport:${code}`, code);
      assert.ok(!JSON.stringify(outcome).includes("sk-ant"), "no transport message text crosses");
    }
    const opaque = await run(() => {
      throw new Error("raw provider error with headers");
    });
    assert.ok(opaque.outcome.status === "unavailable" && opaque.outcome.detail === "transport:unknown-provider-error");
  }

  /* ── 5. minimum payload ── */
  {
    const { requests } = await run({ selected: [] });
    const request = requests[0]!;
    const wire = JSON.stringify(request);
    assert.ok(!UUID.test(wire), "no node or fact uuid leaves Hebun");
    for (const s of SOURCES) {
      assert.ok(!wire.includes(s.factKey) && !wire.includes(s.domainKey), "no fact key or domain key");
    }
    assert.ok(!/internal-answer|public-content-grounding/.test(wire), "no purpose label");
    assert.ok(request.messages.length === 1 && request.messages[0]!.role === "user");
    assert.ok(/c1: Shipping — Zanzibar/.test(request.messages[0]!.content), "candidates travel under aliases with bounded text");
    assert.ok(request.maxTokens === MODEL_RELEVANCE_JUDGE_MAX_TOKENS && request.maxTokens <= MODEL_OUTPUT_TOKEN_CEILING);
    assert.deepEqual(request.structuredOutput?.schema, {
      type: "object",
      properties: { selected: { type: "array", items: { type: "string", enum: ["c1", "c2", "c3"] }, maxItems: 8, uniqueItems: true } },
      required: ["selected"],
      additionalProperties: false,
    }, "a closed schema naming only the aliases");
    const rendered = renderModelRelevanceRequest({ purpose: "public-content-grounding", task: "t", candidates: [{ candidateId: "x", text: "y" }], limit: 2 }, "m");
    assert.equal(rendered.aliases.get("c1"), "x");
    assert.ok(!JSON.stringify(rendered.request).includes('"x"'), "the candidate id stays on Hebun's side");
  }

  console.log("PASS relevance-2a judge adapter");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
