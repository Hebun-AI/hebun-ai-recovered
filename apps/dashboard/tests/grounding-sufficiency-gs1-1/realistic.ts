/*
 * GROUNDING SUFFICIENCY GS-1.1 — the realistic business-content benchmark, and what it measured.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "106 hand-labelled synthetic cases across five sectors, labelled in a module that cannot see the
 *    evaluator, score the UNCHANGED runtime evaluator at: 0 false-supported, 7 false-insufficient,
 *    16/47 supported retained, 47/57 unsupported detected. Every required case family is present.
 *    No provider, no database, no tenant data."
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CASES } from "../../scripts/grounding-benchmark/realistic-cases";
import { score, summary } from "../../scripts/grounding-benchmark/realistic";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const importsOf = (rel: string) => [...read(rel).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

/* 16 · no network. */
globalThis.fetch = (() => {
  throw new Error("GS-1.1 must not reach the network");
}) as typeof fetch;

/* 18 · the runtime evaluator is byte-for-byte the GS-1 release. A change needs Director approval and this pin. */
assert.equal(
  createHash("sha256").update(read("src/features/knowledge-retrieval/claim-support.ts")).digest("hex"),
  "c2183853edb8d9502855f4da95e389813e4ada4300a8bb24f4b4d44743e5de30",
  "claim-support.ts is unchanged from GS-1",
);

/* 1 · gold labels cannot depend on the evaluator: the case module imports nothing at all. */
assert.deepEqual(importsOf("scripts/grounding-benchmark/realistic-cases.ts"), []);

/* 2 · five sectors. 3 · no tenant-specific rule in the shared evaluator. */
assert.deepEqual([...new Set(CASES.map((c) => c.domain))].sort(), ["logistics", "manufacturing", "professional-services", "retail", "saas"]);
assert.ok(!/turkish rug|trh|zanzibar|lumen|cobalt|ferro|halden|orbis/i.test(read("src/features/knowledge-retrieval/claim-support.ts")));
assert.ok(CASES.length >= 80 && CASES.length <= 120, `${CASES.length} cases`);

/* 6 – 12 · every required family is present. */
const has = (pred: (c: (typeof CASES)[number]) => boolean, min: number, label: string) =>
  assert.ok(CASES.filter(pred).length >= min, `${label}: ${CASES.filter(pred).length}`);
has((c) => c.lang === "cross", 8, "cross-language");
has((c) => c.multiFact && c.gold === "supported", 5, "multi-fact support");
has((c) => c.need === "F", 4, "goal / positioning read as fact");
has((c) => c.category === "provenance", 3, "provenance / manufacturing escalation");
has((c) => ["numeric", "percentage", "quantity", "pricing", "date"].includes(c.category) && c.gold !== "supported", 8, "numeric escalation");
has((c) => (c.category === "universal" || c.category === "superlative") && c.gold === "insufficient", 6, "universal / superlative escalation");
has((c) => c.gold === "contradicted", 10, "contradictions");
has((c) => c.category === "bounded-universe", 6, "bounded universe");

/* The counters themselves: an evaluator that always says "supported" must score every unsupported and
 * unreadable case as false-supported; one that always says "insufficient" must warn every supported case. */
{
  const always = (status: "supported" | "insufficient") => () =>
    (status === "supported"
      ? { status, verifierKind: "deterministic", verifierId: "gs0-deterministic-sentence-identity", supportedNodeIds: [] }
      : { status, reason: "no-evidence" }) as never;
  assert.equal(summary(score(always("supported"))).falseSupported, CASES.filter((c) => c.gold !== "supported").length);
  assert.equal(summary(score(always("insufficient"))).falseInsufficient, CASES.filter((c) => c.gold === "supported").length);
}

/* 4 · 5 · the two errors, measured apart, on the unchanged evaluator (PASS 1). */
const rows = score();
const s = summary(rows);
assert.equal(s.falseSupported, 0, "SAFETY: no unsupported or unreadable case is called supported");
assert.equal(s.falseInsufficient, 7, "reviewer noise: supported claims warned as insufficient");
assert.equal(s.retained, 16);
assert.equal(s.detected, 47);
assert.equal(s.undetermined, 34);
assert.equal(rows.filter((r) => r.correct).length, 65);
assert.ok(rows.every((r) => !(r.correct && r.out === "undetermined")), "an abstention is never scored correct");
/* The labelled composition is pinned: changing a gold label must be a visible, reviewed edit. */
assert.deepEqual(
  ["supported", "insufficient", "contradicted", "unavailable"].map((g) => CASES.filter((c) => c.gold === g).length),
  [47, 44, 13, 2],
);

/* 13 · 14 · 15 */
for (const r of rows.filter((x) => x.c.category === "bounded-universe" && x.c.gold !== "supported")) assert.notEqual(r.out, "supported", r.c.id);
for (const r of rows.filter((x) => x.c.category === "no-evidence")) assert.equal(r.out, "insufficient", r.c.id);
for (const r of rows.filter((x) => x.c.gold === "unavailable")) assert.equal(r.out, "unavailable", r.c.id);

/* 17 · the benchmark is pure: no database, no provider, no tenant read. */
for (const file of ["scripts/grounding-benchmark/realistic.ts", "scripts/grounding-benchmark/realistic-cases.ts"]) {
  for (const imp of importsOf(file)) assert.ok(!/@\/db|drizzle|pg$|heby-model|server/.test(imp), `${file} imports ${imp}`);
}

console.log("PASS grounding-sufficiency-gs1-1 realistic");
