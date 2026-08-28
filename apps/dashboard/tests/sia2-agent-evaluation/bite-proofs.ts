/*
 * SELF-IMPROVING-AGENTS-2 — DO THE GUARDS ACTUALLY BITE?
 *
 * A green firewall proves nothing on its own. Each mutation below re-introduces exactly the defect
 * one guard exists to catch, runs the suite in a CHILD PROCESS, and requires it to fail FOR THE
 * STATED REASON — not merely to fail.
 *
 * ── TWO FAILURE MODES THIS FILE REFUSES TO CONFUSE ───────────────────────────
 *
 *   A mutation that did not APPLY looks exactly like a guard that did not bite, so every mutation
 *   asserts the source actually changed before the child runs.
 *
 *   A child killed by a timeout also exits non-zero, so the run is bounded, the STATUS is
 *   distinguished from the signal, and the expected sentence must appear in the output.
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 *
 * Every mutation is restored in `finally`, and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. A `git diff` taken mid-run
 * shows those mutations live. Never commit while it is running, and never run it concurrently with
 * another suite — a killed run leaves a mutated source on disk, which is how a previous phase
 * manufactured eight false failures.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/sia2-agent-evaluation/evaluation-firewall.ts";
const RENDERING = "tests/sia2-agent-evaluation/surface-rendering.ts";

const CONTRACTS = "src/features/agent-evaluation/contracts.ts";
const PROJECTION = "src/features/agent-evaluation/agent-evaluation-projection.server.ts";
const SURFACE = "src/components/agents/agent-evaluation.tsx";
const ROUTE = "src/app/(dashboard)/agents/page.tsx";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

const CHILD_TIMEOUT_MS = 120_000;

function runSuite(suite: string): { ok: boolean; output: string; detail: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [
    result.status === null ? null : `exit ${result.status}`,
    result.signal ? `signal ${result.signal}` : null,
    result.error ? `spawn error ${(result.error as NodeJS.ErrnoException).code ?? ""}`.trim() : null,
  ]
    .filter(Boolean)
    .join(", ");
  return { ok: result.status === 0, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`, detail };
}

function proof(
  label: string,
  file: string,
  from: string,
  to: string,
  expected: string,
  suite: string = FIREWALL,
): void {
  const original = read(file);
  const mutated = original.replace(from, to);
  assert.notEqual(mutated, original, `${label}: the mutation did not APPLY to ${file}`);

  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(suite);
    assert.ok(!ok, `${label}: the suite PASSED with the defect present (${detail})`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Ran as: ${detail}. Output:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
}

function main(): void {
  for (const suite of [FIREWALL, RENDERING]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `baseline: ${suite} must pass before any mutation (${baseline.detail})`);
  }

  /* ── 1. A SUCCESS RATE, THE DEFECT THIS WHOLE PHASE EXISTS TO PREVENT ────
   *
   * Narrowing the resolution numerator to `accepted` turns a coverage measure into a success rate
   * without changing a single label. This is the most dangerous single edit in the feature.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "resolution becomes a success rate",
    PROJECTION,
    "    execution.attempts - execution.pending - execution.unknown,",
    "    execution.accepted,",
    "a confirmed failure is a confirmed outcome",
  );

  /* ── 2. A QUOTIENT APPEARS ─────────────────────────────────────────────── */
  proof(
    "a quotient is computed",
    PROJECTION,
    "  const decided = governance.approved + governance.rejected;",
    "  const decided = governance.approved + governance.rejected;\n  const leakedShare = decided / Math.max(1, activity.proposalsFiled);\n  void leakedShare;",
    "must contain no division",
  );

  /* ── 3. A FIELD NAMED AFTER A GRADE ────────────────────────────────────── */
  proof(
    "a graded field is exposed",
    PROJECTION,
    "  readonly hasNoEvidence: boolean;",
    "  readonly hasNoEvidence: boolean;\n  readonly overallScore?: number;",
    "must not expose",
  );

  /* ── 4. SIA-2 GROWS ITS OWN QUERY — A SECOND OBSERVATION AUTHORITY ─────── */
  proof(
    "a second observation authority",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { sql } from "drizzle-orm";\nvoid sql;',
    "SIA-2 composes SIA-1 and owns no query",
  );

  /* ── 5. IT REACHES A CONSEQUENTIAL AUTHORITY ───────────────────────────── */
  proof(
    "decision authority reached",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { approveActionRequest } from "@/features/action-authorization/decide-action-request.server";\nvoid approveActionRequest;',
    "performs a durable write",
  );

  /* ── 6. IT REVIVES THE DEAD EVALUATION SCAFFOLDING ─────────────────────
   *
   * The expected message is the dead-MODULE guard's, which fires before the repository-wide caller
   * census. That census is not provable by this mutation and is not meant to be: it re-measures
   * whether `src/features/evaluation` has acquired a caller ANYWHERE, and it runs on every pass.
   * Naming it here would claim a bite this mutation never exercised.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "dead evaluation engine revived",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { scoreEvaluation } from "@/features/evaluation";\nvoid scoreEvaluation;',
    'imports the dead module "features/evaluation"',
  );

  /* ── 7. IT NAMES AN AGENT CONFIGURATION COLUMN ─────────────────────────── */
  proof(
    "agent configuration touched",
    PROJECTION,
    "  readonly hasNoEvidence: boolean;",
    "  readonly hasNoEvidence: boolean;\n  readonly performanceTargets?: unknown;",
    "must not name the agent configuration column",
  );

  /* ── 8. A ZERO DENOMINATOR RENDERS AS A RESULT ─────────────────────────── */
  proof(
    "zero denominator becomes a finding",
    CONTRACTS,
    "  return denominator > 0 ? AVAILABLE :",
    "  return denominator >= 0 ? AVAILABLE :",
    "a zero denominator is an absence, not a result",
  );

  /* ── 9. AN UNAVAILABLE DIMENSION IS QUIETLY DROPPED ────────────────────── */
  proof(
    "delivery dimension omitted",
    CONTRACTS,
    '    key: "delivery",\n    label: "Delivery confirmation",',
    '    key: "delivery-removed",\n    label: "Delivery confirmation",',
    'the evaluation declares "delivery" unavailable',
  );

  /* ── 10. A SEMANTIC INVARIANT IS SOFTENED ──────────────────────────────── */
  proof(
    "accepted-is-delivered softened",
    CONTRACTS,
    '"accepted is not delivered — no provider reports whether a recipient received anything",',
    '"the provider accepted the message",',
    "accepted is not delivered",
  );

  /* ── 11. THE ROUTE READS TWICE, LETTING THE TWO CARDS DISAGREE ─────────── */
  proof(
    "route reads twice",
    ROUTE,
    "  const evaluation = deriveAgentEvaluationRead(outcomes);",
    "  const second = await readAgentOutcomeObservation(tenant);\n  void second;\n  const evaluation = deriveAgentEvaluationRead(outcomes);",
    "issued exactly once per render",
  );

  /* ── 12. A CONTROL APPEARS ON THE EVALUATION SURFACE ───────────────────── */
  proof(
    "surface control",
    SURFACE,
    "function Group({ title, caption, children }",
    'function Retune() {\n  return <button type="button">Tune</button>;\n}\n\nfunction Group({ title, caption, children }',
    'must not contain "<button"',
  );

  /* ── 13. A PERCENTAGE IS RENDERED ──────────────────────────────────────── */
  proof(
    "a percentage is rendered",
    SURFACE,
    "            {metric.numerator} of {metric.denominator}",
    "            {metric.numerator} of {metric.denominator} (100%)",
    "renders no percentage",
  );

  /* ── 14. THE DERIVED BADGE IS DROPPED, BLENDING DERIVED WITH OBSERVED ──── */
  proof(
    "derived badge dropped",
    SURFACE,
    '        <span className="rounded border border-border px-1 text-[0.55rem] uppercase tracking-wider text-fg-muted">\n          derived\n        </span>',
    "",
    "every derived metric is badged",
    RENDERING,
  );

  /* ── 15. A ZERO-EVIDENCE AGENT RENDERS "0 of 0" ────────────────────────── */
  proof(
    "zero evidence renders as a number",
    SURFACE,
    "        {unavailable ? (",
    "        {false ? (",
    "each derived figure says so where its number would be",
    RENDERING,
  );

  /* ── 16. AN UNREADABLE EVALUATION RENDERS AS NO AGENTS ─────────────────── */
  proof(
    "unreadable renders as empty",
    SURFACE,
    "{AGENT_EVALUATION_WORDING.unavailableIsNotEmpty}",
    "{AGENT_EVALUATION_WORDING.noAgents}",
    "refuses to be read as an organization with no agents",
    RENDERING,
  );

  console.log("sia2-agent-evaluation/bite-proofs: OK");
}

main();
