/*
 * L-2b — every load-bearing line bites. Each proof removes one guarantee from source, runs the
 * PostgreSQL suite, requires it to FAIL for the stated reason, and restores the file byte-for-byte.
 *
 * Mutates src while it runs: never run it in parallel with other suites against the same tree.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SUITE = "tests/l2b-agent-suspension/suspension-postgres.ts";
const WRITER = "src/features/agent-identity/suspend-durable-agent-identity.server.ts";
const DECISION = "src/features/governance-decision/decision-authority.server.ts";
const DISPATCH_SUITE = "tests/l2b-agent-suspension/dispatch-liveness-postgres.ts";
const SPEND = "src/features/action-authorization/consume-action-permit.server.ts";
const ISSUANCE = "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts";
const EXECUTOR = "src/features/action-execution/execute-authorized-action.server.ts";
const ENVELOPE_WRITER = "src/features/standing-mutation-authority/authorize-standing-mutation.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

function proof(
  label: string,
  file: string,
  swaps: ReadonlyArray<readonly [string, string]>,
  expected: string,
  suite: string = SUITE,
): void {
  const original = read(file);
  let mutated = original;
  for (const [from, to] of swaps) {
    const next = mutated.replace(from, to);
    assert.notEqual(next, mutated, `${label}: the mutation did not APPLY to ${file} (${from.slice(0, 50)})`);
    mutated = next;
  }
  try {
    writeFileSync(abs(file), mutated, "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    assert.notEqual(r.status, 0, `${label}: the suite PASSED with the guarantee removed`);
    assert.ok(
      output.includes(expected),
      `${label}: failed, but not for the stated reason. Expected "${expected}". Output:\n${output.slice(0, 4000)}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
  console.log(`bites: ${label}`);
}

proof(
  "S1 a transition no longer requires a reason",
  WRITER,
  [[`if (!justification) return refused("justification-required");`, `if (false) return refused("justification-required");`]],
  "a reason is required for both verbs",
);
proof(
  "S2 a non-owner may suspend",
  WRITER,
  [[`if (row.humanOwnerType !== "human" || row.humanOwnerId !== tenant.userId) {`, `if (false) {`]],
  "a non-owner member is refused as non-owner",
);
proof(
  "S3 ownership alone suffices (Governance gate removed)",
  WRITER,
  [[`if (!authority.authorized) return refused("not-the-governance-authority");`, `if (false) return refused("not-the-governance-authority");`]],
  "an owner without Governance authority is refused",
);
proof(
  "S4 the lookup stops being tenant-scoped",
  WRITER,
  [[`.where(and(eq(agents.id, agentId), eq(agents.tenantId, tenant.tenantId)))\n      .for("update")`, `.where(eq(agents.id, agentId))\n      .for("update")`]],
  "another organization's agent is not found",
);
proof(
  "S5 a retired agent is not refused as retired",
  WRITER,
  [[`if (status === "retired") return refused("agent-identity-retired");`, `if (false) return refused("agent-identity-retired");`]],
  "retired: suspend refused as retired",
);
proof(
  "S6 the transition stops writing its decision",
  WRITER,
  [[
    `    const decision = await writeGovernanceDecisionWithin(`,
    `    const decision = { decisionId: "00000000-0000-4000-8000-000000000000", sessionId: "00000000-0000-4000-8000-000000000000" }; void (async (..._: unknown[]) => undefined)(`,
  ]],
  "exactly one decision, one session and one audit row",
);
proof(
  "S7 the transition stops writing its audit event",
  WRITER,
  [[`    await recordGovernanceEventWithin(`, `    void (async (..._: unknown[]) => undefined)(`]],
  "exactly one decision, one session and one audit row",
);
proof(
  "S8 suspension writes no lifecycle value",
  WRITER,
  [[`kind === "suspended" ? SUSPENDED_AGENT_LIFECYCLE_STATUS : IN_SERVICE_AGENT_LIFECYCLE_STATUS`, `kind === "suspended" ? null : IN_SERVICE_AGENT_LIFECYCLE_STATUS`]],
  "suspension writes lifecycle suspended",
);
proof(
  "S9 the row is judged unlocked AND the update stops re-checking service",
  WRITER,
  [
    [`      .for("update")\n      .limit(1);`, `      .limit(1);`],
    [`          kind === "suspended"\n            ? agentInServiceCondition()`, `          kind === "suspended"\n            ? sql\`true\``],
  ],
  "exactly one concurrent suspension commits",
);
proof(
  "S10 a suspension is filed as a retirement",
  DECISION,
  [[`          ? AGENT_SUSPENDED_OUTCOME`, `          ? AGENT_RETIRED_OUTCOME`]],
  "the outcome is agent-suspended",
);

/* ── Security closure (Director decisions 1 and 2) ── */
proof(
  "S11 reactivation ignores outstanding permits",
  WRITER,
  [[`if ((await countUsableAgentPermitsWithin(txDb, tenant.tenantId, row.id)) > 0) {`, `if (false) {`]],
  "an outstanding permit blocks reactivation",
);
proof(
  "S12 reactivation ignores a valid standing envelope",
  WRITER,
  [[`if (await hasValidStandingEnvelopeWithin(txDb, tenant.tenantId, row.id)) {`, `if (false) {`]],
  "an expired permit no longer blocks, but a valid standing envelope does",
);
proof(
  "S13 the spend reads liveness without locking the agent row",
  SPEND,
  [[
    `        const liveness = await readDurableAgentLivenessForShareWithin(
          tx as unknown as ControlPlaneDatabase,
          caller.tenantId,
          request.proposedByActorId,
        );`,
    `        const liveness = await (await import("@/features/agent-identity/read-durable-agent-identity.server")).readDurableAgentRuntimeLiveness(
          caller.tenantId,
          request.proposedByActorId,
          reads,
        );`,
  ]],
  "a spend racing a suspension never executes after it",
);
proof(
  "S14 standing issuance stops holding the agent row",
  ISSUANCE,
  [[
    `        : await readDurableAgentLivenessForShareWithin(tx, request.tenantId, request.proposedByActorId);`,
    `        : await (await import("@/features/agent-identity/read-durable-agent-identity.server")).readDurableAgentRuntimeLiveness(request.tenantId, request.proposedByActorId, deps.getDb ? { getDb: deps.getDb } : {});`,
  ]],
  "a suspension waits for an in-flight standing issuance",
);
proof(
  "S15 email dispatch stops re-asking after the proposing agent",
  EXECUTOR,
  [[
    `  if (!(await proposingAgentStillInService(db, tenant.tenantId, permitRow.actionRequestId, deps))) {`,
    `  if (false) {`,
  ]],
  "a suspended agent's act is not dispatched",
  DISPATCH_SUITE,
);

/* ── Operational closure: withdrawal needs no service; authorizing still does ── */
/* The first assertion to notice is the unauthorized-member check: its Governance refusal is pre-empted
 * by the restored liveness refusal, before the authorized withdrawal is even attempted. */
proof(
  "S16 withdrawal requires the agent in service again",
  ENVELOPE_WRITER,
  [[`if (nextState !== "withdrawn" && liveness !== "in-service") return refused("agent-not-in-service");`, `if (liveness !== "in-service") return refused("agent-not-in-service");`]],
  "an unauthorized withdrawal is still refused",
);
/* Both gates removed: the early read AND the in-transaction re-ask (S18 removes the latter alone). */
proof(
  "S17 authorizing an envelope stops requiring service",
  ENVELOPE_WRITER,
  [
    [`if (nextState !== "withdrawn" && liveness !== "in-service") return refused("agent-not-in-service");`, `if (false) return refused("agent-not-in-service");`],
    [`        (await readDurableAgentLivenessForShareWithin(tx, authenticated.tenantId, agentId)) !== "in-service"`, `        false`],
  ],
  "AUTHORIZING an envelope still requires the agent in service",
);

proof(
  "S18 authorizing an envelope stops re-asking service inside its transaction",
  ENVELOPE_WRITER,
  [[`        (await readDurableAgentLivenessForShareWithin(tx, authenticated.tenantId, agentId)) !== "in-service"`, `        false`]],
  "an envelope authorization racing a suspension is refused, not committed for a suspended agent",
);

console.log("l2b bite-proofs: ok");
