/*
 * RELEVANCE-1 experiment runner. ONE strategy × ONE judge per process.
 *
 *   node --import tsx scripts/relevance-experiment/run.ts --strategy A|B --judge lexical|model [--parse strict|leading-json] --out <file.json>
 *
 * Disposable database, synthetic RELEVANCE-0 corpus, frozen gold labels. Writes results to --out
 * (outside the repository) and nothing else.
 *
 * MODEL JUDGE — RETIRED (APF-5). It reached Anthropic outside the governed generator; `--judge model`
 * now refuses before reading any credential. The recorded RELEVANCE-1/2 results stand as measured.
 *
 * SYNTHETIC-ONLY GUARD. Every request is checked BEFORE it is sent: the system text must be the
 * judge instruction, the task must be a corpus task, and every candidate line must be the bounded
 * text of a corpus fact. Anything else aborts the call before the transport is touched.
 */
import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../../tests/helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { RelevanceJudge } from "../../src/features/knowledge-retrieval/relevance";
import { QUERIES } from "../relevance-benchmark/corpus";
import { LEXICAL_ORDER_JUDGE, seedCorpus } from "../relevance-benchmark/engine";
import type { ModelJudgeCall } from "./model-judge";
import { measureStrategy, type Strategy, type StrategyRow } from "./strategies";


function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}


async function main(): Promise<void> {
  const strategy: Strategy = arg("strategy") === "B" ? "B-bounded-eligible" : "A-lexical-candidates";
  const judgeKind = arg("judge") === "model" ? "model" : "lexical";
  const out = arg("out");
  if (!out) throw new Error("--out <file.json> is required");

  const calls: ModelJudgeCall[] = [];
  const guarded = 0;
  const judge: RelevanceJudge = LEXICAL_ORDER_JUDGE;
  const model: string | null = null;

  if (judgeKind === "model") {
    /*
     * APF-5 — RETIRED. The live model judge reached Anthropic through `transport.send`, outside the
     * generator and its External AI Data-Use gate. Every egress now passes that boundary, and no
     * relevance-selection permission exists, so the measurement stays where RELEVANCE-1/2 recorded it.
     * `model-judge.ts` remains for its fake-transport tests; nothing here selects a transport.
     */
    throw new Error("the live model judge is retired (APF-5): external AI egress must pass the governed generator; nothing was sent");
  }

  const harness = createDisposablePostgresHarness("relevance1exp");
  await harness.createDatabase();
  let handle: ReturnType<typeof createControlPlaneDb> | undefined;
  let client: Client | undefined;
  const rows: StrategyRow[] = [];
  try {
    harness.migrateDatabase();
    handle = createControlPlaneDb(harness.dbUrl);
    client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    const seeded = await seedCorpus(client);
    const repo = createDurableKnowledgeRepository(handle.db);
    for (const purpose of ["internal-answer", "public-content-grounding"] as const) {
      for (const query of QUERIES) rows.push(await measureStrategy(strategy, query, purpose, seeded, repo, judge));
    }
  } finally {
    await client?.end().catch(() => undefined);
    await handle?.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  writeFileSync(out, JSON.stringify({ strategy, judge: judge.judgeId, model, guardedRequests: guarded, calls, rows }, null, 2));
  console.log(`${strategy} ${judge.judgeId}: ${rows.length} rows, ${calls.length} model calls, ${guarded} requests passed the synthetic guard → ${out}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
