/*
 * RELEVANCE-1 — both candidate strategies against a REAL disposable database, with a FAKE judge.
 *
 * Asserted whatever a judge does: no other tenant, superseded, rejected or purpose-ineligible version
 * reaches a judge; strategy B hands the judge exactly the purpose-eligible set and refuses — never
 * truncates — when that set exceeds the bound; measuring writes nothing.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { RELEVANCE_MAX_CANDIDATES, type RelevanceJudge, type RelevanceJudgeInput } from "../../src/features/knowledge-retrieval/relevance";
import { QUERIES } from "../../scripts/relevance-benchmark/corpus";
import { eligibleKeysFor, seedCorpus } from "../../scripts/relevance-benchmark/engine";
import { measureStrategy } from "../../scripts/relevance-experiment/strategies";

const COUNTED = ["knowledge_nodes", "knowledge_facts", "decision_records", "governance_sessions", "heby_action_requests", "action_permits", "action_execution_attempts", "messages"];

/** Records what it was shown; selects nothing. */
function spyJudge(): RelevanceJudge & { seen: RelevanceJudgeInput[] } {
  const seen: RelevanceJudgeInput[] = [];
  return { judgeId: "spy", kind: "deterministic", seen, async judge(input) { seen.push(input); return { status: "judged", selected: [] }; } };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("relevance1strategies");
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
      for (const t of COUNTED) out[t] = Number((await client!.query(`select count(*)::int n from ${t}`)).rows[0].n);
      return out;
    };
    const before = await counts();

    for (const strategy of ["A-lexical-candidates", "B-bounded-eligible"] as const) {
      for (const purpose of ["internal-answer", "public-content-grounding"] as const) {
        for (const query of QUERIES) {
          const row = await measureStrategy(strategy, query, purpose, seeded, repo, spyJudge());
          assert.deepEqual(row.integrityViolations, [], `${strategy}/${purpose}/${query.id}: no other-tenant, superseded or rejected version`);
          assert.deepEqual(row.leakedIneligible, [], `${strategy}/${purpose}/${query.id}: no purpose-ineligible version`);
          assert.equal(row.refusedOverBound, false);
          if (strategy === "B-bounded-eligible") {
            assert.deepEqual([...row.candidateKeys].sort(), [...eligibleKeysFor(purpose)].sort(), `${purpose}: B shows the judge exactly the eligible set`);
          }
        }
      }
    }
    const pub = eligibleKeysFor("public-content-grounding");
    for (const never of ["z-sourcing", "z-objectives", "z-weaver-pay", "z-returns", "z-custom", "z-origin", "z-heritage"]) {
      assert.ok(!pub.has(never), `${never} is never public-eligible`);
    }
    assert.deepEqual(await counts(), before, "measuring wrote nothing");

    /* ── B refuses an eligible set larger than the bound; the judge is never asked ── */
    const extra = RELEVANCE_MAX_CANDIDATES - eligibleKeysFor("internal-answer").size + 1;
    for (let i = 0; i < extra; i += 1) {
      const nodeId = randomUUID();
      await client.query(
        `insert into knowledge_nodes (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health, knowledge_scope, knowledge_authority, domain_key, knowledge_version)
         values ($1,$2,'knowledge-fact',$3,$4,'draft','unknown','company-wide','provisional','filler',1)`,
        [nodeId, seeded.tenantA, `Filler ${i}`, `Synthetic filler record ${i}.`],
      );
      await client.query(
        `insert into knowledge_facts (tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version) values ($1,$2,'filler','company-wide',$3,1)`,
        [seeded.tenantA, `z-filler-${i}`, nodeId],
      );
    }
    const spy = spyJudge();
    const refused = await measureStrategy("B-bounded-eligible", QUERIES[0]!, "internal-answer", seeded, repo, spy);
    assert.equal(refused.refusedOverBound, true, "over the bound, B refuses");
    assert.equal(refused.outcome, "unavailable");
    assert.deepEqual(refused.candidateKeys, [], "nothing was truncated into a set");
    assert.equal(spy.seen.length, 0, "the judge was never asked");

    console.log("PASS relevance-1 strategies against PostgreSQL");
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
