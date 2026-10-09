/*
 * L-1b — every load-bearing line bites. Each proof removes one guarantee from source, runs the
 * PostgreSQL suite, requires it to FAIL for the stated reason, and restores the file byte-for-byte.
 *
 * Mutates src while it runs: never run it in parallel with other suites against the same tree.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/l1b-agent-lifecycle-governance/retirement-governance-postgres.ts";
const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const DECISION = "src/features/governance-decision/decision-authority.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

function proof(label: string, file: string, from: string, to: string, expected: string): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", SUITE], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.notEqual(r.status, 0, `${label}: the suite PASSED with the guarantee removed`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Output:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
  console.log(`bites: ${label}`);
}

proof(
  "B1 retirement no longer requires a reason",
  RETIRE,
  `if (!justification) return { status: "refused", reason: "justification-required" };`,
  `if (false && !justification) return { status: "refused", reason: "justification-required" };`,
  `reason undefined is refused`,
);
proof(
  "B2 retirement stops writing its decision",
  RETIRE,
  `    const decision = await writeGovernanceDecisionWithin(`,
  `    const decision = { decisionId: "00000000-0000-4000-8000-000000000000", sessionId: "00000000-0000-4000-8000-000000000000" }; void (async (..._: unknown[]) => undefined)(`,
  "exactly one decision, one session and one audit row per retirement",
);
proof(
  "B3 retirement stops writing its audit event",
  RETIRE,
  `    await recordGovernanceEventWithin(`,
  `    void (async (..._: unknown[]) => undefined)(`,
  "exactly one decision, one session and one audit row per retirement",
);
proof(
  "B4 the outcome falls through to the generic revoke branch",
  DECISION,
  /* L-2b — the lifecycle outcome is now one subject-first branch over agentLifecycleOutcome. */
  `    agentLifecycleOutcome !== null ? agentLifecycleOutcome\n      : `,
  `    `,
  "the outcome is agent-retired, never a revoked Governance authority",
);
proof(
  "B5 the domain falls back to agent-registration",
  DECISION,
  `                  input.subjectType === AGENT_LIFECYCLE_SUBJECT_TYPE\n                ? AGENT_LIFECYCLE_DOMAIN`,
  `                  input.subjectType === AGENT_LIFECYCLE_SUBJECT_TYPE\n                ? AGENT_REGISTRATION_DOMAIN`,
  "filed in its own domain",
);
proof(
  "B6 the decision authority accepts any decision type on the lifecycle subject",
  DECISION,
  /* L-2b — the guard now refuses any type with no lifecycle outcome. */
  `  if (input.subjectType === AGENT_LIFECYCLE_SUBJECT_TYPE && agentLifecycleOutcome === null) {`,
  `  if (false && input.subjectType === AGENT_LIFECYCLE_SUBJECT_TYPE) {`,
  "agent-lifecycle-decision-type-unsupported",
);

console.log("PASS l1b bite proofs — every load-bearing line bites");
