/*
 * GS-3 — score recorded semantic runs offline. No provider, no network.
 *
 *   node --import tsx scripts/grounding-semantic/score.ts <run.jsonl> [more runs…]
 *
 * Deterministic verdicts come from the UNCHANGED runtime evaluator. Semantic answers are read only
 * through `shadowOf`; compositions H1–H3 are hypothetical and computed here, never in the runtime.
 * Gold is each set's recorded label — none is human-validated ground truth.
 */
import { readFileSync } from "node:fs";
import { assessClaimSupport } from "../../src/features/knowledge-retrieval/claim-support";
import { BENCH_CASES, type SemanticCase } from "./cases";
import { composeH1, composeH2, composeH3, shadowOf, type SemanticAnswer, type Shadow } from "./contract";

export interface RunRow {
  readonly run: string;
  readonly bench: string;
  readonly id: string;
  readonly ms: number;
  readonly error: string | null;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly answer: SemanticAnswer;
}

type Det = ReturnType<typeof assessClaimSupport>["status"];
const unsupported = (g: string) => g === "insufficient" || g === "contradicted";
const warns = (s: string) => s === "insufficient" || s === "contradicted";

export function deterministicOf(c: SemanticCase): Det {
  const ev = c.evidence === null ? null : { provenance: c.provenance, items: c.evidence.map((text, i) => ({ nodeId: `E${i + 1}`, text })) };
  return assessClaimSupport(c.claim, ev).status;
}

export interface Scored {
  readonly c: SemanticCase;
  readonly det: Det;
  readonly shadow: Shadow | null;
  readonly h1: Det;
  readonly h2: Det;
  readonly h3: Det;
}

export function scoreRun(rows: readonly RunRow[]): readonly Scored[] {
  const byKey = new Map(rows.map((r) => [`${r.bench}:${r.id}`, r]));
  return BENCH_CASES.map((c) => {
    const det = deterministicOf(c);
    const row = byKey.get(`${c.bench}:${c.id}`);
    const shadow = row ? shadowOf(row.answer) : null;
    const s = shadow ?? "undetermined";
    return { c, det, shadow, h1: composeH1(det, s), h2: composeH2(det, s), h3: composeH3(det, s) };
  });
}

/** Metrics for one verdict column over a set of scored cases. */
export function metrics(rows: readonly Scored[], pick: (r: Scored) => string) {
  const n = (f: (r: Scored) => boolean) => rows.filter(f).length;
  const sup = rows.filter((r) => r.c.gold === "supported");
  const uns = rows.filter((r) => unsupported(r.c.gold));
  return {
    n: rows.length,
    falseSupported: n((r) => r.c.gold !== "supported" && ["supported", "would-support"].includes(pick(r))),
    falseInsufficient: sup.filter((r) => warns(pick(r))).length,
    retained: `${sup.filter((r) => ["supported", "would-support"].includes(pick(r))).length}/${sup.length}`,
    detected: `${uns.filter((r) => warns(pick(r))).length}/${uns.length}`,
    contradictionLabelled: `${n((r) => r.c.gold === "contradicted" && pick(r) === "contradicted")}/${n((r) => r.c.gold === "contradicted")}`,
    undetermined: n((r) => pick(r) === "undetermined"),
  };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error("usage: score.ts <run.jsonl>…");
  const runs = files.map((f) => readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l) as RunRow));
  for (const [i, rows] of runs.entries()) {
    const scored = scoreRun(rows);
    const answers = rows.map((r) => r.answer);
    const fail = (k: string) => answers.filter((a) => !a.ok && a.failure === k).length;
    console.log(`\n══ ${files[i]} — ${rows.length} semantic calls ══`);
    console.log({
      providerErrors: fail("provider-error"),
      malformed: answers.filter((a) => !a.ok && a.failure !== "provider-error").length,
      invalidLabels: fail("unknown-label"),
      unverifiedQuotes: answers.filter((a) => a.ok && !a.quotesVerified && (a.relation === "entailed" || a.relation === "contradicted")).length,
      caseNormalized: answers.filter((a) => a.ok && a.caseNormalized).length,
      inputTokens: rows.reduce((t, r) => t + r.inputTokens, 0),
      outputTokens: rows.reduce((t, r) => t + r.outputTokens, 0),
      msMedian: [...rows.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(rows.length / 2)],
      msP95: [...rows.map((r) => r.ms)].sort((a, b) => a - b)[Math.floor(rows.length * 0.95)],
    });
    const cols: [string, (r: Scored) => string][] = [
      ["deterministic", (r) => r.det],
      ["semantic shadow", (r) => r.shadow ?? r.det],
      ["H1 (proposed)", (r) => r.h1],
      ["H2 (upgrade U)", (r) => r.h2],
      ["H3 (upgrade U+I)", (r) => r.h3],
    ];
    for (const bench of ["gs0", "gs11", "heldout", "all"]) {
      const set = scored.filter((r) => bench === "all" || r.c.bench === bench);
      console.log(`\n${bench}`);
      for (const [name, pick] of cols) console.log(`  ${name.padEnd(18)}`, JSON.stringify(metrics(set, pick)));
    }
    const group = (label: string, key: (r: Scored) => string) => {
      console.log(`\nby ${label}: semantic shadow  [correct/n · FS · FI · U]   vs deterministic`);
      const keys = [...new Set(scored.map(key))].sort();
      for (const k of keys) {
        const g = scored.filter((r) => key(r) === k);
        const line = (pick: (r: Scored) => string) => {
          const ok = g.filter((r) => (r.c.gold === "supported" ? ["supported", "would-support"].includes(pick(r)) : unsupported(r.c.gold) ? warns(pick(r)) : pick(r) === "unavailable")).length;
          return `${ok}/${g.length} FS${g.filter((r) => r.c.gold !== "supported" && ["supported", "would-support"].includes(pick(r))).length} FI${g.filter((r) => r.c.gold === "supported" && warns(pick(r))).length} U${g.filter((r) => pick(r) === "undetermined").length}`;
        };
        console.log(`  ${k.padEnd(40)} ${line((r) => r.shadow ?? r.det).padEnd(22)} ${line((r) => r.det)}`);
      }
    };
    group("bench × category", (r) => `${r.c.bench}:${r.c.category}`);
    group("language × gold", (r) => `${r.c.lang}:${r.c.gold}`);
    group("multi-fact × gold", (r) => `${r.c.multiFact}:${r.c.gold}`);
    console.log("\nsemantic FALSE SUPPORTED cases:");
    for (const r of scored.filter((x) => x.c.gold !== "supported" && x.shadow === "would-support")) console.log(`  ${r.c.bench}:${r.c.id} gold=${r.c.gold} det=${r.det} :: ${r.c.claim}`);
    console.log("semantic FALSE INSUFFICIENT cases:");
    for (const r of scored.filter((x) => x.c.gold === "supported" && warns(x.shadow ?? ""))) console.log(`  ${r.c.bench}:${r.c.id} shadow=${r.shadow} det=${r.det} :: ${r.c.claim}`);
  }
  if (runs.length > 1) {
    const keyed = runs.map((rows) => new Map(rows.map((r) => [`${r.bench}:${r.id}`, shadowOf(r.answer)])));
    const keys = [...keyed[0]!.keys()].filter((k) => keyed.every((m) => m.has(k)));
    const unstable = keys.filter((k) => new Set(keyed.map((m) => m.get(k))).size > 1);
    console.log(`\nSTABILITY: ${unstable.length}/${keys.length} cases changed shadow label across ${runs.length} runs`);
    for (const k of unstable) console.log(`  ${k}: ${keyed.map((m) => m.get(k)).join(" | ")}`);
  }
}

if (process.argv[1]?.endsWith("grounding-semantic/score.ts")) main();
