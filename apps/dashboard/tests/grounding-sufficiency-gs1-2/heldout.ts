/*
 * GROUNDING SUFFICIENCY GS-1.2 — held-out validation, and the three rules it validated.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "A 92-case held-out set, frozen before any evaluator ran on it and sharing no record, claim or
 *    organization with GS-0/GS-1.1, scores the runtime evaluator at 0 false-supported. Of the four
 *    GS-1.1 candidate rules, the three the held-out set validated (hyphenated names, scope escalation,
 *    an aim restated as fact) are in the runtime; the calendar-word rule is NOT. Advisory only: no
 *    new verdict or signal vocabulary, no provider, no database, no readiness reader."
 *
 * Held-out comparison, recorded (A = GS-1 runtime c2183853, B = GS-1.1 four-rule candidate):
 *   A: FS 0 · FI 16 · retained 9/52 · detected 24/38 · undetermined 41
 *   B: FS 0 · FI 16 · retained 9/52 · detected 28/38 · undetermined 37
 *   runtime (B without calendar): FS 0 · FI 16 · retained 9/52 · detected 29/38 · undetermined 36
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { assessClaimSupport } from "../../src/features/knowledge-retrieval/claim-support";
import { HELDOUT_CASES, HELDOUT_FACTS } from "../../scripts/grounding-benchmark/heldout-cases";
import { heldoutEvidenceOf, scoreHeldout, summarizeHeldout } from "../../scripts/grounding-benchmark/heldout";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const importsOf = (rel: string) => [...read(rel).matchAll(/^\s*(?:import\b[^;"']*?|export\b[^;"']*?from\s*)["']([^"']+)["']/gm)].map((m) => m[1]);
const sha = (rel: string) => createHash("sha256").update(read(rel)).digest("hex");

globalThis.fetch = (() => {
  throw new Error("GS-1.2 must not reach the network");
}) as typeof fetch;

/* ── the held-out corpus: frozen, label-independent, disjoint from GS-0 / GS-1.1 ── */

/* Frozen before the first evaluator run (2026-10-05T10:46:51Z). Editing a case is a new, visible benchmark. */
assert.equal(sha("scripts/grounding-benchmark/heldout-cases.ts"), "74ffebddca09fd1d8cc3a04d1142c11007ec20dcf1ebed49597ee31e4fba053c");
assert.deepEqual(importsOf("scripts/grounding-benchmark/heldout-cases.ts"), [], "gold cannot follow the evaluator");

{
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const earlier = ["scripts/grounding-benchmark/benchmark.ts", "scripts/grounding-benchmark/realistic-cases.ts"]
    .flatMap((f) => [...read(f).matchAll(/"([^"]{12,})"/g)].map((m) => norm(m[1]!)));
  const earlierText = ` ${earlier.join(" | ")} `;
  const mine = [...Object.values(HELDOUT_FACTS).map((f) => f.text), ...HELDOUT_CASES.map((c) => c.claim)].map(norm);
  for (const s of mine) {
    assert.ok(!earlier.includes(s), `reused: ${s}`);
    const w = s.split(" ");
    for (let i = 0; i + 5 <= w.length; i++) assert.ok(!earlierText.includes(` ${w.slice(i, i + 5).join(" ")} `), `shared 5-gram in: ${s}`);
  }
  for (const org of ["zanzibar", "cobalt", "ferro", "halden", "lumen", "orbis"]) assert.ok(!mine.some((s) => ` ${s} `.includes(` ${org} `)), org);
  for (const org of ["morrow", "alder", "brightpath", "kestrel", "solvane", "derin"]) assert.ok(!` ${earlier.join(" ")} `.includes(` ${org} `), org);
}

assert.deepEqual(
  ["supported", "insufficient", "contradicted", "unavailable"].map((g) => HELDOUT_CASES.filter((c) => c.gold === g).length),
  [52, 29, 9, 2],
);
assert.equal(new Set(HELDOUT_CASES.map((c) => c.domain)).size, 6);
for (const rule of ["hyphen", "calendar", "scope", "aspiration"] as const) {
  assert.ok(HELDOUT_CASES.some((c) => c.rule === rule && c.gold === "supported"), `${rule}: must-not-fire case`);
  assert.ok(HELDOUT_CASES.some((c) => c.rule === rule && c.gold !== "supported"), `${rule}: should-fire case`);
}
assert.ok(!/morrow|alder|brightpath|kestrel|solvane|derin/i.test(read("src/features/knowledge-retrieval/claim-support.ts")), "no case-specific rule");

/* ── the runtime on the held-out set ── */

const rows = scoreHeldout();
assert.deepEqual(summarizeHeldout(rows), {
  cases: 92, supported: 52, unsupported: 38,
  falseSupported: 0, falseInsufficient: 16, retained: 9, detected: 29, undetermined: 36, unavailableKept: 2,
});

const at = (id: string) => {
  const c = HELDOUT_CASES.find((x) => x.id === id);
  assert.ok(c, id);
  return assessClaimSupport(c.claim, heldoutEvidenceOf(c));
};
const signalsOf = (id: string) => {
  const r = at(id);
  return r.status === "insufficient" && r.reason === "unsupported-signal" ? r.signals : [];
};

/* Rule 1 · hyphenated words are read part by part: "X-ray", "Self-Consumption" are not unrecorded names. */
for (const id of ["h-xray-para", "v-programme"]) assert.ok(!signalsOf(id).includes("proper-noun"), id);
assert.ok(signalsOf("v-other-scheme").length > 0, "an unrecorded hyphenated scheme is still caught");

/* Rule 2 · scope escalation (unlimited / worldwide / sınırsız / dünya çapında) is a universal. */
for (const id of ["k-global", "v-warranty-unlimited", "d-dunya", "d-sinirsiz"]) assert.ok(signalsOf(id).includes("universal"), id);
for (const id of ["h-checkups", "o-sauna", "v-phone"]) assert.ok(!signalsOf(id).includes("universal"), `${id}: recorded scope is not escalation`);

/* Rule 3 · a supplied aim restated as a current fact; the aim kept as an aim is not flagged. */
for (const id of ["h-porto-fact", "e-online-fact", "v-goal-fact", "d-abroad-fact"]) assert.deepEqual(signalsOf(id), ["current-state"], id);
for (const id of ["h-porto-keep", "o-renew-keep", "e-online-keep", "d-abroad-keep"]) assert.notEqual(at(id).status, "insufficient", id);

/* The calendar-word rule was NOT validated (no held-out benefit; it hid a real contradiction): a month
 * the record does not state is still an unrecorded name. */
assert.deepEqual(signalsOf("o-december"), ["proper-noun"]);

/* No new vocabulary: every signal the runtime emits on the held-out set is one GS-0 already had. */
const KNOWN = ["number", "proper-noun", "superlative", "universal", "production-method", "causal", "current-state"];
for (const c of HELDOUT_CASES) for (const s of signalsOf(c.id)) assert.ok(KNOWN.includes(s), `${c.id}: ${s}`);

/* ── what is NOT support ── */

/* `matched` is not support; `bounded-universe` is not support; how evidence was chosen changes nothing. */
for (const c of HELDOUT_CASES.filter((x) => x.evidence && x.evidence.length > 0)) {
  const items = c.evidence!.map((k) => ({ nodeId: k, text: HELDOUT_FACTS[k]!.text }));
  const base = JSON.stringify(assessClaimSupport(c.claim, { provenance: "matched", items }));
  for (const provenance of ["bounded-universe", "no-match"] as const) assert.equal(JSON.stringify(assessClaimSupport(c.claim, { provenance, items })), base, c.id);
}
for (const r of rows.filter((x) => x.c.provenance === "bounded-universe" && x.c.gold !== "supported")) assert.notEqual(r.out, "supported", r.c.id);
for (const r of rows.filter((x) => x.c.provenance === "matched" && x.c.gold !== "supported")) assert.notEqual(r.out, "supported", r.c.id);

/* Missing or unreadable evidence is never support — not even for a verbatim claim. */
const verbatim = HELDOUT_FACTS.h1!.text;
assert.deepEqual(assessClaimSupport(verbatim, null), { status: "unavailable" });
assert.deepEqual(assessClaimSupport(verbatim, { provenance: "unavailable", items: [{ nodeId: "h1", text: verbatim }] }), { status: "unavailable" });
assert.deepEqual(assessClaimSupport(verbatim, { provenance: "no-match", items: [] }), { status: "insufficient", reason: "no-evidence" });

/* Ratification, public-use clearance and current Knowledge never reach the evaluator: it imports only
 * the evidence type and text folding, and only the KT-2 revision-evidence pair imports it. */
assert.deepEqual(importsOf("src/features/knowledge-retrieval/claim-support.ts"), ["./evidence", "./query-normalization"]);
{
  const files = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir)).flatMap((f) => {
      const rel = path.join(dir, f);
      return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : /\.tsx?$/.test(f) ? [rel] : [];
    });
  const readers = files("src").filter((f) => !f.endsWith("claim-support.ts") && /knowledge-retrieval\/claim-support["']/.test(read(f)));
  assert.deepEqual(readers.sort(), [
    "src/features/heby-answer/revision-generation-evidence.server.ts",
    "src/features/heby-answer/revision-generation-evidence.ts",
  ], "no readiness, review, Governance or publication reader");
}

console.log("PASS grounding-sufficiency-gs1-2 heldout");
