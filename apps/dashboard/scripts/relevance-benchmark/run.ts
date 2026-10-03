/*
 * RELEVANCE-0 lexical baseline.
 *
 *   node --import tsx scripts/relevance-benchmark/run.ts [--json]
 *
 * Creates a disposable database, migrates it, seeds the synthetic corpus, measures the current lexical
 * retrieval twice (the second run is the determinism check), prints the report and drops the
 * database. No provider, no network, no canonical or production database.
 */
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../../tests/helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { FACTS, QUERIES, type QueryClass } from "./corpus";
import { RECALL_KS, aggregate, measureAll, seedCorpus, selectionFingerprint, type Aggregate, type QueryMeasurement } from "./engine";

const pct = (value: number | null) => (value === null ? "  n/a" : `${(value * 100).toFixed(1).padStart(5)}%`);

function line(label: string, a: Aggregate): string {
  const recall = RECALL_KS.map((k) => `R@${k} ${pct(a.recallAt[k] ?? null)}`).join("  ");
  return (
    `${label.padEnd(26)} n=${String(a.queries).padStart(2)} gold=${String(a.withEligibleGold).padStart(2)}  ${recall}  ` +
    `cand ${pct(a.candidateRecall)}  P ${pct(a.meanPrecision)}  FI ${String(a.falseInclusions).padStart(3)}  ` +
    `FE ${String(a.falseExclusions).padStart(3)}  none-ok ${a.noRelevantCorrect}/${a.noRelevantQueries}  zero ${a.zeroCandidateQueries}`
  );
}

async function main(): Promise<void> {
  const json = process.argv.includes("--json");
  const harness = createDisposablePostgresHarness("relevance0bench");
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
    const trigram = await repo.hasTrigram();

    const first = await measureAll(seeded, repo);
    const second = await measureAll(seeded, repo);
    const deterministic = selectionFingerprint(first) === selectionFingerprint(second);

    if (json) {
      console.log(JSON.stringify({ trigram, deterministic, rows: first }, null, 2));
      return;
    }

    console.log(`RELEVANCE-0 lexical baseline — synthetic corpus: ${FACTS.length} facts, ${QUERIES.length} tasks × 2 purposes`);
    console.log(`pg_trgm installed: ${trigram}   deterministic across two runs: ${deterministic}`);
    console.log("candidate generation = searchKnowledge at the retrieval ceiling; selection = first N in lexical order (N = shipped default)\n");

    for (const purpose of ["internal-answer", "public-content-grounding"] as const) {
      const rows = first.filter((row) => row.purpose === purpose);
      const all = aggregate(rows);
      console.log(`── ${purpose} ──`);
      console.log(line("ALL", all));
      console.log(
        `${"".padEnd(26)} leaked-ineligible ${all.leakedIneligible}  integrity-violations ${all.integrityViolations}  ` +
          `latency median ${all.latencyMsMedian?.toFixed(1)} ms, max ${all.latencyMsMax?.toFixed(1)} ms`,
      );
      const classes = [...new Set(rows.flatMap((row) => row.classes))].sort() as QueryClass[];
      for (const cls of classes) console.log(line(`  ${cls}`, aggregate(rows.filter((row) => row.classes.includes(cls)))));
      console.log("");
    }

    console.log("── per task (public-content-grounding | internal-answer) ──");
    const byPurpose = (purpose: string) => new Map(first.filter((row) => row.purpose === purpose).map((row) => [row.queryId, row] as const));
    const pub = byPurpose("public-content-grounding");
    const int = byPurpose("internal-answer");
    const brief = (row: QueryMeasurement) =>
      `gold[${row.goldEligible.join(",") || "-"}] sel[${row.selectedKeys.join(",") || "-"}] miss[${row.missing.join(",") || "-"}] ` +
      `withheld[${row.withheld.map((w) => `${w.key}:${w.reason}`).join(",") || "-"}]`;
    for (const query of QUERIES) {
      console.log(`${query.id} [${query.classes.join(" ")}] ${query.grounding === "organizational-facts-required" ? "facts" : "no-facts"} — ${query.task}`);
      console.log(`    public   ${brief(pub.get(query.id)!)}`);
      console.log(`    internal ${brief(int.get(query.id)!)}`);
    }
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
