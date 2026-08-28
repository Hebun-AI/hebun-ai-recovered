/*
 * SELF-IMPROVING-AGENTS-2.6 — ATTRIBUTION IS PROVENANCE, NOT AUTHORITY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The only new durable fact is 'this origination invocation was made on behalf of this durable
 *    agent'. The phase adds no writer, grants nothing, and touches no agent configuration. The
 *    attribution can only come from the branded proposer resolution, so no caller can name an
 *    arbitrary agent. The migration is additive. The released proposal-linked metric keeps its
 *    meaning. And the model and provider behaviour of origination is byte-unchanged."
 *
 * Structural assertions run over comment-stripped source. Pure: no database, no network, no model.
 */
import "../../src/db/schema";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { performsDurableWrite, codeOf } from "../helpers/durable-write-detector";
import { hebyOriginationInvocations } from "../../src/db/schema/heby-origination-invocation";
import { agents } from "../../src/db/schema/agent";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const WRITER = "src/features/agent-origination/invocation-provenance.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const SCHEMA = "src/db/schema/heby-origination-invocation.ts";
const AGENT_SCHEMA = "src/db/schema/agent.ts";
const MIGRATION = "src/db/migrations/20260828173456_sia26_origination_agent_attribution.sql";
const SIA1_READER = "src/features/agent-outcome-observation/read-agent-outcome-facts.server.ts";
const SIA1_PROJECTION = "src/features/agent-outcome-observation/agent-outcome-projection.server.ts";
const SIA2_PROJECTION = "src/features/agent-evaluation/agent-evaluation-projection.server.ts";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. STILL EXACTLY ONE WRITER OF THE INVOCATION TABLE, AND TWO OF `agents`.
 *
 * A census over `src/`, so a phase that quietly gave some other module a write would fail here
 * rather than pass a narrower check about the files it touched.
 * ═════════════════════════════════════════════════════════════════════════ */
function noNewWriterExists(): void {
  const writersOf = (symbol: string): string[] =>
    collect("src")
      .filter((f) =>
        new RegExp(`\\.\\s*(?:insert|update|delete)\\s*\\(\\s*${symbol}\\s*\\)`).test(codeOf(read(f))),
      )
      .sort();

  assert.deepEqual(
    writersOf("hebyOriginationInvocations"),
    [path.join("src", "features", "agent-origination", "invocation-provenance.server.ts")],
    "exactly one module writes the invocation table — SIA-2.6 added no second writer",
  );
  assert.deepEqual(
    writersOf("agents"),
    [
      path.join("src", "features", "agent-identity", "create-durable-agent-identity.server.ts"),
      path.join("src", "features", "agent-identity", "retire-durable-agent-identity.server.ts"),
    ],
    "still exactly two writers of the agents table — attribution mutates no agent",
  );

  /* The read paths that consume the new fact write nothing. */
  for (const file of [SIA1_READER, SIA1_PROJECTION, SIA2_PROJECTION]) {
    assert.ok(!performsDurableWrite(read(file)), `${file} must perform no durable write`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. THE ATTRIBUTION CAN ONLY COME FROM THE BRANDED RESOLUTION.
 * ═════════════════════════════════════════════════════════════════════════ */
function attributionIsUnforgeable(): void {
  const writer = codeOf(read(WRITER));

  assert.ok(
    /readonly proposer: AgentProposer;/.test(writer),
    "the writer takes the BRANDED proposer, never a bare agent id",
  );
  assert.ok(
    /if \(!isAgentProposer\(input\.proposer\)\) return null;/.test(writer),
    "and verifies the brand at RUNTIME, so a type cast cannot forge one",
  );
  assert.ok(
    /agentId: input\.proposer\.agentId,/.test(writer),
    "the stored value comes from the verified brand and nowhere else",
  );

  /*
   * NO STRING-SHAPED AGENT PARAMETER EXISTS ANYWHERE IN THE WRITER.
   *
   * Matched on ANY field whose name mentions an agent, not on the exact name `agentId`. A
   * bite-proof added `agentIdOverride?: string` and slipped straight past the narrower pattern —
   * the guard was checking a spelling, and a caller-supplied claim does not care what it is called.
   */
  assert.ok(
    !/\bagent\w*\??\s*:\s*string/i.test(writer),
    "no caller may pass an agent id as a string — that would be a claim, not a resolution",
  );

  /* THE SOLE CALLER PASSES THE PROPOSER IT RESOLVED FROM THE SAME TENANT. */
  const origination = codeOf(read(ORIGINATION));
  const resolveAt = origination.indexOf("resolveAgentProposer(tenant");
  const registerAt = origination.indexOf("registerInvocation(");
  assert.ok(resolveAt >= 0 && registerAt > resolveAt, "the proposer is resolved before registration");
  assert.ok(
    /registerInvocation\(\s*tenant,/.test(origination),
    "and registration is given the SAME tenant the proposer was resolved from",
  );
  assert.ok(
    /proposer,\s*\},/.test(origination),
    "the one resolved proposer is the value handed to the writer",
  );

  /* ONE RESOLUTION, USED TWICE — which is why attribution and causation cannot disagree. */
  assert.equal(
    (origination.match(/resolveAgentProposer\(/g) ?? []).length,
    1,
    "the origination seam resolves a proposer exactly once per request",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE COLUMN IS NULLABLE AND TENANT-BOUND BY THE DATABASE.
 * ═════════════════════════════════════════════════════════════════════════ */
function schemaIsAdditiveAndTenantSafe(): void {
  const column = hebyOriginationInvocations.agentId;
  assert.ok(column, "the attribution column exists in the schema this repository reads");
  assert.equal(column.notNull, false, "it is NULLABLE — historical rows must stay honest");
  assert.equal(column.name, "agent_id");

  const schema = codeOf(read(SCHEMA));
  assert.ok(
    /foreignKey\(\{[\s\S]*?columns: \[t\.tenantId, t\.agentId\][\s\S]*?foreignColumns: \[agents\.tenantId, agents\.id\]/.test(
      schema,
    ),
    "the foreign key is COMPOSITE, so another tenant's agent cannot be named",
  );
  assert.ok(
    /\.onDelete\("restrict"\)/.test(schema),
    "and it restricts, matching the sibling chain",
  );
  assert.ok(
    codeOf(read(AGENT_SCHEMA)).includes('uniqueIndex("agents_tenant_id_uq")'),
    "the agents table carries the composite anchor the key requires",
  );

  /* NO DEFAULT, ever — a fabricated agent would be worse than no attribution. */
  assert.ok(!/agentId: uuid\("agent_id"\)[^,\n]*\.default/.test(schema), "no default agent exists");
  assert.equal(agents.id.name, "id");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. THE MIGRATION IS ADDITIVE, ORDERED, AND BACKFILLS NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function migrationIsAdditive(): void {
  const sql = read(MIGRATION);

  for (const destructive of [
    /\bDROP\b/i,
    /\bTRUNCATE\b/i,
    /\bDELETE\s+FROM\b/i,
    /\bALTER\s+COLUMN\b/i,
    /\bSET\s+NOT\s+NULL\b/i,
    /\bRENAME\b/i,
    /\bUPDATE\s+"?heby_origination_invocations"?\s+SET\b/i,
  ]) {
    assert.ok(!destructive.test(sql), `the migration must contain no ${destructive}`);
  }
  assert.ok(!/\bINSERT\s+INTO\b/i.test(sql), "and it backfills nothing");

  /* THE ANCHOR IS CREATED BEFORE THE KEY THAT REFERENCES IT — the defect this file caught. */
  const indexAt = sql.indexOf('CREATE UNIQUE INDEX "agents_tenant_id_uq"');
  const fkAt = sql.indexOf("heby_origination_invocations_tenant_agent_fk");
  assert.ok(indexAt >= 0 && fkAt > indexAt, "the unique anchor precedes the foreign key");

  /* IT TOUCHES EXACTLY TWO TABLES. */
  const tables = new Set([...sql.matchAll(/(?:ALTER TABLE|INDEX .*? ON)\s+"([a-z_]+)"/g)].map((m) => m[1]!));
  assert.deepEqual(
    [...tables].sort(),
    ["agents", "heby_origination_invocations"],
    "no unrelated table is touched",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. ATTRIBUTION GRANTS NOTHING.
 *
 * The writer's whole closure is checked for the authorities a "self-improving" phase would drift
 * into. Attribution is a recorded reference; it must reach none of them.
 * ═════════════════════════════════════════════════════════════════════════ */
function attributionIsNotAuthority(): void {
  const writer = codeOf(read(WRITER));

  for (const forbidden of [
    "actionPermits",
    "action_permits",
    "issuePermit",
    "decisionRecords",
    "governanceSessions",
    "resolveGovernanceAuthority",
    "approveActionRequest",
    "rejectActionRequest",
    "consumeActionPermit",
    "revokeActionPermit",
    "actionExecutionAttempts",
    "executeAuthorizedAction",
    "createDurableAgentIdentity",
    "retireDurableAgentIdentity",
    "telemetryEvents",
    "learningSessions",
    "improvementProposals",
    "memories",
    "knowledgeNodes",
  ]) {
    assert.ok(!writer.includes(forbidden), `provenance must not reach "${forbidden}"`);
  }

  /* IT MUTATES NO AGENT CONFIGURATION — the columns a later phase would reach for. */
  for (const file of [WRITER, SIA1_READER, SIA1_PROJECTION, SIA2_PROJECTION]) {
    const code = codeOf(read(file));
    for (const column of [
      "performanceTargets",
      "performance_targets",
      "learningProfile",
      "telemetryProfile",
      "preferredModels",
      "preferredProviders",
      "allowedTools",
      "reasoningPreferences",
      "costLimits",
      "authorityCeiling",
    ]) {
      assert.ok(!code.includes(column), `${file} must not name agent configuration "${column}"`);
    }
  }

  /* NO CREDENTIAL, NO NETWORK, NO PROVIDER, FROM THE READ PATHS. */
  for (const file of [SIA1_READER, SIA1_PROJECTION, SIA2_PROJECTION]) {
    const code = codeOf(read(file));
    for (const forbidden of ["ANTHROPIC", "HEBUN_MODEL_CREDENTIAL", "https://", "node:http"]) {
      assert.ok(!code.includes(forbidden), `${file} must not reach "${forbidden}"`);
    }
    assert.ok(!/\bfetch\s*\(/.test(code), `${file} must make no network call`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE MODEL AND PROVIDER BEHAVIOUR OF ORIGINATION IS UNCHANGED.
 *
 * The phase must add attribution, not alter what gets called or when. Asserted as the ORDER of the
 * released steps, which is what a behavioural change would disturb.
 * ═════════════════════════════════════════════════════════════════════════ */
function originationBehaviourIsUnchanged(): void {
  /*
   * SCOPED TO THE FUNCTION BODY, not the module.
   *
   * The first version searched the whole file and matched `selectModelTransport` in the IMPORT
   * list, so the order it measured was the order of the imports. R6D recorded exactly this: an
   * assertion that reaches the import line can never fail for the reason it names.
   */
  const whole = codeOf(read(ORIGINATION));
  const bodyAt = whole.indexOf("export async function originateAgentAction");
  assert.ok(bodyAt > 0, "the origination entry point exists");
  const code = whole.slice(bodyAt);
  const order = [
    "resolveAgentProposer(",
    "validateHebyPrompt(",
    "buildOriginationCandidates(",
    "selectModelTransport",
    "registerInvocation(",
    "selectAction(",
  ];
  let last = -1;
  for (const step of order) {
    const at = code.indexOf(step);
    assert.ok(at > last, `origination still performs "${step}" in the released order`);
    last = at;
  }

  /* Registration still happens BEFORE dispatch, which is the fail-closed guarantee. */
  assert.ok(
    code.indexOf("registerInvocation(") < code.indexOf("selectAction("),
    "the invocation is registered before anything is dispatched",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. THE RELEASED PROPOSAL-LINKED METRIC KEEPS ITS MEANING.
 *
 * SIA-1's `readAgentInvocationFacts` answers "which calls does a PROPOSAL name". SIA-2.6 adds a
 * second, different read. Silently repointing the released one at `agent_id` would have changed
 * what a released number means without changing its name.
 * ═════════════════════════════════════════════════════════════════════════ */
function releasedMetricIsUnchanged(): void {
  const reader = codeOf(read(SIA1_READER));
  const linked = reader.slice(
    reader.indexOf("export async function readAgentInvocationFacts"),
    reader.indexOf("export async function readAgentModelDistribution"),
  );
  assert.ok(linked.length > 0, "the released proposal-linked read still exists");
  assert.ok(
    linked.includes('"heby_action_requests"."origination_invocation_id" = "heby_origination_invocations"."id"'),
    "and still joins through the PROPOSAL link, unchanged",
  );
  assert.ok(
    !linked.includes('"heby_origination_invocations"."agent_id"'),
    "it was NOT repointed at the new column — that would silently redefine a released metric",
  );

  /*
   * And the new read groups on the column directly, which is what makes it different.
   *
   * BOUNDED TO ITS OWN FUNCTION. The first version sliced to end-of-file and matched the
   * `is not null` inside `readInvocationProvenanceIntegrity`, so the assertion could not fail —
   * the same "scope it to the function body" repair this suite already made once.
   */
  const selectionStart = reader.indexOf("export async function readAgentSelectionFacts");
  const selection = reader.slice(
    selectionStart,
    reader.indexOf("export async function readInvocationProvenanceIntegrity"),
  );
  assert.ok(selectionStart > 0 && selection.length > 0, "the new read exists and is bounded");
  assert.ok(
    selection.includes('group by "heby_origination_invocations"."agent_id"'),
    "the new read groups on attribution directly",
  );
  assert.ok(
    selection.includes('"heby_origination_invocations"."agent_id" is not null'),
    "and excludes unattributed rows rather than inventing an agent for them",
  );
}

function main(): void {
  noNewWriterExists();
  attributionIsUnforgeable();
  schemaIsAdditiveAndTenantSafe();
  migrationIsAdditive();
  attributionIsNotAuthority();
  originationBehaviourIsUnchanged();
  releasedMetricIsUnchanged();

  console.log("sia26-origination-attribution/attribution-firewall: OK");
}

main();
