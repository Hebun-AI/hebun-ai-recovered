/*
 * SELF-IMPROVING-AGENTS-1 — DO THE GUARDS ACTUALLY BITE?
 *
 * A green firewall proves nothing on its own. Each mutation below re-introduces exactly the defect
 * one guard exists to catch, runs the suite in a CHILD PROCESS, and requires it to fail FOR THE
 * STATED REASON — not merely to fail. A proof that fails for a different reason is a proof that the
 * guard it names was never exercised.
 *
 * ── TWO FAILURE MODES THIS FILE REFUSES TO CONFUSE ───────────────────────────
 *
 *   A mutation that did not APPLY looks exactly like a guard that did not bite. So every mutation
 *   asserts the source actually changed before the child runs.
 *
 *   A child killed by a timeout also exits non-zero. So the run is bounded and the STATUS is
 *   distinguished from the signal, and the expected sentence must appear in the output.
 *
 * ── SAFETY ───────────────────────────────────────────────────────────────────
 *
 * Every mutation is restored in `finally`, and the restore is verified byte-for-byte. Nothing here
 * touches a database, a network, or any file outside the four sources it names.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. A `git diff` taken mid-run
 * shows those mutations live. Never commit while it is running; re-verify against the released SHA.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/sia1-agent-outcomes/outcome-read-firewall.ts";
const RENDERING = "tests/sia1-agent-outcomes/surface-rendering.ts";

const FEATURE_DIR = "src/features/agent-outcome-observation";
const CONTRACTS = `${FEATURE_DIR}/contracts.ts`;
const READER = `${FEATURE_DIR}/read-agent-outcome-facts.server.ts`;
const PROJECTION = `${FEATURE_DIR}/agent-outcome-projection.server.ts`;
const SURFACE = "src/components/agents/agent-outcome-observation.tsx";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");

/** Bounded so a hang is reported as VOID rather than counted as a bite. */
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
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    detail,
  };
}

/** Apply one mutation, require the suite to fail for the STATED reason, restore, verify. */
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
  assert.notEqual(
    mutated,
    original,
    `${label}: the mutation did not APPLY to ${file} — it would prove nothing`,
  );

  try {
    writeFileSync(abs(file), mutated, "utf8");
    const { ok, output, detail } = runSuite(suite);
    assert.ok(
      !ok,
      `${label}: the suite PASSED with the defect present — the guard does not bite (${detail})`,
    );
    assert.ok(
      output.includes(expected),
      `${label}: the suite failed, but not for the stated reason. Expected output to contain ` +
        `"${expected}". Ran as: ${detail}. Output was:\n${output}`,
    );
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  assert.equal(read(file), original, `${label}: ${file} was not restored byte-for-byte`);
}

function main(): void {
  /* Baseline: both suites pass on the released tree, or every proof below is meaningless. */
  for (const suite of [FIREWALL, RENDERING]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `baseline: ${suite} must pass before any mutation (${baseline.detail})`);
  }

  /* ── 1. A DURABLE WRITE IN THE READ PATH ───────────────────────────────────
   *
   * THE ANCHOR MOVED, THE PROOF DID NOT. E2-3 split this read into one private core and two views
   * of it, so the composed answer is now assembled inside `readAgentOutcomeCore`. That is still
   * THE read path — the only place the nine statements are issued — so the mutation lands exactly
   * where it did before. A find-string that no longer applies proves nothing, which is why it is
   * repaired here rather than left to look like a mutation that failed to bite.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "durable write",
    PROJECTION,
    "  return {\n    status: \"read\",\n    core: {\n      agents: composed.agents,",
    "  const neverRun = () => smuggledDb.insert(smuggledTable).values({});\n  void neverRun;\n  return {\n    status: \"read\",\n    core: {\n      agents: composed.agents,",
    "performs a durable write",
  );

  /* ── 2. REACHING A CONSEQUENTIAL AUTHORITY ─────────────────────────────
   *
   * The expected message is the WRITE DETECTOR's, not the symbol ban's, and that is the honest
   * report: `decide-action-request.server.ts` writes rows, so importing it puts a writer in the
   * closure and section 1 bites before section 2 is reached. That is a STRONGER bite than the
   * symbol scan, and claiming the symbol guard here would name a guard this mutation never
   * exercised. The symbol scan is proven separately, below, by a module that writes nothing.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "decision authority",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { approveActionRequest } from "@/features/action-authorization/decide-action-request.server";\nvoid approveActionRequest;',
    "performs a durable write",
  );

  /* ── 3. THE SYMBOL BAN ITSELF, VIA A MODULE THAT WRITES NOTHING ─────────
   *
   * `adapter-registry.server.ts` performs no durable write, so section 1 cannot bite on it. What
   * makes it forbidden is the CAPABILITY it hands out — resolving the adapter that talks to a
   * provider — and that is exactly what the symbol ban exists to catch.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "provider adapter capability",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { resolveExternalSendAdapter } from "@/features/action-execution/adapter-registry.server";\nvoid resolveExternalSendAdapter;',
    'must not reach "resolveExternalSendAdapter"',
  );

  /* ── 4. REVIVING A DEAD LEARNING TABLE ─────────────────────────────────── */
  proof(
    "dead learning table",
    PROJECTION,
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";',
    'import type { TenantContext } from "@/features/auth/tenant/tenant-context";\nimport { improvementProposals } from "@/db/schema/learning";\nvoid improvementProposals;',
    "imports the dead schema module",
  );

  /* ── 5. A STATEMENT REACHING A FIFTH TABLE ─────────────────────────────── */
  proof(
    "fifth table",
    READER,
    '    from "heby_action_requests"\n    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."proposed_by_actor_type" = \'agent\'',
    '    from "heby_action_requests"\n    join "telemetry_events" on true\n    where "heby_action_requests"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."proposed_by_actor_type" = \'agent\'',
    "dead table",
  );

  /* ── 6. A BOUND ON A COUNTING STATEMENT ────────────────────────────────── */
  proof(
    "bounded count",
    READER,
    '    group by "heby_action_requests"."proposed_by_actor_id"`;\n\n  try {\n    const executed = await resolved.db.execute(statement);\n    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];\n    return {\n      status: "read",\n      rows: rows.map((row) => ({\n        agentId: String(row.agentId ?? ""),\n        filed: toCount(row.filed),',
    '    group by "heby_action_requests"."proposed_by_actor_id"\n    limit 50`;\n\n  try {\n    const executed = await resolved.db.execute(statement);\n    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];\n    return {\n      status: "read",\n      rows: rows.map((row) => ({\n        agentId: String(row.agentId ?? ""),\n        filed: toCount(row.filed),',
    "exactly one statement is bounded",
  );

  /* ── 7. THE EXPIRY MIRROR DRIFTING FROM THE RELEASED RULE ──────────────── */
  proof(
    "expiry drift",
    CONTRACTS,
    'return status === "active" && expiresAt.getTime() <= now.getTime();',
    "return expiresAt.getTime() <= now.getTime();",
    "must agree with derivePermitState",
  );

  /* ── 8. COLLAPSING UNKNOWN INTO FAILED ─────────────────────────────────── */
  proof(
    "collapsed stage",
    CONTRACTS,
    '  "FAILED",\n  "UNKNOWN",\n] as const);',
    '  "FAILED",\n] as const);',
    "seven stages",
  );

  /* ── 9. A FIELD NAMED AFTER A VERDICT, IN THE TYPE ─────────────────────── */
  proof(
    "verdict field (declared)",
    PROJECTION,
    "  readonly proposalsWithInvocation: number;",
    "  readonly proposalsWithInvocation: number;\n  readonly qualityScore?: number;",
    'is named after "score"',
  );

  /* ── 9b. AND ONE THAT ACTUALLY REACHES THE COMPOSED OBSERVATION ─────────
   *
   * The declared-field ban is a text scan; this one is the runtime walk over the object a surface
   * would receive. Both are proven, because a value can appear without a declaration and a
   * declaration can exist without a value.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "verdict field (composed)",
    PROJECTION,
    "      provenance: {\n        proposalsWithInvocation: p.withInvocationLink,",
    "      provenance: {\n        successRate: 1,\n        proposalsWithInvocation: p.withInvocationLink,",
    "must not expose",
  );

  /* ── 10. A CALLER-SUPPLIED TENANT ──────────────────────────────────────── */
  proof(
    "caller-supplied tenant",
    PROJECTION,
    "export async function readAgentOutcomeObservation(\n  tenant: TenantContext | null,",
    "export async function readAgentOutcomeObservation(\n  tenant: TenantContext | null,\n  // eslint-disable-next-line @typescript-eslint/no-unused-vars\n  override?: { tenantId: string },",
    'no cross-tenant or client-supplied form in the projection: "tenantId:"',
  );

  /* ── 10b. AND THE SIGNATURE ITSELF ─────────────────────────────────────── */
  proof(
    "unbranded entry point",
    PROJECTION,
    "export async function readAgentOutcomeObservation(\n  tenant: TenantContext | null,",
    "export async function readAgentOutcomeObservation(\n  tenant: TenantContext,",
    "the entry point takes the branded authorized context",
  );

  /* ── 11. A CONTROL ON THE OBSERVING SURFACE ────────────────────────────── */
  proof(
    "surface control",
    SURFACE,
    "function Section({ title, children }: { title: string; children: React.ReactNode }) {",
    'function Retune() {\n  return <button type="button">Tune</button>;\n}\n\nfunction Section({ title, children }: { title: string; children: React.ReactNode }) {',
    'must not contain "<button"',
  );

  /* ── 12. UNKNOWN LOSING THE SENTENCE THAT MAKES IT UNKNOWN ─────────────
   *
   * NOT "accepted is not delivered": that sentence is deliberately carried TWICE — once in the
   * non-claims list and once in the ACCEPTED stage's own refusal — so removing either leaves the
   * page still saying it. A bite-proof against a defended sentence proves nothing, and defence in
   * depth is the reason it is defended. This mutation targets a sentence with ONE source.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "softened unknown",
    CONTRACTS,
    'means: "The request was sent and the answer was lost. The external effect may already have happened.",',
    'means: "The request was sent. The external effect may already have happened.",',
    "unknown is explained as a lost answer",
    RENDERING,
  );

  /* ── 12b. A NULL PROVIDER REPAIRED INTO A PLAUSIBLE NAME ────────────────
   *
   * The most dangerous single edit on this surface: it turns "the provider reported nothing" into
   * a claim about which provider ran, and nothing about the rendered page would look wrong.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "invented provider name",
    SURFACE,
    '{bucket.provider ?? "provider not reported"}',
    '{bucket.provider ?? "claude"}',
    "a null provider is labelled unreported, never guessed",
    RENDERING,
  );

  /* ── 13. THE SURFACE HIDING THE PROVENANCE GAP ─────────────────────────── */
  proof(
    "hidden provenance gap",
    SURFACE,
    "        {agent.provenance.proposalsWithoutInvocation > 0 ? (",
    "        {false ? (",
    "the two forbidden readings are spelled out",
    RENDERING,
  );

  /* ── 14. AN UNREADABLE STORE RENDERED AS AN ORGANIZATION WITH NO AGENT ── */
  proof(
    "unreadable renders as empty",
    SURFACE,
    "{AGENT_OUTCOME_WORDING.unavailableIsNotEmpty}",
    "{AGENT_OUTCOME_WORDING.noAgents}",
    "refuses to be read as an organization with no agents",
    RENDERING,
  );

  /* ── 15. THE ROUTE DROPPING THE SURFACE ────────────────────────────────── */
  proof(
    "route drops the surface",
    "src/app/(dashboard)/agents/page.tsx",
    "        <AgentOutcomeObservationSurface observation={outcomes} />\n",
    "",
    "renders the observation surface",
  );

  console.log("sia1-agent-outcomes/bite-proofs: OK");
}

main();
