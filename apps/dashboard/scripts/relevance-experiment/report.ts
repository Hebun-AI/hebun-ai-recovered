/*
 * RELEVANCE-1 report: aggregates result files written by run.ts. Reads files; sends nothing.
 *
 *   node --import tsx scripts/relevance-experiment/report.ts <label=file.json>...
 *
 * Several files with the same label are treated as repeated runs of one configuration.
 *
 * ── LIMITATIONS THAT TRAVEL WITH EVERY NUMBER THIS PRINTS ────────────────────
 *
 * These are EVALUATION EVIDENCE, not product guarantees:
 *   - the corpus is small and synthetic, and its gold labels were assigned by ONE human;
 *   - strict parsing (pre-registered) exposed malformed model output — JSON followed by prose;
 *   - the `leading-json` parse mode was introduced POST-HOC, after the first live run;
 *   - structured output is NOT implemented — the transport sends no output schema;
 *   - the transport sends no temperature, and three runs do not establish deterministic behaviour;
 *   - the model showed NEAR-SUBSTITUTE selection: when the right fact is withheld upstream it may
 *     select an adjacent eligible fact instead of returning nothing;
 *   - token counts are measured; the dollar cost was NOT verified.
 */
import { readFileSync } from "node:fs";
import type { QueryClass } from "../relevance-benchmark/corpus";
import type { ModelJudgeCall } from "./model-judge";
import { aggregateRows, type StrategyAggregate, type StrategyRow } from "./strategies";

interface RunFile {
  readonly strategy: string;
  readonly judge: string;
  readonly model: string | null;
  readonly guardedRequests: number;
  readonly calls: readonly ModelJudgeCall[];
  readonly rows: readonly StrategyRow[];
}

const pct = (v: number | null) => (v === null ? "  n/a" : `${(v * 100).toFixed(1).padStart(5)}%`);
const CLASSES: readonly QueryClass[] = ["en-to-tr", "tr-to-en", "tr-to-tr", "en-to-en", "low-overlap", "paraphrase", "no-relevant", "company-name", "generic-noise", "multi-relevant", "internal-distractor", "voice-only"];

function line(label: string, a: StrategyAggregate): string {
  return (
    `${label.padEnd(22)} gold=${String(a.withGold).padStart(2)} R@1 ${pct(a.recallAt1)} R@3 ${pct(a.recallAt3)} R@8 ${pct(a.recallAt8)} ` +
    `cand ${pct(a.candidateRecall)} final ${pct(a.finalRecall)} P ${pct(a.precision)} FI ${String(a.falseInclusions).padStart(3)} ` +
    `FE ${String(a.falseExclusions).padStart(3)} [miss: cand ${a.missedByCandidates} / judge ${a.missedByJudge}] none-ok ${a.noRelevantCorrect}/${a.noRelevantTotal} ` +
    `unavail ${a.unavailable} invalid ${a.invalid}`
  );
}

function main(): void {
  const groups = new Map<string, RunFile[]>();
  for (const spec of process.argv.slice(2)) {
    const [label, file] = spec.split("=");
    const parsed = JSON.parse(readFileSync(file!, "utf8")) as RunFile;
    groups.set(label!, [...(groups.get(label!) ?? []), parsed]);
  }

  for (const [label, runs] of groups) {
    const first = runs[0]!;
    console.log(`\n════ ${label} — ${first.strategy} · ${first.judge}${first.model ? ` · ${first.model}` : ""} · ${runs.length} run(s)`);
    for (const purpose of ["internal-answer", "public-content-grounding"] as const) {
      console.log(`── ${purpose}`);
      runs.forEach((run, index) => {
        const rows = run.rows.filter((row) => row.purpose === purpose);
        console.log(line(`  run ${index + 1} ALL`, aggregateRows(rows)));
        if (index === 0) for (const cls of CLASSES) {
          const sub = rows.filter((row) => row.classes.includes(cls));
          if (sub.length) console.log(line(`    ${cls}`, aggregateRows(sub)));
        }
        const a = aggregateRows(rows);
        if (a.leakedIneligible || a.integrityViolations || a.refusedOverBound) {
          console.log(`    leaked ${a.leakedIneligible} integrity ${a.integrityViolations} refused-over-bound ${a.refusedOverBound}`);
        }
      });
    }

    /* Stability: same (purpose, query) across runs. */
    if (runs.length > 1) {
      const changed: string[] = [];
      const noRelFlips: string[] = [];
      for (const row of first.rows) {
        const variants = runs.map((run) => run.rows.find((r) => r.purpose === row.purpose && r.queryId === row.queryId)!);
        const signatures = new Set(variants.map((v) => `${v.outcome}|${v.selectedKeys.join(",")}`));
        if (signatures.size > 1) {
          changed.push(`${row.purpose === "internal-answer" ? "int" : "pub"}/${row.queryId}[${row.classes.join(" ")}]: ${[...signatures].join("  ≠  ")}`);
          if (row.goldEligible.length === 0) noRelFlips.push(`${row.purpose}/${row.queryId}`);
        }
      }
      console.log(`── stability: ${changed.length} of ${first.rows.length} (purpose, task) pairs changed across ${runs.length} runs; no-relevant flips: ${noRelFlips.length}`);
      for (const c of changed) console.log(`    ${c}`);
    }

    const calls = runs.flatMap((run) => run.calls);
    if (calls.length) {
      const lat = calls.map((c) => c.latencyMs).sort((a, b) => a - b);
      const sum = (pick: (c: ModelJudgeCall) => number | null) => calls.reduce((t, c) => t + (pick(c) ?? 0), 0);
      const by = (r: ModelJudgeCall["result"]) => calls.filter((c) => c.result === r).length;
      console.log(
        `── model calls ${calls.length} (parsed ${by("parsed")}, malformed ${by("malformed")}, transport-error ${by("transport-error")})  ` +
          `guarded requests ${runs.reduce((t, r) => t + r.guardedRequests, 0)}  models ${[...new Set(calls.map((c) => c.model))].join(",")}`,
      );
      console.log(
        `   tokens in ${sum((c) => c.inputTokens)} out ${sum((c) => c.outputTokens)}  (per call in ${Math.round(sum((c) => c.inputTokens) / calls.length)} out ${Math.round(sum((c) => c.outputTokens) / calls.length)})  ` +
          `latency median ${lat[Math.floor(lat.length / 2)]!.toFixed(0)} ms p95 ${lat[Math.floor(lat.length * 0.95)]!.toFixed(0)} ms max ${lat[lat.length - 1]!.toFixed(0)} ms`,
      );
      const errors = calls.filter((c) => c.errorCode).map((c) => c.errorCode);
      if (errors.length) console.log(`   transport errors: ${errors.join(",")}`);
    }
  }
}

main();
