/*
 * GS-1.2 — score an evaluator against the frozen held-out cases. Run:
 *   node --import tsx scripts/grounding-benchmark/heldout.ts
 *
 * Same scoring as GS-1.1 (`realistic.ts`): `undetermined` is an abstention; the two errors are apart.
 *   FALSE SUPPORTED     actually unsupported (or unreadable) → said supported   (safety)
 *   FALSE INSUFFICIENT  actually supported → said insufficient                   (reviewer noise)
 */
import { assessClaimSupport, type ClaimSupport } from "../../src/features/knowledge-retrieval/claim-support";
import { HELDOUT_CASES, HELDOUT_FACTS, type HeldoutCase } from "./heldout-cases";

type Assess = (claim: string, evidence: Parameters<typeof assessClaimSupport>[1]) => ClaimSupport;

export const heldoutEvidenceOf = (c: HeldoutCase) =>
  c.evidence === null ? null : { provenance: c.provenance, items: c.evidence.map((k) => ({ nodeId: k, text: HELDOUT_FACTS[k]!.text })) };

export interface HeldoutRow {
  readonly c: HeldoutCase;
  readonly out: ClaimSupport["status"];
  readonly correct: boolean;
  readonly falseSupported: boolean;
  readonly falseInsufficient: boolean;
}

export function scoreHeldout(assess: Assess = assessClaimSupport): readonly HeldoutRow[] {
  return HELDOUT_CASES.map((c) => {
    const out = assess(c.claim, heldoutEvidenceOf(c)).status;
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

export function summarizeHeldout(rows: readonly HeldoutRow[]) {
  const n = (f: (r: HeldoutRow) => boolean) => rows.filter(f).length;
  const bad = (r: HeldoutRow) => r.c.gold === "insufficient" || r.c.gold === "contradicted";
  return {
    cases: rows.length,
    supported: n((r) => r.c.gold === "supported"),
    unsupported: n(bad),
    falseSupported: n((r) => r.falseSupported),
    falseInsufficient: n((r) => r.falseInsufficient),
    retained: n((r) => r.c.gold === "supported" && r.out === "supported"),
    detected: n((r) => bad(r) && (r.out === "insufficient" || r.out === "contradicted")),
    undetermined: n((r) => r.out === "undetermined"),
    unavailableKept: n((r) => r.c.gold === "unavailable" && r.out === "unavailable"),
  };
}

/** Per group: correct / FS / FI / undetermined. */
export function groupHeldout(rows: readonly HeldoutRow[], key: (r: HeldoutRow) => string) {
  const out: Record<string, { n: number; correct: number; fs: number; fi: number; u: number }> = {};
  for (const r of rows) {
    const g = (out[key(r)] ??= { n: 0, correct: 0, fs: 0, fi: 0, u: 0 });
    g.n++;
    if (r.correct) g.correct++;
    if (r.falseSupported) g.fs++;
    if (r.falseInsufficient) g.fi++;
    if (r.out === "undetermined") g.u++;
  }
  return out;
}

export function reportHeldout(rows: readonly HeldoutRow[], title: string): void {
  const s = summarizeHeldout(rows);
  console.log(`\n══ ${title} — ${s.cases} cases (${s.supported} supported, ${s.unsupported} unsupported) ══`);
  console.log(s);
  const show = (label: string, key: (r: HeldoutRow) => string) => {
    console.log(`by ${label}: correct/n FS FI U`);
    for (const [k, g] of Object.entries(groupHeldout(rows, key)).sort()) console.log(`  ${k.padEnd(30)}${g.correct}/${g.n}  FS ${g.fs}  FI ${g.fi}  U ${g.u}`);
  };
  show("candidate rule × gold side", (r) => `${r.c.rule ?? "-"}:${r.c.gold === "supported" ? "must-not-fire" : "should-fire"}`);
  show("category", (r) => r.c.category);
  show("language", (r) => r.c.lang);
  show("multi-fact", (r) => String(r.c.multiFact));
  show("domain", (r) => r.c.domain);
  show("gold", (r) => r.c.gold);
}

if (process.argv[1]?.endsWith("grounding-benchmark/heldout.ts")) reportHeldout(scoreHeldout(), "HELD-OUT — runtime evaluator");
