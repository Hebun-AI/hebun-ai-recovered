/*
 * RELEVANCE-2B — candidate strategies and failure categories, against a REAL but DISPOSABLE database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Over the synthetic corpus, exhaustive bounded candidate generation (the runtime's own universe
 *    read and eligibility) puts every eligible gold fact in the candidate set for every task, leaks
 *    nothing ineligible, writes nothing and is deterministic. Lexical candidates are labelled
 *    `generated`, never `exhaustive`. Every failure is attributed to its cause — candidate generation
 *    and semantic gaps disappear under exhaustive generation, and what remains is grounding
 *    sufficiency and task understanding, not hidden by it."
 *
 * No provider, no model, no network, no production.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { QUERIES } from "../../scripts/relevance-benchmark/corpus";
import {
  classifyFailure,
  eligibleKeysFor,
  measureAll,
  seedCorpus,
  selectionFingerprint,
  type QueryMeasurement,
} from "../../scripts/relevance-benchmark/engine";

const ROOT = path.resolve(__dirname, "../..");
const BENCH = "scripts/relevance-benchmark";

/* ── 1. THE CLASSIFIER, on hand-made rows: one category per cause. ────────────────────────────── */
const row = (over: Partial<QueryMeasurement>): QueryMeasurement =>
  ({
    queryId: "x", strategy: "lexical", purpose: "internal-answer", classes: [], lang: "en", grounding: "organizational-facts-required",
    retrievalStatus: "matched", goldEligible: [], goldIneligible: [], candidateKeys: [], withheld: [], recallAt: {}, candidateRecall: null,
    missing: [], selectionStatus: "selected", selectedKeys: [], precision: null, falseInclusions: [], falseExclusions: [],
    noRelevantCorrect: null, leakedIneligible: [], integrityViolations: [], latencyMs: 0, universeCount: 0, generation: "generated",
    ...over,
  }) as QueryMeasurement;
assert.deepEqual(classifyFailure(row({ goldEligible: ["a"], classes: ["en-to-en"] })), ["A"], "a gold fact never generated");
assert.deepEqual(classifyFailure(row({ goldEligible: ["a"], classes: ["en-to-tr"] })), ["A", "B"], "… across a language gap");
assert.deepEqual(classifyFailure(row({ goldEligible: ["a"], candidateKeys: ["a"], selectedKeys: [] })), ["C"], "generated, then cut");
assert.deepEqual(classifyFailure(row({ selectedKeys: ["b"], falseInclusions: ["b"] })), ["D"], "nothing eligible to ground on, something handed on");
assert.deepEqual(classifyFailure(row({ grounding: "no-organizational-facts-required", selectedKeys: ["b"], falseInclusions: ["b"] })), ["F"]);
assert.deepEqual(classifyFailure(row({ goldIneligible: ["z"] })), ["E"], "a relevant fact correctly withheld");
assert.deepEqual(
  classifyFailure(row({ classes: ["generic-noise"], goldEligible: ["a"], candidateKeys: ["a", "b", "c"], selectedKeys: ["a", "b", "c"], falseInclusions: ["b", "c"] })),
  ["F"],
  "a generic task that over-returns",
);
assert.deepEqual(classifyFailure(row({ goldEligible: ["a"], candidateKeys: ["a"], selectedKeys: ["a"] })), [], "a clean row has no category");

/* ── 2. The benchmark reaches no model, provider or transport. ─────────────────────────────────── */
for (const file of readdirSync(path.join(ROOT, BENCH))) {
  const code = readFileSync(path.join(ROOT, BENCH, file), "utf8");
  for (const forbidden of ["heby-model", "relevance-judge", "relevance-experiment", "claude", "anthropic", "openai", "fetch("]) {
    assert.ok(!code.toLowerCase().includes(forbidden), `${BENCH}/${file} does not reach ${forbidden}`);
  }
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("relevance2bstrategies");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;
  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    const seeded = await seedCorpus(client);
    const repo = createDurableKnowledgeRepository(handle.db);
    const count = async () => Number((await client!.query("select count(*)::int n from knowledge_facts")).rows[0].n);
    const before = await count();

    const lexical = await measureAll(seeded, repo, "lexical");
    const exhaustive = await measureAll(seeded, repo, "exhaustive");
    assert.equal(selectionFingerprint(exhaustive), selectionFingerprint(await measureAll(seeded, repo, "exhaustive")), "exhaustive is deterministic");
    assert.equal(await count(), before, "measuring wrote nothing");

    /* ── 3. LABELS: lexical is generated, exhaustive is exhaustive — the RELEVANCE-2B repair. ── */
    assert.deepEqual([...new Set(lexical.map((r) => r.generation))], ["generated"], "lexical candidates are never labelled the whole universe");
    assert.deepEqual([...new Set(exhaustive.map((r) => r.generation))], ["exhaustive"]);

    /* ── 4. EXHAUSTIVE: every eligible gold is a candidate, nothing ineligible ever is. ───────── */
    for (const r of exhaustive) {
      if (r.goldEligible.length > 0) assert.equal(r.candidateRecall, 1, `${r.purpose}/${r.queryId}: every eligible gold is a candidate`);
      assert.deepEqual(r.leakedIneligible, [], `${r.purpose}/${r.queryId}: no purpose-ineligible candidate`);
      assert.deepEqual(r.integrityViolations, [], `${r.purpose}/${r.queryId}: no foreign, superseded or rejected candidate`);
      for (const key of r.candidateKeys) assert.ok(eligibleKeysFor(r.purpose).has(key), `${key} is eligible for ${r.purpose}`);
      assert.ok(!classifyFailure(r).includes("A") && !classifyFailure(r).includes("B"), `${r.purpose}/${r.queryId}: no generation or semantic miss`);
    }
    const universe = (purpose: string) => exhaustive.find((r) => r.purpose === purpose)!.universeCount;
    assert.equal(universe("internal-answer"), eligibleKeysFor("internal-answer").size, "the internal universe is every non-rejected fact");
    assert.equal(universe("public-content-grounding"), eligibleKeysFor("public-content-grounding").size, "the public universe is ratified + allowed only");

    /* ── 5. WHAT LEXICAL ACTUALLY FAILS AT: generation across language, never ranking. ───────── */
    const q09 = lexical.find((r) => r.queryId === "q09" && r.purpose === "internal-answer")!;
    assert.deepEqual(classifyFailure(q09).filter((c) => c === "A" || c === "B"), ["A", "B"], "EN→TR 'machine-made' misses the Turkish product fact");
    assert.ok(!lexical.some((r) => classifyFailure(r).includes("C")), "no lexical failure is a ranking failure");

    /* ── 6. WHAT EXHAUSTIVE DOES NOT SOLVE stays visible: q22/q23 public are still D. ────────── */
    for (const id of ["q22", "q23"]) {
      const r = exhaustive.find((x) => x.queryId === id && x.purpose === "public-content-grounding")!;
      assert.ok(classifyFailure(r).includes("D"), `${id}: no eligible fact can ground it, and exhaustive hands facts on anyway — grounding sufficiency, not relevance`);
    }
    assert.equal(lexical.length, QUERIES.length * 2);
    console.log("PASS relevance-2b strategies-postgres");
  } finally {
    await client?.end().catch(() => undefined);
    await handle?.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
