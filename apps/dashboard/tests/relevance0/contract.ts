/*
 * RELEVANCE-0 — the relevance contract, proven without a database.
 *
 * What is asserted: the set is exactly what upstream eligibility admitted — bounded, never filtered or
 * widened here; a judge sees only that set and cannot return, widen to, or rename anything outside it;
 * a partly invalid verdict is void as a whole; the outcome's candidate identity comes from the set;
 * and nothing in an outcome reads as truth, standing or permission to generate. Purpose eligibility
 * itself is NOT this module's: the benchmark's fixture stand-in is tested in its own file.
 */
import assert from "node:assert/strict";
import {
  RELEVANCE_MAX_CANDIDATES,
  RELEVANCE_MAX_CANDIDATE_TEXT,
  RELEVANCE_MAX_SELECTIONS,
  buildRelevanceCandidateSet,
  resolveRelevanceLimit,
  selectRelevant,
  type RelevanceJudge,
  type RelevanceJudgeInput,
  type RelevanceSource,
} from "../../src/features/knowledge-retrieval/relevance";

const source = (id: string, over: Partial<RelevanceSource> = {}): RelevanceSource => ({
  nodeId: id,
  factId: `fact-${id}`,
  factKey: `key-${id}`,
  knowledgeVersion: 1,
  domainKey: "products",
  title: `Title ${id}`,
  statement: `Statement ${id}`,
  ...over,
});

/** Upstream eligibility as a caller would hand it over. */
const established = (eligible: readonly RelevanceSource[], withheldCount = 0) =>
  ({ status: "established", eligible, withheldCount }) as const;

/** A judge that records what it was shown and answers with a fixed verdict. */
function recordingJudge(answer: (input: RelevanceJudgeInput) => unknown): RelevanceJudge & { seen: RelevanceJudgeInput[] } {
  const seen: RelevanceJudgeInput[] = [];
  return {
    judgeId: "test-judge",
    kind: "deterministic",
    seen,
    async judge(input) {
      seen.push(input);
      return answer(input) as never;
    },
  };
}

async function main(): Promise<void> {
  /* ── 1. the set is what upstream admitted: nothing added, nothing filtered ── */
  {
    const set = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: established([source("a"), source("b")], 3) });
    assert.equal(set.status, "built");
    if (set.status !== "built") return;
    assert.deepEqual(set.candidates.map((c) => c.nodeId), ["a", "b"], "order and membership are the caller's");
    assert.equal(set.withheldCount, 3, "upstream's withheld count is reported, not re-judged");
  }

  /* ── 2. eligibility that could not be established builds no set ──────────── */
  {
    const set = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: { status: "unavailable" } });
    assert.deepEqual(set, { status: "unavailable", purpose: "public-content-grounding", reason: "eligibility-unavailable" });
  }

  /* ── 3. a judge cannot reach a version upstream withheld ───────────────── */
  {
    /* "denied" is a relevant version upstream withheld; it is simply not in the set. */
    const set = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: established([source("allowed")], 1) });
    const judge = recordingJudge(() => ({ status: "judged", selected: [{ candidateId: "denied", basis: "it is relevant" }] }));
    const outcome = await selectRelevant({ purpose: "public-content-grounding", task: "pricing post" }, set, judge);
    assert.deepEqual(judge.seen[0]!.candidates.map((c) => c.candidateId), ["allowed"], "the judge saw only the eligible set");
    assert.equal(outcome.status, "unavailable");
    assert.equal(outcome.status === "unavailable" && outcome.reason, "judge-response-invalid");
  }

  /* ── 4. membership, duplicates and limit void the whole verdict ─────────── */
  {
    const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([source("a"), source("b"), source("c")]) });
    const cases: [string, unknown][] = [
      ["non-member", { status: "judged", selected: [{ candidateId: "a", basis: "" }, { candidateId: "zzz", basis: "" }] }],
      ["duplicate", { status: "judged", selected: [{ candidateId: "a", basis: "" }, { candidateId: "a", basis: "" }] }],
      ["over-limit", { status: "judged", selected: [{ candidateId: "a", basis: "" }, { candidateId: "b", basis: "" }] }],
    ];
    for (const [detail, verdict] of cases) {
      const outcome = await selectRelevant({ purpose: "internal-answer", task: "t", limit: detail === "over-limit" ? 1 : 3 }, set, recordingJudge(() => verdict));
      assert.deepEqual(outcome, { status: "unavailable", purpose: "internal-answer", reason: "judge-response-invalid", detail }, `${detail} voids the verdict`);
    }
  }

  /* ── 5. identity comes from the set, never from the judge ───────────────── */
  {
    const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([source("a"), source("b")]) });
    const judge = recordingJudge(() => ({
      status: "judged",
      selected: [{ candidateId: "b", basis: "x".repeat(500), factKey: "forged", nodeId: "forged", text: "forged" }],
    }));
    const outcome = await selectRelevant({ purpose: "internal-answer", task: "t" }, set, judge);
    assert.equal(outcome.status, "selected");
    if (outcome.status !== "selected") return;
    const [only] = outcome.selections;
    assert.equal(only!.candidate.factKey, "key-b");
    assert.equal(only!.candidate.text, "Title b — Statement b");
    assert.equal(only!.rank, 1);
    assert.ok(only!.basis.length <= 120, "basis is bounded");
    assert.ok(set.status === "built" && only!.candidate === set.candidates[1], "the selection IS the set's object");
  }

  /* ── 6. typed outcomes stay distinct ──────────────────────────────────────── */
  {
    const empty = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: established([], 1) });
    const never = recordingJudge(() => assert.fail("no judge is asked when nothing is eligible"));
    assert.deepEqual(await selectRelevant({ purpose: "public-content-grounding", task: "t" }, empty, never), {
      status: "none-eligible",
      purpose: "public-content-grounding",
      withheldCount: 1,
    });

    const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([source("a")]) });
    const none = await selectRelevant({ purpose: "internal-answer", task: "t" }, set, recordingJudge(() => ({ status: "judged", selected: [] })));
    assert.equal(none.status, "none-relevant");

    const degraded = await selectRelevant(
      { purpose: "internal-answer", task: "t" },
      set,
      recordingJudge(() => ({ status: "judged", selected: [{ candidateId: "a", basis: "" }], degradedReason: "fallback" })),
    );
    assert.equal(degraded.status, "degraded");

    const off = await selectRelevant({ purpose: "internal-answer", task: "t" }, set, recordingJudge(() => ({ status: "unavailable", reason: "kill-switch" })));
    assert.deepEqual(off, { status: "unavailable", purpose: "internal-answer", reason: "judge-unavailable", detail: "kill-switch" });

    const thrown = await selectRelevant({ purpose: "internal-answer", task: "t" }, set, recordingJudge(() => { throw new Error("boom"); }));
    assert.deepEqual(thrown, { status: "unavailable", purpose: "internal-answer", reason: "judge-failed" });

    assert.equal((await selectRelevant({ purpose: "internal-answer", task: "   " }, set, never)).status, "unavailable", "an empty task asks nothing");
    const mismatch = await selectRelevant({ purpose: "public-content-grounding", task: "t" }, set, never);
    assert.deepEqual(mismatch, { status: "unavailable", purpose: "public-content-grounding", reason: "purpose-mismatch" }, "a purpose cannot borrow another purpose's set");
    const unbuilt = buildRelevanceCandidateSet({ purpose: "public-content-grounding", eligibility: { status: "unavailable" } });
    assert.equal((await selectRelevant({ purpose: "public-content-grounding", task: "t" }, unbuilt, never)).status, "unavailable");
  }

  /* ── 7. an outcome authorizes nothing and claims no truth ───────────────── */
  {
    const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([source("a")]) });
    const outcome = await selectRelevant({ purpose: "internal-answer", task: "t" }, set, recordingJudge(() => ({ status: "judged", selected: [{ candidateId: "a", basis: "" }] })));
    const keys = (value: object): string[] => Object.keys(value);
    /* `exhaustive` (RELEVANCE-2A): whether the judge saw the whole eligible set — coverage, not authority. */
    assert.deepEqual(keys(outcome).sort(), ["candidateCount", "degradedReason", "exhaustive", "judge", "purpose", "selections", "status"]);
    const banned = /permit|authori|allow|mayGenerate|proceed|truth|ratif|standing|confidence|score|publicUse/i;
    const walk = (value: unknown, path: string): void => {
      if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          assert.ok(!banned.test(key), `outcome field "${path}.${key}" must not read as authority, truth or standing`);
          walk(inner, `${path}.${key}`);
        }
      }
    };
    walk(outcome, "outcome");
  }

  /* ── 8. bounds ───────────────────────────────────────────────────────────── */
  {
    const many = Array.from({ length: RELEVANCE_MAX_CANDIDATES + 5 }, (_, i) => source(`n${i}`));
    /*
     * RELEVANCE-2A corrected this bound. It used to keep the first RELEVANCE_MAX_CANDIDATES and set a
     * flag nobody read; an exhaustive set that does not fit is now OVER-BOUND, whole, and is never
     * judged. Duplicates are still dropped before counting.
     */
    const over = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([...many, many[0]!]) });
    assert.ok(over.status === "over-bound" && over.candidateCount === many.length && over.bound === RELEVANCE_MAX_CANDIDATES, "an exhaustive set over the bound is over-bound, not cut");
    const set = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established(many.slice(0, RELEVANCE_MAX_CANDIDATES)) });
    assert.ok(set.status === "built" && set.candidates.length === RELEVANCE_MAX_CANDIDATES, "an exhaustive set at the bound is built whole");
    const long = buildRelevanceCandidateSet({ purpose: "internal-answer", eligibility: established([source("l", { statement: "y".repeat(2000) })]) });
    assert.ok(long.status === "built" && long.candidates[0]!.text.length === RELEVANCE_MAX_CANDIDATE_TEXT && long.candidates[0]!.textTruncated);
    assert.equal(resolveRelevanceLimit(undefined), RELEVANCE_MAX_SELECTIONS);
    assert.equal(resolveRelevanceLimit(0), 1);
    assert.equal(resolveRelevanceLimit(99), RELEVANCE_MAX_SELECTIONS);
    const judge = recordingJudge((input) => ({ status: "judged", selected: input.candidates.slice(0, 1).map((c) => ({ candidateId: c.candidateId, basis: "" })) }));
    await selectRelevant({ purpose: "internal-answer", task: "z".repeat(10_000), limit: 99 }, set, judge);
    assert.equal(judge.seen[0]!.task.length, 4000, "the task reaching a judge is bounded");
    assert.equal(judge.seen[0]!.limit, RELEVANCE_MAX_SELECTIONS);
    assert.deepEqual(Object.keys(judge.seen[0]!.candidates[0]!).sort(), ["candidateId", "text"], "a judge sees id and text only");
  }

  console.log("PASS relevance-0 contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
