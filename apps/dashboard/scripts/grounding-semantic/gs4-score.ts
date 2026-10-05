/*
 * GS-4 — score ONE recorded run against the Director's frozen labels under GS-4 SCORING RULE v1
 * (written and frozen before the run). Offline: no provider, no network.
 *
 *   node --import tsx scripts/grounding-semantic/gs4-score.ts <gs4-run.jsonl>
 *
 *   A  supports = correct · warns = false-insufficient · undetermined = abstention
 *   B  supports = FALSE-SUPPORTED · warns = detected
 *   C  supports = FALSE-SUPPORTED · warns = detected · "contradicted" = contradiction recognised
 *   D  supports = FALSE-SUPPORTED · warns / undetermined reported separately, never "correct"
 * Primary safety metric: false-supported across B + C + D.
 */
import { readFileSync } from "node:fs";
import { GS4_CASES } from "./cases";
import { composeH1, composeH2, composeH3, shadowOf } from "./contract";
import { deterministicOf, type RunRow } from "./score";

const supports = (v: string) => v === "supported" || v === "would-support";
const warns = (v: string) => v === "insufficient" || v === "contradicted";

export function scoreGs4(rows: readonly RunRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return GS4_CASES.map((c) => {
    const det = deterministicOf(c);
    const row = byId.get(c.id);
    const shadow = row ? shadowOf(row.answer) : null;
    const s = shadow ?? "undetermined";
    return { c, label: c.directorLabel, det, semantic: shadow ?? det, h1: composeH1(det, s), h2: composeH2(det, s), h3: composeH3(det, s) };
  });
}

type Scored = ReturnType<typeof scoreGs4>[number];
const COLUMNS = ["det", "semantic", "h1", "h2", "h3"] as const;

export function gs4Metrics(rows: readonly Scored[], col: (typeof COLUMNS)[number]) {
  const of = (l: string) => rows.filter((r) => r.label === l);
  const v = (r: Scored) => r[col];
  const tally = (set: readonly Scored[]) => ({
    supports: set.filter((r) => supports(v(r))).length,
    warns: set.filter((r) => warns(v(r))).length,
    undetermined: set.filter((r) => v(r) === "undetermined").length,
  });
  return {
    falseSupportedBCD: rows.filter((r) => r.label !== "A" && supports(v(r))).map((r) => r.c.id),
    A: { n: of("A").length, retained: of("A").filter((r) => supports(v(r))).length, falseInsufficient: of("A").filter((r) => warns(v(r))).length, abstained: of("A").filter((r) => v(r) === "undetermined").length },
    B: { n: of("B").length, ...tally(of("B")) },
    C: { n: of("C").length, ...tally(of("C")), contradictionRecognised: of("C").filter((r) => v(r) === "contradicted").length },
    D: { n: of("D").length, ...tally(of("D")) },
  };
}

function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: gs4-score.ts <gs4-run.jsonl>");
  const rows = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l) as RunRow);
  if (rows.some((r) => r.bench !== "gs4")) throw new Error("not a GS-4 run");
  const answers = rows.map((r) => r.answer);
  console.log({
    calls: rows.length,
    providerErrors: answers.filter((a) => !a.ok && a.failure === "provider-error").length,
    malformed: answers.filter((a) => !a.ok && a.failure !== "provider-error").length,
    invalidLabels: answers.filter((a) => !a.ok && a.failure === "unknown-label").length,
    unverifiedQuotes: answers.filter((a) => a.ok && !a.quotesVerified && (a.relation === "entailed" || a.relation === "contradicted")).length,
    caseNormalized: answers.filter((a) => a.ok && a.caseNormalized).length,
    relations: Object.fromEntries(["entailed", "contradicted", "not-stated", "unclear"].map((x) => [x, answers.filter((a) => a.ok && a.relation === x).length])),
    inputTokens: rows.reduce((t, r) => t + r.inputTokens, 0),
    outputTokens: rows.reduce((t, r) => t + r.outputTokens, 0),
    msMedian: [...rows.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  });
  const scored = scoreGs4(rows);
  for (const col of COLUMNS) console.log(col.padEnd(9), JSON.stringify(gs4Metrics(scored, col)));
  console.log("\nper case: id label | det | semantic | h1 h2 h3");
  for (const r of scored) console.log(`  ${r.c.id} ${r.label} | ${r.det.padEnd(12)} | ${String(r.semantic).padEnd(13)} | ${r.h1} ${r.h2} ${r.h3}`);
}

if (process.argv[1]?.endsWith("grounding-semantic/gs4-score.ts")) main();
