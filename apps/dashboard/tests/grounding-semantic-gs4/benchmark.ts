/*
 * GS-4 — the Director-labelled benchmark and its single recorded semantic run, pinned. No network.
 *
 * Proves: the gold, the scoring rule and the recorded run are the frozen bytes; the Director labels
 * are exactly as given; replaying the recorded run under scoring rule v1 reproduces the reported
 * decision (semantic 9 false-supported → support upgrade rejected; H1 0).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { GS4_CASES, GS4_GOLD_SHA256 } from "../../scripts/grounding-semantic/cases";
import { gs4Metrics, scoreGs4 } from "../../scripts/grounding-semantic/gs4-score";
import type { RunRow } from "../../scripts/grounding-semantic/score";

globalThis.fetch = (() => {
  throw new Error("GS-4 benchmark test must not reach the network");
}) as typeof fetch;

const DIR = path.resolve(__dirname, "../../scripts/grounding-semantic");
const bytes = (f: string) => readFileSync(path.join(DIR, f));
const sha = (f: string) => createHash("sha256").update(bytes(f)).digest("hex");

assert.equal(sha("gs4-gold-v1.json"), GS4_GOLD_SHA256);
assert.equal(GS4_GOLD_SHA256, "68856f19ef6c7ef6273d7fdcee1ebd44fc9c2594ad6681a8a6394f827d4232bb");
assert.equal(JSON.parse(bytes("gs4-gold-v1.json").toString()).case_bytes_sha256, "a3a2a09f5fadaf98fbbe86fb6c0f470f58d4195aa6ef7ee51b1788b08f584d92");
assert.equal(sha("gs4-evidence/gs4-scoring-rule-v1.txt"), "87c092a9282509b787ef9be5399b6db9d082c236970d4fe5c2cb703517bab221");
assert.ok(sha("gs4-evidence/gs4-run1.jsonl").startsWith("50bfbc61efd89466cd7e"));

/* The Director's labels, GS4-001 … GS4-060, exactly as given. */
assert.equal(GS4_CASES.map((c) => c.id).join(), Array.from({ length: 60 }, (_, i) => `GS4-${String(i + 1).padStart(3, "0")}`).join());
assert.equal(GS4_CASES.map((c) => c.directorLabel).join(""), "CADADADADADCAACCCDDDADCDADCCACCDADADDBABDBADBDBBADAADAADDBDD");

/* Exactly one recorded run: one row per case with evidence. */
const rows = bytes("gs4-evidence/gs4-run1.jsonl").toString().trim().split("\n").map((l) => JSON.parse(l) as RunRow);
assert.equal(rows.length, 57);
assert.equal(new Set(rows.map((r) => r.run)).size, 1);
assert.deepEqual(rows.map((r) => r.id).sort(), GS4_CASES.filter((c) => c.evidence && c.evidence.length > 0).map((c) => c.id).sort());
/* Structured output clean: every answer valid; every entailed / contradicted quote verbatim in its excerpt. */
for (const r of rows) {
  assert.ok(r.answer.ok, `${r.id}: malformed`);
  if (r.answer.relation === "entailed" || r.answer.relation === "contradicted") assert.ok(r.answer.quotesVerified, `${r.id}: unverified quote`);
}

/* Replay under scoring rule v1 reproduces the decision. */
const scored = scoreGs4(rows);
const semantic = gs4Metrics(scored, "semantic");
assert.deepEqual(semantic.falseSupportedBCD, ["GS4-003", "GS4-011", "GS4-018", "GS4-022", "GS4-023", "GS4-027", "GS4-030", "GS4-053", "GS4-060"]);
assert.equal(semantic.A.retained, 14);
assert.deepEqual(gs4Metrics(scored, "h2").falseSupportedBCD, ["GS4-003", "GS4-022", "GS4-023", "GS4-027", "GS4-053", "GS4-060"]);
assert.equal(gs4Metrics(scored, "h3").falseSupportedBCD.length, 9);
assert.deepEqual(gs4Metrics(scored, "h1").falseSupportedBCD, []);
assert.deepEqual(gs4Metrics(scored, "det").falseSupportedBCD, []);
assert.equal(gs4Metrics(scored, "det").A.retained, 5);

console.log("PASS grounding-semantic-gs4 benchmark");
