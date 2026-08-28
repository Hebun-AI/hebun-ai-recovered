/*
 * SELF-IMPROVING-AGENTS-2.6 — DO THE GUARDS ACTUALLY BITE?
 *
 * Each mutation re-introduces exactly the defect one guard exists to catch, runs the firewall in a
 * CHILD PROCESS, and requires it to fail FOR THE STATED REASON. A mutation that did not APPLY looks
 * exactly like a guard that did not bite, so every mutation asserts the source changed first; a
 * child killed by a timeout also exits non-zero, so the run is bounded and the status is checked.
 *
 * Every mutation is restored in `finally` and the restore is verified byte-for-byte.
 *
 * NOTE FOR ANY RELEASE: this suite mutates real sources while it runs. Never commit while it is
 * running, and never run it concurrently with another suite.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FIREWALL = "tests/sia26-origination-attribution/attribution-firewall.ts";

const WRITER = "src/features/agent-origination/invocation-provenance.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const SCHEMA = "src/db/schema/heby-origination-invocation.ts";
const MIGRATION = "src/db/migrations/20260828173456_sia26_origination_agent_attribution.sql";
const SIA1_READER = "src/features/agent-outcome-observation/read-agent-outcome-facts.server.ts";

const abs = (p: string): string => path.join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), "utf8");
const CHILD_TIMEOUT_MS = 120_000;

function runSuite(suite: string): { ok: boolean; output: string; detail: string } {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: CHILD_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
  });
  const detail = [
    r.status === null ? null : `exit ${r.status}`,
    r.signal ? `signal ${r.signal}` : null,
    r.error ? `spawn error ${(r.error as NodeJS.ErrnoException).code ?? ""}`.trim() : null,
  ]
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
    const { ok, output, detail } = runSuite(FIREWALL);
    assert.ok(!ok, `${label}: the firewall PASSED with the defect present (${detail})`);
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
  const baseline = runSuite(FIREWALL);
  assert.ok(baseline.ok, `baseline: the firewall must pass before any mutation (${baseline.detail})`);

  /* ── 1. A CALLER MAY CLAIM AN ARBITRARY AGENT ──────────────────────────
   *
   * The defect this whole design exists to prevent: a bare string parameter turns attribution from
   * a resolution into a claim.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "attribution becomes a claim",
    WRITER,
    "    readonly proposer: AgentProposer;",
    "    readonly proposer: AgentProposer;\n    readonly agentIdOverride?: string;",
    "no caller may pass an agent id as a string",
  );

  /* ── 2. THE RUNTIME BRAND CHECK IS REMOVED ─────────────────────────────
   *
   * Without it a value manufactured with a type cast satisfies the compiler and is stored.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "forged brand accepted",
    WRITER,
    "  if (!isAgentProposer(input.proposer)) return null;",
    "  /* removed */",
    "verifies the brand at RUNTIME",
  );

  /* ── 3. THE COLUMN BECOMES NOT NULL — history would have to be invented ─ */
  proof(
    "attribution made mandatory in the schema",
    SCHEMA,
    '    agentId: uuid("agent_id"),',
    '    agentId: uuid("agent_id").notNull(),',
    "it is NULLABLE",
  );

  /* ── 4. THE TENANT HALF OF THE KEY IS DROPPED ──────────────────────────
   *
   * A single-column FK still points at a real agent — one that may belong to another tenant.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "cross-tenant attribution becomes representable",
    SCHEMA,
    "      columns: [t.tenantId, t.agentId],\n      foreignColumns: [agents.tenantId, agents.id],",
    "      columns: [t.agentId],\n      foreignColumns: [agents.id],",
    "the foreign key is COMPOSITE",
  );

  /* ── 5. THE MIGRATION BACKFILLS HISTORY ────────────────────────────────── */
  proof(
    "historical rows backfilled",
    MIGRATION,
    'CREATE INDEX "heby_origination_invocations_tenant_agent_idx"',
    'UPDATE "heby_origination_invocations" SET "agent_id" = (select id from agents limit 1);--> statement-breakpoint\nCREATE INDEX "heby_origination_invocations_tenant_agent_idx"',
    "the migration must contain no",
  );

  /* ── 6. THE MIGRATION IS RE-ORDERED BACK INTO THE BROKEN FORM ──────────
   *
   * The real defect drizzle-kit generated: the foreign key before the unique index it requires.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "anchor ordered after the key",
    MIGRATION,
    'CREATE UNIQUE INDEX "agents_tenant_id_uq" ON "agents" USING btree ("tenant_id","id");--> statement-breakpoint\nALTER TABLE "heby_origination_invocations" ADD COLUMN "agent_id" uuid;--> statement-breakpoint\nALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;',
    'ALTER TABLE "heby_origination_invocations" ADD COLUMN "agent_id" uuid;--> statement-breakpoint\nALTER TABLE "heby_origination_invocations" ADD CONSTRAINT "heby_origination_invocations_tenant_agent_fk" FOREIGN KEY ("tenant_id","agent_id") REFERENCES "public"."agents"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint\nCREATE UNIQUE INDEX "agents_tenant_id_uq" ON "agents" USING btree ("tenant_id","id");',
    "the unique anchor precedes the foreign key",
  );

  /* ── 7. THE RELEASED PROPOSAL-LINKED METRIC IS SILENTLY REPOINTED ──────
   *
   * The subtlest defect available: the number keeps its name and changes its meaning.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "released metric silently redefined",
    SIA1_READER,
    '    from "heby_origination_invocations"\n    join "heby_action_requests"\n      on "heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"\n     and "heby_action_requests"."tenant_id" = "heby_origination_invocations"."tenant_id"\n    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."proposed_by_actor_type" = \'agent\'\n    group by "heby_action_requests"."proposed_by_actor_id"`;\n\n  try {\n    const executed = await resolved.db.execute(statement);\n    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];\n    return {\n      status: "read",\n      rows: rows.map((row) => ({\n        agentId: String(row.agentId ?? ""),\n        linkedInvocations:',
    '    from "heby_origination_invocations"\n    join "heby_action_requests"\n      on "heby_origination_invocations"."agent_id" = "heby_action_requests"."proposed_by_actor_id"\n     and "heby_action_requests"."tenant_id" = "heby_origination_invocations"."tenant_id"\n    where "heby_origination_invocations"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."tenant_id" = ${resolved.tenantId}\n      and "heby_action_requests"."proposed_by_actor_type" = \'agent\'\n    group by "heby_action_requests"."proposed_by_actor_id"`;\n\n  try {\n    const executed = await resolved.db.execute(statement);\n    const rows = executed.rows as unknown as readonly Record<string, DriverNumber>[];\n    return {\n      status: "read",\n      rows: rows.map((row) => ({\n        agentId: String(row.agentId ?? ""),\n        linkedInvocations:',
    "still joins through the PROPOSAL link",
  );

  /* ── 8. THE NEW READ INVENTS AN AGENT FOR UNATTRIBUTED ROWS ────────────── */
  proof(
    "unattributed rows bucketed into an agent",
    SIA1_READER,
    '      and "heby_origination_invocations"."agent_id" is not null\n    group by "heby_origination_invocations"."agent_id"`;',
    '    group by "heby_origination_invocations"."agent_id"`;',
    "excludes unattributed rows rather than inventing an agent",
  );

  /* ── 9. REGISTRATION MOVES AFTER DISPATCH ───────────────────────────────
   *
   * The fail-closed guarantee: nothing is spent before the row exists.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "registration after dispatch",
    ORIGINATION,
    "  const invocationId = await registerInvocation(",
    "  void 0;\n  const invocationId = await registerInvocationMoved(",
    "the proposer is resolved before registration",
  );

  /* ── 10. A SECOND PROPOSER RESOLUTION APPEARS ───────────────────────────
   *
   * Two resolutions is how attribution and causation become able to disagree.
   * ────────────────────────────────────────────────────────────────────── */
  proof(
    "a second proposer resolution",
    ORIGINATION,
    "  const validation = validateHebyPrompt(input.goal);",
    "  void (await resolveAgentProposer(tenant, deps.agentIdentity ?? {}));\n  const validation = validateHebyPrompt(input.goal);",
    "resolves a proposer exactly once per request",
  );

  console.log("sia26-origination-attribution/bite-proofs: OK");
}

main();
