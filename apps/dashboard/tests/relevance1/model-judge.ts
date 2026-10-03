/*
 * RELEVANCE-1 — the experimental model judge, proven with a FAKE transport. No network.
 *
 * The adapter must not weaken the RELEVANCE-0 contract: whatever the model answers, only members of
 * the supplied set can come back, and a malformed, foreign, repeated or over-limit answer is void.
 * The synthetic guard must run before anything reaches a transport.
 */
import assert from "node:assert/strict";
import type { ClaudeTransport, ClaudeTransportRequest } from "../../src/features/heby-model/claude-transport";
import { ModelConnectivityError } from "../../src/features/heby-model/model-error";
import { buildRelevanceCandidateSet, selectRelevant, type RelevanceSource } from "../../src/features/knowledge-retrieval/relevance";
import { FACTS } from "../../scripts/relevance-benchmark/corpus";
import { fixtureEligibility } from "../../scripts/relevance-benchmark/engine";
import { MODEL_JUDGE_SYSTEM, createModelRelevanceJudge, parseJudgeAnswer, renderJudgeMessage } from "../../scripts/relevance-experiment/model-judge";
import { assertSyntheticRequest } from "../../scripts/relevance-experiment/synthetic-guard";

const sourceOf = (key: string): RelevanceSource => {
  const fact = FACTS.find((f) => f.key === key)!;
  return { nodeId: `node-${key}`, factId: `fact-${key}`, factKey: key, knowledgeVersion: 1, domainKey: fact.domain, title: fact.title, statement: fact.statement };
};

function fakeTransport(answer: string | (() => never)): { factory: () => ClaudeTransport; sent: ClaudeTransportRequest[] } {
  const sent: ClaudeTransportRequest[] = [];
  return {
    sent,
    factory: () => ({
      async send(request) {
        sent.push(request);
        if (typeof answer === "function") answer();
        return { model: "fake", content: [{ type: "text", text: answer as string }], usage: { inputTokens: 10, outputTokens: 5 } };
      },
    }),
  };
}

const TASK = "Zanzibar Textiles hangi ürünleri satıyor?";

async function main(): Promise<void> {
  const sources = ["z-products", "z-materials", "z-sizes"].map(sourceOf);
  const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: { status: "established", eligible: sources, withheldCount: 0 } });
  const req = { purpose: "internal-answer" as const, task: TASK, limit: 2 };

  /* ── 1. what the model sees: aliases and bounded text, no identities ──── */
  {
    const { text, aliases } = renderJudgeMessage({
      purpose: "internal-answer",
      task: TASK,
      limit: 2,
      candidates: set.status === "built" ? set.candidates.map((c) => ({ candidateId: c.nodeId, text: c.text })) : [],
    });
    assert.deepEqual([...aliases.keys()], ["c1", "c2", "c3"]);
    for (const leak of ["node-", "fact-", "z-products", "tenant"]) assert.ok(!text.includes(leak), `the prompt carries no ${leak}`);
    for (const clause of ["return an empty list", "Do not judge whether a record is true", "Do not decide whether a record may be used", "Use only ids from the list"]) {
      assert.ok(MODEL_JUDGE_SYSTEM.includes(clause), `the instruction says: ${clause}`);
    }
  }

  /* ── 2. strict parsing ─────────────────────────────────────────────────── */
  {
    assert.deepEqual(parseJudgeAnswer('{"selected": ["c2", "c1"]}'), ["c2", "c1"]);
    assert.deepEqual(parseJudgeAnswer('```json\n{"selected": []}\n```'), []);
    /* leading-json reads the leading object only — and still rejects everything strict rejects inside it. */
    assert.deepEqual(parseJudgeAnswer('```json\n{"selected": ["c1"]}\n```\n\nBecause c1 is about products.', "leading-json"), ["c1"]);
    assert.deepEqual(parseJudgeAnswer('{"selected": []}\n\nNone is relevant.', "leading-json"), []);
    assert.equal(parseJudgeAnswer('{"selected": []}\n\nNone is relevant.'), null, "strict still refuses trailing prose");
    for (const bad of ["Sure: {\"selected\": [\"c1\"]}", '{"selected": [1]} ok', '{"selected": ["c1"], "why": "x"}']) {
      assert.equal(parseJudgeAnswer(bad, "leading-json"), null, `leading-json malformed: ${bad}`);
    }
    for (const bad of ["c1, c2", '{"selected": [1]}', '{"selected": ["c1"], "why": "x"}', "Sure! {\"selected\": [\"c1\"]}", "[]"]) {
      assert.equal(parseJudgeAnswer(bad), null, `malformed: ${bad}`);
    }
  }

  /* ── 3. every bad answer fails closed through the RELEVANCE-0 contract ── */
  {
    const run = async (answer: string | (() => never), transportPresent = true) => {
      const fake = fakeTransport(answer);
      const judge = createModelRelevanceJudge({ model: "fake-model", transport: transportPresent ? fake.factory : () => undefined });
      return selectRelevant(req, set, judge);
    };
    const reason = (o: Awaited<ReturnType<typeof run>>) => (o.status === "unavailable" ? `${o.reason}${o.detail ? `:${o.detail}` : ""}` : o.status);

    assert.equal(reason(await run('{"selected": ["c9"]}')), "judge-response-invalid:non-member", "an alias it was not given");
    assert.equal(reason(await run('{"selected": ["c1", "c1"]}')), "judge-response-invalid:duplicate");
    assert.equal(reason(await run('{"selected": ["c1", "c2", "c3"]}')), "judge-response-invalid:over-limit");
    assert.equal(reason(await run("I think c1 is relevant")), "judge-unavailable:malformed-model-output");
    assert.equal(reason(await run(() => { throw new ModelConnectivityError("timeout"); })), "judge-failed");
    assert.equal(reason(await run('{"selected": []}', false)), "judge-unavailable:transport-not-selected");
    assert.equal((await run('{"selected": []}')).status, "none-relevant", "an empty answer is a typed none-relevant");

    const ok = await run('{"selected": ["c2"]}');
    assert.equal(ok.status, "selected");
    if (ok.status === "selected") {
      assert.equal(ok.selections[0]!.candidate.factKey, "z-materials", "identity comes from the set via the alias");
      assert.equal(ok.judge.kind, "model");
    }
  }

  /* ── 4. a withheld (DENIED) fact never reaches the model ───────────────── */
  {
    const gate = fixtureEligibility("public-content-grounding", ["z-products", "z-sourcing", "z-returns", "z-custom"].map(sourceOf));
    const pubSet = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: { status: "established", eligible: gate.eligible, withheldCount: gate.withheld.length } });
    const fake = fakeTransport('{"selected": []}');
    await selectRelevant({ purpose: "public-content-grounding", task: TASK }, pubSet, createModelRelevanceJudge({ model: "fake-model", transport: fake.factory }));
    const body = fake.sent[0]!.messages[0]!.content;
    assert.ok(body.includes(sourceOf("z-products").statement!), "the eligible fact is shown");
    for (const withheld of ["z-sourcing", "z-returns", "z-custom"]) {
      assert.ok(!body.includes(sourceOf(withheld).statement!), `${withheld} is not shown to the model`);
    }
  }

  /* ── 5. the synthetic guard runs before the transport is touched ───────── */
  {
    const fake = fakeTransport('{"selected": []}');
    let guarded = 0;
    const judge = createModelRelevanceJudge({
      model: "fake-model",
      transport: fake.factory,
      onRequest: (request) => {
        assertSyntheticRequest(request);
        guarded += 1;
      },
    });
    assert.equal((await selectRelevant(req, set, judge)).status, "none-relevant");
    assert.equal(guarded, 1, "a corpus request passes the guard");

    const foreign: RelevanceSource = { nodeId: "x", factId: "x", factKey: "x", knowledgeVersion: 1, domainKey: "x", title: "Real organization", statement: "A real internal fact." };
    const foreignSet = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: { status: "established", eligible: [foreign], withheldCount: 0 } });
    const before = fake.sent.length;
    const blocked = await selectRelevant(req, foreignSet, judge);
    assert.equal(blocked.status === "unavailable" && blocked.reason, "judge-failed", "non-corpus text aborts the call");
    assert.equal(fake.sent.length, before, "nothing reached the transport");

    const offTask = await selectRelevant({ ...req, task: "A real customer question" }, set, judge);
    assert.equal(offTask.status === "unavailable" && offTask.reason, "judge-failed", "a non-corpus task aborts the call");
    assert.equal(fake.sent.length, before, "still nothing reached the transport");
    assert.throws(() => assertSyntheticRequest({ ...fake.sent[0]!, system: "be helpful" }), /system/);
  }

  console.log("PASS relevance-1 model judge (fake transport)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
