/*
 * OBSERVATION-AUTHORITY-LEGIBILITY-1 · bite proofs. Each mutation removes one boundary and the
 * behaviour suite must fail FOR THAT REASON. Sources are restored byte-for-byte and re-checked.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const DERIVE = path.join(ROOT, "src/features/observation-authority-legibility/derive-observation-authority-health.ts");
const COMPOSE = path.join(ROOT, "src/features/observation-authority-legibility/read-observation-authority-health.server.ts");
const SUITE = "tests/observation-authority-legibility-1/health-behaviour.ts";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const MUTANTS: readonly { name: string; file: string; from: string; to: string; expect: string }[] = [
  {
    name: "B1 latest usable connection substituted for the authorized one",
    file: DERIVE,
    from: "sources.find((s) => s.integrationId === record.integrationId)",
    to: "sources.find((s) => s.readAvailable)",
    expect: "active authorization on an unusable exact connection",
  },
  {
    name: "B2 active treated as executable",
    file: DERIVE,
    from: 'readAvailable ? ("authorized-and-executable" as const) : ("authorized-but-connection-unusable" as const)',
    to: '("authorized-and-executable" as const)',
    expect: "active authorization on an unusable exact connection",
  },
  {
    name: "B3 tenant binding removed from a read",
    file: COMPOSE,
    from: "    readConnections(tenant),",
    to: "    readConnections(null),",
    expect: "every read receives the session tenant",
  },
  {
    name: "B4 unreadable history turned into 'none recorded'",
    file: DERIVE,
    from: 'if (!read || read.status !== "read") return Object.freeze({ status: "unavailable" as const });',
    to: 'if (!read || read.status !== "read") return Object.freeze({ status: "none-recorded" as const });',
    expect: "an unreadable history is unavailable",
  },
];

const originals = new Map([DERIVE, COMPOSE].map((f) => [f, readFileSync(f, "utf8")] as const));
const digests = new Map([...originals].map(([f, s]) => [f, sha(s)] as const));

const clean = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8" });
assert.equal(clean.status, 0, `the behaviour suite must pass unmutated:\n${clean.stderr}`);

try {
  for (const m of MUTANTS) {
    const original = originals.get(m.file)!;
    assert.equal(original.split(m.from).length - 1, 1, `${m.name}: the mutation site must exist exactly once`);
    writeFileSync(m.file, original.replace(m.from, m.to));
    const run = spawnSync(process.execPath, ["--import", "tsx", SUITE], { cwd: ROOT, encoding: "utf8" });
    writeFileSync(m.file, original);
    assert.notEqual(run.status, 0, `${m.name}: the suite passed — the boundary is not tested`);
    assert.ok(`${run.stdout}\n${run.stderr}`.includes(m.expect), `${m.name}: failed, but not for the intended reason. Expected "${m.expect}".`);
  }
} finally {
  for (const [f, s] of originals) writeFileSync(f, s);
}
for (const [f, d] of digests) assert.equal(sha(readFileSync(f, "utf8")), d, `${path.basename(f)} restored byte-for-byte`);

console.log(`observation-authority-legibility-1/bite-proofs: ${MUTANTS.length}/${MUTANTS.length} mutants killed for the intended reason, sources restored`);
