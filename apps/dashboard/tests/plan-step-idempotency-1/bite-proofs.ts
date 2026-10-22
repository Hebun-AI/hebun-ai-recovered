/*
 * PLAN-STEP-IDEMPOTENCY-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the Postgres proof in
 * a CHILD PROCESS, and requires it to fail FOR THE STATED REASON. Every mutation asserts the source
 * changed first, is restored in `finally`, and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources (a migration among them) while it runs. Run it
 * only in a disposable worktree, never while committing, and never concurrently with another suite.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/plan-step-idempotency-1/idempotency-postgres.ts";
const MIGRATION = "src/db/migrations/20261022003246_plan_step_idempotency.sql";
const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";

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

  proof(
    "B1 no open-plan-step index",
    MIGRATION,
    /CREATE UNIQUE INDEX "heby_action_requests_open_plan_step_uq"[^\n]*\n/.exec(read(MIGRATION))![0],
    "",
    "I3 origination race: one proposal",
  );
  proof(
    "B2 no pre-model read",
    ORIGINATION,
    'if (open === "open") return refused("plan-step-already-proposed");\n    if (open !== "none") return refused("plan-step-unverifiable");',
    "",
    "I2 no model call for a pre-detected repeat",
  );
  proof("B3 the writer drops the step", WRITER, "planStepRef: planStepRef ?? null,", "planStepRef: null,", "I1 plan_step_ref");
  proof(
    "B4 the wrapped driver code is ignored",
    WRITER,
    "for (const e of [error, (error as { cause?: unknown } | null)?.cause]) {\n    const code",
    "for (const e of [error]) {\n    const code",
    "persistence-unavailable",
  );
  proof(
    "B5 an unreadable step is treated as free",
    ORIGINATION,
    'if (open !== "none") return refused("plan-step-unverifiable");',
    "",
    "I12",
  );
  console.log("PASS plan-step-idempotency-1 bite-proofs: B1–B5");
}

main();
