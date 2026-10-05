/*
 * GS-1.1 — score an evaluator against the hand-labelled realistic cases. Run:
 *   node --import tsx scripts/grounding-benchmark/realistic.ts
 *
 * "correct" = gold supported → supported; gold insufficient/contradicted → insufficient or
 * contradicted; gold unavailable → unavailable. `undetermined` is an abstention, never correct and
 * never the dangerous error. The two errors are reported apart:
 *   FALSE SUPPORTED     actually unsupported (or unreadable) → said supported   (safety)
 *   FALSE INSUFFICIENT  actually supported → said insufficient                   (reviewer noise)
 */
import { assessClaimSupport, type ClaimSupport } from "../../src/features/knowledge-retrieval/claim-support";
import { CASES, FACTS, type RealisticCase } from "./realistic-cases";

type Assess = (claim: string, evidence: Parameters<typeof assessClaimSupport>[1]) => ClaimSupport;

export const evidenceOf = (c: RealisticCase) =>
  c.evidence === null ? null : { provenance: c.provenance, items: c.evidence.map((k) => ({ nodeId: k, text: FACTS[k]!.text })) };

export interface Row {
  readonly c: RealisticCase;
  readonly out: ClaimSupport["status"];
  readonly correct: boolean;
  readonly falseSupported: boolean;
  readonly falseInsufficient: boolean;
}

export function score(assess: Assess = assessClaimSupport): readonly Row[] {
  return CASES.map((c) => {
    const out = assess(c.claim, evidenceOf(c)).status;
    const unsupported = c.gold === "insufficient" || c.gold === "contradicted";
    return {
      c,
      out,
      correct:
        (c.gold === "supported" && out === "supported") ||
        (unsupported && (out === "insufficient" || out === "contradicted")) ||
        (c.gold === "unavailable" && out === "unavailable"),
      falseSupported: c.gold !== "supported" && out === "supported",
      falseInsufficient: c.gold === "supported" && out === "insufficient",
    };
  });
}

export function summary(rows: readonly Row[]) {
  const n = (f: (r: Row) => boolean) => rows.filter(f).length;
  const supported = n((r) => r.c.gold === "supported");
  const unsupported = n((r) => r.c.gold === "insufficient" || r.c.gold === "contradicted");
  return {
    cases: rows.length,
    supported,
    unsupported,
    falseSupported: n((r) => r.falseSupported),
    falseInsufficient: n((r) => r.falseInsufficient),
    retained: n((r) => r.c.gold === "supported" && r.out === "supported"),
    detected: n((r) => (r.c.gold === "insufficient" || r.c.gold === "contradicted") && (r.out === "insufficient" || r.out === "contradicted")),
    undetermined: n((r) => r.out === "undetermined"),
    contradictedTotal: n((r) => r.c.gold === "contradicted"),
    contradictedCaught: n((r) => r.c.gold === "contradicted" && r.out === "insufficient"),
    contradictedLabelled: n((r) => r.c.gold === "contradicted" && r.out === "contradicted"),
  };
}

function report(rows: readonly Row[], title: string): void {
  const s = summary(rows);
  const pct = (a: number, b: number) => `${a}/${b} (${b ? ((100 * a) / b).toFixed(1) : "0"}%)`;
  console.log(`\n══ ${title} — ${s.cases} cases (${s.supported} supported, ${s.unsupported} unsupported) ══`);
  console.log(`FALSE SUPPORTED (unsupported/unreadable → supported): ${pct(s.falseSupported, s.cases - s.supported)}`);
  console.log(`FALSE INSUFFICIENT (supported → warned):    ${pct(s.falseInsufficient, s.supported)}`);
  console.log(`supported retention:                        ${pct(s.retained, s.supported)}`);
  console.log(`unsupported detection:                      ${pct(s.detected, s.unsupported)}`);
  console.log(`undetermined:                               ${pct(s.undetermined, s.cases)}`);
  console.log(`contradictions: caught as insufficient ${s.contradictedCaught}/${s.contradictedTotal}, labelled contradicted ${s.contradictedLabelled}`);

  console.log("\nconfusion (gold → out):");
  const golds = ["supported", "insufficient", "contradicted", "unavailable"] as const;
  const outs = ["supported", "insufficient", "undetermined", "unavailable"] as const;
  console.log(`  ${"".padEnd(13)}${outs.map((o) => o.padStart(13)).join("")}`);
  for (const g of golds) console.log(`  ${g.padEnd(13)}${outs.map((o) => String(rows.filter((r) => r.c.gold === g && r.out === o).length).padStart(13)).join("")}`);

  const by = (label: string, key: (r: Row) => string) => {
    console.log(`\nby ${label}: correct / FS / FI / undetermined`);
    for (const k of [...new Set(rows.map(key))].sort()) {
      const g = rows.filter((r) => key(r) === k);
      console.log(`  ${k.padEnd(24)}${String(g.filter((r) => r.correct).length).padStart(3)}/${g.length}  FS ${g.filter((r) => r.falseSupported).length}  FI ${g.filter((r) => r.falseInsufficient).length}  U ${g.filter((r) => r.out === "undetermined").length}`);
    }
  };
  by("domain", (r) => r.c.domain);
  by("language", (r) => r.c.lang);
  by("category", (r) => r.c.category);

  console.log("\nfailure clusters (not correct), by authored capability need:");
  for (const need of [...new Set(rows.filter((r) => !r.correct).map((r) => r.c.need))].sort()) {
    const g = rows.filter((r) => !r.correct && r.c.need === need);
    console.log(`  ${need}: ${g.length}  [${g.map((r) => `${r.c.id}→${r.out}`).join(", ")}]`);
  }
}

if (process.argv[1]?.endsWith("grounding-benchmark/realistic.ts")) report(score(), "PASS 1 — runtime evaluator, unchanged");
