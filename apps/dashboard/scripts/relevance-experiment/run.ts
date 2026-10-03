/*
 * RELEVANCE-1 experiment runner. ONE strategy × ONE judge per process.
 *
 *   node --import tsx scripts/relevance-experiment/run.ts --strategy A|B --judge lexical|model [--parse strict|leading-json] --out <file.json>
 *
 * Disposable database, synthetic RELEVANCE-0 corpus, frozen gold labels. Writes results to --out
 * (outside the repository) and nothing else.
 *
 * MODEL JUDGE. The transport comes from the repository's one selection authority,
 * `selectModelTransport`, in `live` mode with the developer credential from `apps/dashboard/.env.local`
 * (only ANTHROPIC_API_KEY and HEBUN_MODEL_ID are read; no other file, no production env). One fresh
 * transport per call, as runtime does; the per-process live-call budget stays the existing
 * authority's (set to its documented maximum, 100). The run refuses to start if its planned calls
 * exceed that budget.
 *
 * SYNTHETIC-ONLY GUARD. Every request is checked BEFORE it is sent: the system text must be the
 * judge instruction, the task must be a corpus task, and every candidate line must be the bounded
 * text of a corpus fact. Anything else aborts the call before the transport is touched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../../tests/helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { selectModelTransport } from "../../src/features/heby-model/model-transport-selection.server";
import type { RelevanceJudge } from "../../src/features/knowledge-retrieval/relevance";
import { QUERIES } from "../relevance-benchmark/corpus";
import { LEXICAL_ORDER_JUDGE, seedCorpus } from "../relevance-benchmark/engine";
import { createModelRelevanceJudge, type ModelJudgeCall } from "./model-judge";
import { assertSyntheticRequest } from "./synthetic-guard";
import { measureStrategy, type Strategy, type StrategyRow } from "./strategies";

const DEV_ENV_FILE = "/Users/senolsevim/Developer/Hebun AI/apps/dashboard/.env.local";
const PROCESS_LIVE_CALL_BUDGET = 100;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readDevValue(raw: string, key: string): string | undefined {
  const match = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, "m").exec(raw);
  return match ? match[1]!.replace(/^["']|["']$/g, "") : undefined;
}

async function main(): Promise<void> {
  const strategy: Strategy = arg("strategy") === "B" ? "B-bounded-eligible" : "A-lexical-candidates";
  const judgeKind = arg("judge") === "model" ? "model" : "lexical";
  const out = arg("out");
  const parseMode = arg("parse") === "leading-json" ? "leading-json" : "strict";
  if (!out) throw new Error("--out <file.json> is required");

  const calls: ModelJudgeCall[] = [];
  let guarded = 0;
  let judge: RelevanceJudge = LEXICAL_ORDER_JUDGE;
  let model: string | null = null;

  if (judgeKind === "model") {
    const raw = readFileSync(DEV_ENV_FILE, "utf8");
    const apiKey = readDevValue(raw, "ANTHROPIC_API_KEY");
    model = readDevValue(raw, "HEBUN_MODEL_ID") ?? null;
    if (!apiKey || !model) throw new Error("the developer model configuration is incomplete; nothing was sent");
    process.env.HEBUN_MODEL_LIVE_CALL_BUDGET = String(PROCESS_LIVE_CALL_BUDGET);
    const selectionEnv = { HEBUN_MODEL_TRANSPORT: "live", ANTHROPIC_API_KEY: apiKey };
    const planned = QUERIES.length * 2;
    if (planned > PROCESS_LIVE_CALL_BUDGET) throw new Error(`planned ${planned} calls exceed the process budget`);
    judge = createModelRelevanceJudge({
      model,
      parseMode,
      transport: () => selectModelTransport(selectionEnv).transport,
      onRequest: (request) => {
        assertSyntheticRequest(request);
        guarded += 1;
      },
      onCall: (call) => calls.push(call),
    });
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
