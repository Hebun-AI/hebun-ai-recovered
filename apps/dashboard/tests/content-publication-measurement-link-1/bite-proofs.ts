/*
 * CONTENT-PUBLICATION-MEASUREMENT-LINK-1 · bite proofs.
 *
 * Each mutation removes one boundary from the derivation and requires the behaviour suite to fail
 * FOR THAT REASON. The source is restored byte-for-byte afterwards and its digest re-checked.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const TARGET = path.join(ROOT, "src/features/content-publication-measurement/derive-publication-measurement.ts");
const SUITE = "tests/content-publication-measurement-link-1/measurement-behaviour.ts";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const MUTANTS: readonly { name: string; from: string; to: string; expect: string }[] = [
  {
    name: "B1 identity check removed (any mediaId matches)",
    from: "(raw as Record<string, unknown>).mediaId === mediaId",
    to: "(raw as Record<string, unknown>).mediaId !== undefined",
    expect: "earliest is the first observation that LISTS this provider id",
  },
  {
    name: "B2 subject binding removed (any account's observation joins)",
    from: " && o.subjectRef === subjectRef",
    to: "",
    expect: "another account's observation is never joined",
  },
  {
    name: "B3 accepted-stage boundary removed",
    from: '  if (entry.stage !== "execution-accepted") return null;\n',
    to: "",
    expect: "execution-unknown is never joined",
  },
  {
    name: "B4 null coalesced to 0",
    from: "Number.isFinite(value) ? value : null;",
    to: "Number.isFinite(value) ? value : 0;",
    expect: "a withheld like count stays null, never 0",
  },
];

const original = readFileSync(TARGET, "utf8");
const digest = sha(original);

/* The unmutated suite passes, so every failure below is caused by its mutation. */
const clean = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8" });
assert.equal(clean.status, 0, `the behaviour suite must pass unmutated:\n${clean.stderr}`);

try {
  for (const m of MUTANTS) {
    assert.equal(original.split(m.from).length - 1, 1, `${m.name}: the mutation site must exist exactly once`);
    writeFileSync(TARGET, original.replace(m.from, m.to));
    const run = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8" });
    const output = `${run.stdout}\n${run.stderr}`;
    assert.notEqual(run.status, 0, `${m.name}: the suite passed — the boundary is not tested`);
    assert.ok(output.includes(m.expect), `${m.name}: the suite failed, but not for the intended reason. Expected "${m.expect}".`);
    writeFileSync(TARGET, original);
  }
} finally {
  writeFileSync(TARGET, original);
}
assert.equal(sha(readFileSync(TARGET, "utf8")), digest, "the derivation is restored byte-for-byte");

console.log(`content-publication-measurement-link-1/bite-proofs: ${MUTANTS.length}/${MUTANTS.length} mutants killed for the intended reason, source restored`);
