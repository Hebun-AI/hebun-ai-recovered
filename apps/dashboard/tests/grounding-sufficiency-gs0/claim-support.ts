/*
 * GROUNDING SUFFICIENCY GS-0 — the deterministic claim-support evaluator, over the hand-labelled
 * synthetic benchmark. No database, no model, no network.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Nothing that is unsupported, unavailable or merely supplied is ever called supported. `supported`
 *    is reached only when the claim is a whole sentence of one supplied record. How the evidence was
 *    chosen (matched / bounded-universe), its ratification and its public-use clearance cannot move a
 *    verdict. The evaluator is pure, read only by the reviewer's advisory evidence read (GS-1), and
 *    touches no eligibility, persistence or B2 authority."
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { CASES, PUBLIC_ELIGIBLE, evidenceOf, measure } from "../../scripts/grounding-benchmark/benchmark";
import { ELIGIBILITY } from "../../scripts/relevance-benchmark/corpus";
import { assessClaimSupport, CLAIM_SUPPORT_VERIFIER_ID } from "../../src/features/knowledge-retrieval/claim-support";
import { assessGrounding } from "../../src/features/knowledge-retrieval/grounding";
import type { RelevanceCandidate, RelevanceOutcome } from "../../src/features/knowledge-retrieval/relevance";
import { PURPOSES } from "../../src/features/external-ai-data-use/contracts";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const code = (rel: string) => read(rel).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const byId = (id: string) => {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return assessClaimSupport(c.claim, evidenceOf(c));
};
const statusOf = (id: string) => byId(id).status;

/* 17 · no network: any fetch during evaluation fails the run. */
globalThis.fetch = (() => {
  throw new Error("GS-0 must not reach the network");
}) as typeof fetch;

/* Measured floor. THE invariant is the first line; the others guard against silently losing coverage. */
const m = measure();
assert.equal(m.falseSupported, 0, "no unsupported, contradicted or unavailable case is ever called supported");
assert.ok(m.detected >= 23, `unsupported-claim detection did not regress (${m.detected}/${m.unsupportedTotal})`);
assert.ok(m.supportedRetained >= 4, `exact supported claims are still retained (${m.supportedRetained}/${m.supportedTotal})`);
assert.equal(m.unavailableCorrect, 1);

/* 1 · 2 · q22 / q23 stay insufficient — never supported, and the full claims are flagged. */
for (const id of ["q22-full", "q22-short", "q23-tr", "q23-en"]) assert.notEqual(statusOf(id), "supported", id);
for (const id of ["q22-full", "q23-tr", "q23-en"]) assert.equal(statusOf(id), "insufficient", id);

/* 3 · 6 · how evidence was chosen cannot move a verdict: every case, every provenance but unavailable. */
for (const c of CASES.filter((x) => x.evidence !== null)) {
  const base = JSON.stringify(assessClaimSupport(c.claim, evidenceOf(c)));
  for (const provenance of ["matched", "bounded-universe", "no-match", "empty-corpus", "empty-query"] as const) {
    const items = evidenceOf(c)!.items;
    assert.equal(JSON.stringify(assessClaimSupport(c.claim, { provenance, items })), base, `${c.id}: ${provenance} changes nothing`);
  }
}
assert.equal(statusOf("i-universe-none"), "insufficient", "seven supplied records are not support");
assert.notEqual(statusOf("i-universe-none-2"), "supported");
assert.equal(statusOf("i-matched-unsupported"), "insufficient", "a lexically matched record is not support");

/* 4 · 5 · every supplied record is RATIFIED + public-use ALLOWED; that still supports nothing it does not say. */
for (const c of CASES) for (const key of c.evidence ?? []) assert.ok(PUBLIC_ELIGIBLE.includes(key) && ELIGIBILITY[key]!.ratified && ELIGIBILITY[key]!.publicUse === "allowed", `${c.id}: ${key}`);
for (const r of m.rows.filter((x) => x.c.gold !== "supported" && x.c.gold !== "unavailable")) assert.notEqual(r.out.status, "supported", r.c.id);

/* 7 · an exact sentence stays supported, naming the one record that says it. */
for (const [id, node] of [["s-exact-en", "z-materials"], ["s-exact-tr", "z-sizes"], ["s-one-of-many", "z-care"], ["s-clause", "z-shipping"]] as const) {
  assert.deepEqual(byId(id), { status: "supported", verifierKind: "deterministic", verifierId: CLAIM_SUPPORT_VERIFIER_ID, supportedNodeIds: [node] }, id);
}

/* 8 – 11 · escalations are caught (or, at worst, abstained — never supported). */
const signals = (id: string) => {
  const out = byId(id);
  return out.status === "insufficient" && out.reason === "unsupported-signal" ? out.signals : [];
};
assert.ok(signals("i-quantity").includes("number") && signals("i-percent").includes("number") && signals("i-date").includes("number"), "numbers");
assert.ok(signals("i-superlative").includes("superlative") && signals("i-superlative-tr").includes("superlative"), "superlatives");
assert.ok(signals("i-artisan").includes("production-method") && signals("i-artisan-tr").includes("production-method"), "production method");
assert.ok(signals("i-named-artisan").includes("proper-noun"), "proper noun");
assert.ok(signals("i-artisan").includes("universal") && signals("i-causal").includes("causal") && signals("i-current").includes("current-state"));

/* 12 · contradiction is never supported. */
for (const c of CASES.filter((x) => x.gold === "contradicted")) assert.notEqual(statusOf(c.id), "supported", c.id);

/* 13 · joint support is representable — by a human verdict through RELEVANCE-2A's existing port. */
{
  const candidate = (key: string): RelevanceCandidate => ({ nodeId: key, factId: key, factKey: key, knowledgeVersion: 1, domainKey: "d", text: key, textTruncated: false });
  const relevance = {
    status: "selected", purpose: "public-content-grounding", candidateCount: 2, judge: {} as never, degradedReason: null, exhaustive: true,
    selections: ["z-shipping", "z-materials"].map((key, i) => ({ candidate: candidate(key), rank: i + 1, basis: "b" })),
  } as RelevanceOutcome;
  const joint = assessGrounding({ requirement: "organizational-facts-required", relevance, support: { status: "verified", verifierId: "director", verifierKind: "human", supportedNodeIds: ["z-shipping", "z-materials"] } });
  assert.equal(joint.status, "sufficient");
  assert.deepEqual(joint.status === "sufficient" ? joint.supportedBy.map((s) => s.candidate.nodeId) : [], ["z-shipping", "z-materials"]);
  /* The deterministic verdict is a valid support verdict for the same port. */
  const exact = byId("s-exact-en");
  assert.equal(exact.status, "supported");
  if (exact.status === "supported") {
    const one = assessGrounding({ requirement: "organizational-facts-required", relevance, support: { ...exact, status: "verified" } });
    assert.equal(one.status, "sufficient");
  }
  assert.notEqual(statusOf("s-multi"), "supported", "the deterministic evaluator itself never claims joint support");
}

/* 14 · 15 · nothing supplied is insufficient; unreadable is unavailable. */
assert.deepEqual(byId("i-no-evidence"), { status: "insufficient", reason: "no-evidence" });
assert.deepEqual(byId("u-unreadable"), { status: "unavailable" });
assert.deepEqual(assessClaimSupport("Our rugs are made from undyed sheep wool.", { provenance: "unavailable", items: [{ nodeId: "z", text: "Our rugs are made from undyed sheep wool." }] }), { status: "unavailable" }, "an unavailable read never becomes support, even with text");

/* 16 · 18 · pure and unwired: no eligibility, persistence, provider or authority reaches it. */
{
  const unit = "src/features/knowledge-retrieval/claim-support.ts";
  const imports = [...code(unit).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((x) => x[1]).sort();
  assert.deepEqual(imports, ["./evidence", "./query-normalization"]);
  for (const banned of ["@/db", "drizzle", "fetch(", "process.env", "public-use", "publicUse", "ratif", "governance", "transport"]) {
    assert.ok(!code(unit).toLowerCase().includes(banned.toLowerCase()), `claim-support must not contain ${banned}`);
  }
  const collect = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? collect(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
    );
  /* GS-1: exactly one runtime reader — the reviewer's revision-evidence read (advisory) — plus the type-only words. */
  const readers = collect("src").filter((f) => f !== unit && /claim-support/.test(code(f))).sort();
  assert.deepEqual(readers, [
    "src/features/heby-answer/revision-generation-evidence.server.ts",
    "src/features/heby-answer/revision-generation-evidence.ts",
  ], "claim-support is read only by the reviewer's advisory evidence read");
}

/* 20 · B2 unchanged: no grounding purpose was added. */
assert.deepEqual([...PURPOSES], ["assistance", "relevance-selection", "agent-origination", "media-generation"]);

console.log("PASS grounding-sufficiency-gs0 claim-support");
