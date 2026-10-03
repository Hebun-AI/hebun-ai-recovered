/*
 * RELEVANCE-2A — over-bound semantics, the grounding sufficiency contract, the q22/q23 near-substitute
 * regression (Director OPTION A), and the invariant that a model signal can never establish grounding.
 */
import assert from "node:assert/strict";
import {
  buildRelevanceCandidateSet,
  selectRelevant,
  RELEVANCE_MAX_CANDIDATES,
  type RelevanceJudge,
  type RelevanceJudgeInput,
  type RelevanceJudgeVerdict,
  type RelevanceOutcome,
  type RelevanceSelection,
  type RelevanceSource,
} from "../../src/features/knowledge-retrieval/relevance";
import {
  assessGrounding,
  type GroundingOutcome,
  type GroundingSupport,
} from "../../src/features/knowledge-retrieval/grounding";
import { createModelRelevanceJudge } from "../../src/features/relevance-judge/model-relevance-judge";
import type { ClaudeTransport, ClaudeTransportRequest } from "../../src/features/heby-model";

function source(key: string, title: string, statement = `${title}.`): RelevanceSource {
  return { nodeId: `node-${key}`, factId: `fact-${key}`, factKey: key, knowledgeVersion: 1, domainKey: "d", title, statement };
}
const established = (eligible: RelevanceSource[], withheldCount = 0) => ({ status: "established" as const, eligible, withheldCount });

function recordingJudge(answer: (input: RelevanceJudgeInput) => RelevanceJudgeVerdict, kind: RelevanceJudge["kind"] = "deterministic") {
  const seen: RelevanceJudgeInput[] = [];
  const judge: RelevanceJudge = {
    judgeId: `test:${kind}`,
    kind,
    async judge(input) {
      seen.push(input);
      return answer(input);
    },
  };
  return { judge, seen };
}

const pickFirst = (input: RelevanceJudgeInput): RelevanceJudgeVerdict => ({
  status: "judged",
  selected: input.candidates.slice(0, 1).map((c) => ({ candidateId: c.candidateId, basis: "direct" })),
});

async function main(): Promise<void> {
  /* ── 1. BOUNDED SET ─────────────────────────────────────────────────────── */
  {
    const many = Array.from({ length: RELEVANCE_MAX_CANDIDATES + 1 }, (_, i) => source(`k${i}`, `T${i}`));

    const fits = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established(many.slice(0, RELEVANCE_MAX_CANDIDATES)) });
    assert.ok(fits.status === "built" && fits.generation.kind === "exhaustive" && fits.candidates.length === RELEVANCE_MAX_CANDIDATES, "exhaustive <= bound works");
    const ok = recordingJudge(pickFirst);
    const okOutcome = await selectRelevant({ purpose: "internal-answer", task: "t" }, fits, ok.judge);
    assert.ok(okOutcome.status === "selected" && okOutcome.exhaustive);

    const over = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established(many) });
    assert.deepEqual(over, { status: "over-bound", purpose: "internal-answer", candidateCount: many.length, bound: RELEVANCE_MAX_CANDIDATES, generation: { kind: "exhaustive" } });
    const never = recordingJudge(pickFirst);
    const overOutcome = await selectRelevant({ purpose: "internal-answer", task: "t" }, over, never.judge);
    assert.equal(never.seen.length, 0, "an exhaustive set over the bound NEVER reaches a judge");
    assert.deepEqual(overOutcome, { status: "over-bound", purpose: "internal-answer", candidateCount: many.length, bound: RELEVANCE_MAX_CANDIDATES });

    /* A future CandidateGenerator: a bounded subset of a larger universe is valid and non-exhaustive. */
    const generated = buildRelevanceCandidateSet({
      purpose: "internal-answer",
      eligibility: established(many.slice(0, 5)),
      generation: { kind: "generated", method: "lexical", universeCount: 300 },
    });
    assert.ok(generated.status === "built" && generated.generation.kind === "generated" && generated.candidates.length === 5);
    const none = recordingJudge(() => ({ status: "judged", selected: [] }));
    const noneOutcome = await selectRelevant({ purpose: "internal-answer", task: "t" }, generated, none.judge);
    assert.ok(noneOutcome.status === "none-relevant" && noneOutcome.exhaustive === false, "'none among candidates' is not 'none in the universe'");

    /* A generator that hands over too many is not cut either. */
    const tooMany = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established(many), generation: { kind: "generated", method: "hybrid", universeCount: 999 } });
    assert.equal(tooMany.status, "over-bound");
    /* A generator reporting an impossible universe is refused. */
    const lying = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established(many.slice(0, 3)), generation: { kind: "generated", method: "lexical", universeCount: 2 } });
    assert.deepEqual(lying, { status: "unavailable", purpose: "internal-answer", reason: "candidate-generation-invalid" });
    /* A generator that surfaced nothing from a non-empty universe is not "none eligible". */
    const surfacedNothing = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([]), generation: { kind: "generated", method: "lexical", universeCount: 40 } });
    const nc = await selectRelevant({ purpose: "internal-answer", task: "t" }, surfacedNothing, recordingJudge(pickFirst).judge);
    assert.deepEqual(nc, { status: "no-candidates", purpose: "internal-answer", universeCount: 40 });
  }

  /* ── 2. GROUNDING MATRIX ─────────────────────────────────────────────────── */
  const sel = (key: string): RelevanceSelection => ({
    candidate: { nodeId: `node-${key}`, factId: `fact-${key}`, factKey: key, knowledgeVersion: 1, domainKey: "d", text: key, textTruncated: false },
    rank: 1,
    basis: "direct",
  });
  const judgeModel = { judgeId: "model:x", kind: "model" as const };
  const P = "public-content-grounding" as const;
  const outcomes: Record<string, RelevanceOutcome> = {
    eligibilityUnavailable: { status: "unavailable", purpose: P, reason: "candidate-set-unavailable", detail: "eligibility-unavailable" },
    generationInvalid: { status: "unavailable", purpose: P, reason: "candidate-set-unavailable", detail: "candidate-generation-invalid" },
    judgeUnavailable: { status: "unavailable", purpose: P, reason: "judge-unavailable", detail: "transport:rate-limited" },
    judgeFailed: { status: "unavailable", purpose: P, reason: "judge-failed" },
    invalid: { status: "unavailable", purpose: P, reason: "judge-response-invalid", detail: "unknown-alias" },
    overBound: { status: "over-bound", purpose: P, candidateCount: 40, bound: 20 },
    noneEligible: { status: "none-eligible", purpose: P, withheldCount: 3 },
    noCandidates: { status: "no-candidates", purpose: P, universeCount: 40 },
    noneRelevant: { status: "none-relevant", purpose: P, candidateCount: 4, judge: judgeModel, exhaustive: true },
    selected: { status: "selected", purpose: P, selections: [sel("y")], candidateCount: 4, judge: judgeModel, degradedReason: null, exhaustive: true },
    degraded: { status: "degraded", purpose: P, selections: [sel("y")], candidateCount: 4, judge: judgeModel, degradedReason: "lesser", exhaustive: true },
  };
  const req = "organizational-facts-required" as const;
  const g = (key: keyof typeof outcomes, support?: GroundingSupport) => assessGrounding({ requirement: req, relevance: outcomes[key]!, support });
  const shape = (o: GroundingOutcome) => `${o.status}:${"reason" in o ? o.reason : ""}`;
  {
    assert.equal(shape(g("eligibilityUnavailable")), "unavailable:eligibility-unavailable");
    assert.equal(shape(g("generationInvalid")), "unavailable:candidate-generation-invalid");
    assert.equal(shape(g("judgeUnavailable")), "unavailable:relevance-unavailable");
    assert.equal(shape(g("judgeFailed")), "unavailable:relevance-unavailable");
    assert.equal(shape(g("invalid")), "unavailable:relevance-response-invalid");
    assert.equal(shape(g("overBound")), "unavailable:candidate-set-over-bound");
    assert.equal(shape(g("noneEligible")), "insufficient:none-eligible", "NONE EXISTS");
    assert.equal(shape(g("noCandidates")), "insufficient:no-candidates");
    assert.equal(shape(g("noneRelevant")), "insufficient:none-relevant", "NONE RELEVANT");
    assert.equal(shape(g("selected")), "relevant-unverified:no-support-verdict", "relevant evidence alone is NOT sufficient");
    assert.equal(shape(g("degraded")), "relevant-unverified:relevance-degraded");
    /* UNAVAILABLE never collapses into NONE EXISTS, and NONE EXISTS never into NONE RELEVANT. */
    assert.notEqual(shape(g("judgeUnavailable")), shape(g("noneEligible")));
    assert.notEqual(shape(g("noneEligible")), shape(g("noneRelevant")));

    /* No organizational facts required: not-required, whatever happened to Knowledge. */
    for (const key of Object.keys(outcomes) as (keyof typeof outcomes)[]) {
      const o = assessGrounding({ requirement: "no-organizational-facts-required", relevance: outcomes[key]! });
      assert.equal(o.status, "not-required", `${key}: creative work is not blocked`);
    }
    const ctx = assessGrounding({ requirement: "no-organizational-facts-required", relevance: outcomes.selected! });
    assert.ok(ctx.status === "not-required" && ctx.context.length === 1, "selections travel as context only");

    /* The ONLY path to sufficient: a non-model verifier naming selected versions. */
    const human: GroundingSupport = { status: "verified", verifierId: "director", verifierKind: "human", supportedNodeIds: ["node-y"] };
    const suff = g("selected", human);
    assert.ok(suff.status === "sufficient" && suff.supportedBy.length === 1 && suff.verifierKind === "human");
    assert.equal(shape(g("selected", { ...human, supportedNodeIds: [] } as GroundingSupport)), "relevant-unverified:support-outside-selection");
    assert.equal(shape(g("degraded", human)), "relevant-unverified:relevance-degraded", "a degraded selection is never promoted");
    for (const key of ["noneRelevant", "noneEligible", "judgeUnavailable", "overBound"] as const) {
      assert.notEqual(g(key, human).status, "sufficient", `${key}: a verdict cannot conjure evidence`);
    }
  }

  /* ── 3. q22/q23 NEAR-SUBSTITUTE REGRESSION (OPTION A) ────────────────────── */
  {
    /*
     * Task asks for organizational fact X (the return window). X exists but is withheld for public
     * content (no public-use decision). Neighbour Y (delivery time) is eligible. Purpose eligibility
     * runs FIRST, so X is not in the candidate set and cannot reach the model.
     */
    const X = source("zt-returns", "Return window", "Customers may return a rug within 30 days.");
    const Y = source("zt-shipping", "Delivery time", "Rugs are delivered within five working days.");
    const Z = source("zt-showroom", "Showroom", "The showroom is in Stone Town.");
    const universe = [X, Y, Z];
    const withheldForPublic = new Set([X.factKey]);
    const eligible = universe.filter((s) => !withheldForPublic.has(s.factKey));
    const set = buildRelevanceCandidateSet({ purpose: P, eligibility: established(eligible, universe.length - eligible.length) });

    const requests: ClaudeTransportRequest[] = [];
    const fake: ClaudeTransport = {
      async send(request) {
        requests.push(request);
        /* The judge does what RELEVANCE-1 observed: picks the adjacent eligible fact. */
        const yAlias = /(c\d+): Delivery time/.exec(request.messages[0]!.content)![1]!;
        return { model: request.model, content: [], stopReason: "end_turn", structured: { selected: [yAlias] } };
      },
    };
    const judge = createModelRelevanceJudge({ transport: fake, modelId: "fake-model" });
    const relevance = await selectRelevant({ purpose: P, task: "Write a caption stating our return window for rugs." }, set, judge);

    const wire = JSON.stringify(requests);
    for (const leak of [X.title, X.statement!, X.factKey, X.nodeId, X.factId, "30 days"]) {
      assert.ok(!wire.includes(leak), `the withheld record never reaches the model payload (${leak})`);
    }
    assert.ok(relevance.status === "selected" && relevance.selections[0]!.candidate.factKey === Y.factKey, "the judge selected the near substitute");

    const grounding = assessGrounding({ requirement: "organizational-facts-required", relevance });
    assert.equal(grounding.status, "relevant-unverified", "Y being relevant does not make X grounded");
    assert.notEqual(grounding.status, "sufficient");
    /* Even a (future) verifier cannot vouch for X through this outcome: X was never selected. */
    const vouchX = assessGrounding({
      requirement: "organizational-facts-required",
      relevance,
      support: { status: "verified", verifierId: "rule", verifierKind: "deterministic", supportedNodeIds: [X.nodeId] },
    });
    assert.equal(shape(vouchX), "relevant-unverified:support-outside-selection");
  }

  /* ── 4. MODEL SIGNAL MAY ONLY DOWNGRADE (property) ───────────────────────── */
  {
    /* Exhaustively vary everything a relevance judge can influence; with no verifier, never sufficient. */
    const bases = ["", "direct", "sufficient", "proves the claim", "verified"];
    const kinds = ["model", "deterministic"] as const;
    const supports: (GroundingSupport | undefined)[] = [undefined, { status: "unverified" }];
    let checked = 0;
    for (const kind of kinds) {
      for (const basis of bases) {
        for (const count of [1, 2, 3]) {
          for (const status of ["selected", "degraded"] as const) {
            for (const exhaustive of [true, false]) {
              const selections = Array.from({ length: count }, (_, i) => ({ ...sel(`s${i}`), rank: i + 1, basis }));
              const relevance: RelevanceOutcome = {
                status,
                purpose: P,
                selections,
                candidateCount: count,
                judge: { judgeId: `j:${kind}`, kind },
                degradedReason: status === "degraded" ? "x" : null,
                exhaustive,
              };
              for (const support of supports) {
                const o = assessGrounding({ requirement: req, relevance, support });
                assert.notEqual(o.status, "sufficient", `no relevance field promotes grounding (${kind}/${basis}/${status})`);
                checked += 1;
              }
              /* A verifier claiming to be a model is not a verifier. */
              const fakeModelVerifier = { status: "verified", verifierId: "m", verifierKind: "model", supportedNodeIds: ["node-s0"] } as unknown as GroundingSupport;
              assert.notEqual(assessGrounding({ requirement: req, relevance, support: fakeModelVerifier }).status, "sufficient");
            }
          }
        }
      }
    }
    assert.ok(checked > 100);
    // @ts-expect-error — the type admits no model verifier.
    const _typeCheck: GroundingSupport = { status: "verified", verifierId: "m", verifierKind: "model", supportedNodeIds: [] };
    void _typeCheck;
  }

  console.log("PASS relevance-2a bounded set and grounding");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
