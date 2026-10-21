/*
 * EXECUTION-AUTHORITY-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the Postgres proof in
 * a CHILD PROCESS, and requires it to fail FOR THE STATED REASON. Every mutation asserts the source
 * changed first, is restored in `finally`, and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. Run it only in a disposable
 * worktree, never while committing, and never concurrently with another suite.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/execution-authority-1/execution-authority-postgres.ts";
const CONSUME = "src/features/action-authorization/consume-action-permit.server.ts";
const EXECUTE = "src/features/action-execution/execute-authorized-action.server.ts";
const RECORD_WORK = "src/features/governed-internal-action/execute-record-work.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

function runSuite(): { ok: boolean; output: string; detail: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [r.status === null ? null : `exit ${r.status}`, r.signal ? `signal ${r.signal}` : null]
    .filter(Boolean)
    .join(", ");
  return { ok: r.status === 0, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}`, detail };
}

function proof(label: string, file: string, from: string, to: string, expected: string): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite();
    assert.ok(!ok, `${label}: the suite PASSED with the defect present (${detail})`);
    assert.ok(output.includes(expected), `${label}: failed, but not for "${expected}" (${detail}). Output:\n${output}`);
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
  console.log(`PASS ${label}`);
}

function main(): void {
  const baseline = runSuite();
  assert.ok(baseline.ok, `baseline: ${SUITE} must pass before any mutation (${baseline.detail})`);

  const DOOR_ONE = 'if (!authority.authorized) return refused("not-the-governance-authority");\n  return spendPermit(';
  proof("B1 door one admits any member", CONSUME, DOOR_ONE, "return spendPermit(", "E1 door one refuses");
  proof(
    "B2 door one admits only the bootstrap human",
    CONSUME,
    DOOR_ONE,
    'if (!authority.authorized || authority.via !== "bootstrap") return refused("not-the-governance-authority");\n  return spendPermit(',
    "E8 the delegate executed",
  );
  proof(
    "B3 the external executor asks only after the arming read",
    EXECUTE,
    '  if (!authority.authorized) return refused("not-the-governance-authority");\n\n  /* ── 1. THE ARMING',
    "\n  /* ── 1. THE ARMING",
    "must not be reached",
  );
  proof(
    "B4 the record-work executor hides the refusal",
    RECORD_WORK,
    ' || why === "no-governance-authority" || why === "not-the-governance-authority"\n          ? why',
    "\n          ? why",
    "E1 record-work executor carries the refusal",
  );
  console.log("PASS execution-authority-1 bite-proofs: B1–B4");
}

main();
