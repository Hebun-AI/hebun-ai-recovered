/*
 * RELEVANCE-0 — the benchmark's invariants, against a REAL disposable PostgreSQL database.
 *
 * Not a quality gate: no recall or precision threshold is asserted, because none has been set. What
 * IS asserted is what must hold whatever the numbers are — no other tenant, no superseded or rejected
 * version, and no purpose-ineligible version ever reaches a candidate set; a relevant DENIED fact is
 * visible to internal answers and withheld from public grounding; a judge cannot smuggle a withheld
 * version back in; measuring writes nothing; and the run is deterministic. Two known lexical failures
 * are asserted AS failures, so an improvement has to be noticed rather than assumed (the KR3 rule).
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { searchKnowledge } from "../../src/features/knowledge/knowledge-read.server";
import { RETRIEVAL_MAX_LIMIT } from "../../src/features/knowledge-retrieval";
import { buildRelevanceCandidateSet, selectRelevant } from "../../src/features/knowledge-retrieval/relevance";
import { QUERIES } from "../../scripts/relevance-benchmark/corpus";
import { BENCH_NOW, fixtureEligibility, measureAll, seedCorpus, selectionFingerprint } from "../../scripts/relevance-benchmark/engine";

const COUNTED = [
  "knowledge_nodes", "knowledge_facts", "decision_records", "governance_sessions",
  "heby_action_requests", "action_permits", "action_execution_attempts", "messages",
  "heby_answer_evidence_set", "work_artifacts", "work_artifact_revisions",
];

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("relevance0baseline");
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

    const counts = async () => {
      const out: Record<string, number> = {};
      for (const table of COUNTED) out[table] = Number((await client!.query(`select count(*)::int n from ${table}`)).rows[0].n);
      return out;
    };
    const before = await counts();

    const first = await measureAll(seeded, repo);
    const second = await measureAll(seeded, repo);

    /* ── measuring writes nothing ─────────────────────────────────────────── */
    assert.deepEqual(await counts(), before, "the benchmark's measurement wrote nothing");

    /* ── deterministic ────────────────────────────────────────────────────── */
    assert.equal(selectionFingerprint(first), selectionFingerprint(second), "two runs select identically");
    assert.equal(first.length, QUERIES.length * 2);

    /* ── nothing ineligible, foreign, superseded or rejected is ever a candidate ── */
    for (const row of first) {
      assert.deepEqual(row.leakedIneligible, [], `${row.purpose}/${row.queryId}: no purpose-ineligible candidate`);
      assert.deepEqual(row.integrityViolations, [], `${row.purpose}/${row.queryId}: no other-tenant, superseded or rejected node`);
      for (const key of row.selectedKeys) assert.ok(row.candidateKeys.includes(key), `${row.queryId}: selection ⊆ candidates`);
    }

    /* ── a relevant DENIED fact: visible internally, withheld publicly ────── */
    const internal = first.find((r) => r.queryId === "q18" && r.purpose === "internal-answer")!;
    const publicRow = first.find((r) => r.queryId === "q18" && r.purpose === "public-content-grounding")!;
    assert.ok(internal.candidateKeys.includes("z-sourcing"), "internal answers may see the internal pricing fact");
    assert.ok(!publicRow.candidateKeys.includes("z-sourcing"), "public grounding never sees it");
    assert.deepEqual(publicRow.withheld.filter((w) => w.key === "z-sourcing"), [{ key: "z-sourcing", reason: "public-use-denied" }]);
    assert.deepEqual(publicRow.goldIneligible, ["z-sourcing"], "it is relevant — and ineligible, which is a different fact");

    /* ── a judge cannot put the withheld version back ─────────────────────── */
    {
      const retrieved = await searchKnowledge(
        { tenantId: seeded.tenantA },
        { queryText: "Ürün fiyatlarına ne kadar marj ekliyoruz?", limit: RETRIEVAL_MAX_LIMIT },
        { getRepo: () => repo, now: () => BENCH_NOW, readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: seeded.rejectedNodes }) },
      );
      assert.equal(retrieved.status, "matched");
      if (retrieved.status !== "matched") return;
      const sources = retrieved.candidates.map(({ record }) => ({
        nodeId: record.activeKnowledgeNodeId!,
        factId: record.factId,
        factKey: record.factKey,
        knowledgeVersion: record.knowledgeVersion,
        domainKey: record.domainKey,
        title: record.title,
        statement: record.statement,
      }));
      assert.ok(sources.some((s) => s.factKey === "z-sourcing"), "the pricing fact matched lexically");
      const gate = fixtureEligibility("public-content-grounding", sources);
      assert.ok(gate.withheld.some((w) => w.key === "z-sourcing" && w.reason === "public-use-denied"));
      const set = buildRelevanceCandidateSet({
        purpose: "public-content-grounding",
        eligibility: { status: "established", eligible: gate.eligible, withheldCount: gate.withheld.length },
      });
      const sourcingNode = seeded.nodeByKey.get("z-sourcing")!;
      const smuggler = {
        judgeId: "smuggler",
        kind: "deterministic" as const,
        async judge() {
          return { status: "judged" as const, selected: [{ candidateId: sourcingNode, basis: "most relevant" }] };
        },
      };
      const outcome = await selectRelevant({ purpose: "public-content-grounding", task: "pricing" }, set, smuggler);
      assert.deepEqual(
        outcome.status === "unavailable" ? outcome.reason : outcome.status,
        "judge-response-invalid",
        "a verdict naming a withheld version is void",
      );
    }

    /* ── tenant B's look-alikes never appear, whatever the wording ────────── */
    for (const row of first) {
      for (const key of row.candidateKeys) assert.ok(seeded.nodeByKey.has(key), `${row.queryId}: ${key} is tenant A's`);
    }

    /* ── known lexical failures, asserted as failures ─────────────────────── */
    const q02 = first.find((r) => r.queryId === "q02" && r.purpose === "public-content-grounding")!;
    assert.deepEqual(q02.missing, ["z-products", "z-materials"], "an English caption request does not reach the Turkish product fact (KNOWN FAILURE)");
    const q04 = first.find((r) => r.queryId === "q04" && r.purpose === "internal-answer")!;
    assert.deepEqual(q04.candidateKeys, [], "a Turkish question finds nothing in an English fact (KNOWN FAILURE)");

    console.log("PASS relevance-0 baseline invariants against PostgreSQL");
  } finally {
    await client?.end().catch(() => undefined);
    await handle?.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
