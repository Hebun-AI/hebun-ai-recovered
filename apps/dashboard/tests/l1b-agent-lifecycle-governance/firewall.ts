/*
 * L-1b — structural guarantees, read from source. No database.
 *
 * F1 Migration 76 is exactly one additive enum value, and the schema enum carries it.
 * F2 Retirement writes its decision and audit INSIDE its transaction, AFTER the guarded UPDATE, and
 *    through the one decision authority and the one Governance audit writer — no direct insert.
 * F3 The decision authority files the agent-lifecycle subject in its own domain, maps its outcome
 *    on the subject before any generic branch, and refuses any decision type but `revoke`.
 * F4 The agent-lifecycle subject is named only by its owner, the decision authority and retirement.
 * F5 Registration is untouched: still `approve` on subject `agent` in `agent-registration`.
 * F6 Agent identity owns no successor or resume verb (L-2b added suspend and reactivate, nothing else).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const code = (p: string): string =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const MIGRATION = "src/db/migrations/20261008143657_l1b_agent_lifecycle_domain.sql";
const ENUMS = "src/db/schema/_enums.ts";
const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const CONTRACTS = "src/features/agent-identity/contracts.ts";
const DECISION = "src/features/governance-decision/decision-authority.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

/* ── F1 ── */
assert.equal(
  read(MIGRATION).trim(),
  `ALTER TYPE "public"."governance_domain" ADD VALUE 'agent-lifecycle';`,
  "migration 76 is exactly one additive enum value",
);
const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as { entries: { tag: string }[] };
assert.equal(journal.entries.length, 76);
assert.equal(journal.entries.at(-1)!.tag, "20261008143657_l1b_agent_lifecycle_domain");
assert.match(code(ENUMS), /"external-ai-data-use",\s*"agent-lifecycle",\s*\]\);/, "the enum gains agent-lifecycle last");

/* ── F2 ── */
{
  const retire = code(RETIRE);
  assert.ok(!/\.insert\(/.test(retire), "retirement inserts nothing directly — decision and audit go through their authorities");
  const tx = retire.indexOf("db.transaction(");
  const update = retire.indexOf(".update(agents)");
  const decide = retire.indexOf("writeGovernanceDecisionWithin(");
  const audit = retire.indexOf("recordGovernanceEventWithin(");
  assert.ok(tx > 0 && update > tx, "the transition is inside the transaction");
  assert.ok(decide > update, "the decision is written after the guarded UPDATE");
  assert.ok(audit > decide, "the audit event follows the decision");
  assert.match(retire, /subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE/);
  assert.match(retire, /decisionType: AGENT_RETIREMENT_DECISION_TYPE/);
  assert.ok(retire.indexOf("validateJustification(") < tx, "the reason is checked before the transaction opens");
}

/* ── F3 ── */
{
  const decision = code(DECISION);
  assert.match(decision, /input\.subjectType === AGENT_LIFECYCLE_SUBJECT_TYPE\s*\?\s*AGENT_LIFECYCLE_DOMAIN/, "own domain");
  const outcomeStart = decision.indexOf("const outcome =");
  const firstBranch = decision.slice(outcomeStart, outcomeStart + 200);
  /* L-2b — the lifecycle outcome is chosen on the subject (then by type) before any generic branch. */
  assert.match(firstBranch, /agentLifecycleOutcome !== null\s*\?\s*agentLifecycleOutcome/, "outcome mapped on the subject first");
  assert.match(
    decision,
    /input\.subjectType !== AGENT_LIFECYCLE_SUBJECT_TYPE\s*\?\s*null\s*:\s*input\.decisionType === AGENT_RETIREMENT_DECISION_TYPE\s*\?\s*AGENT_RETIRED_OUTCOME/,
    "revoke on the agent-lifecycle subject is agent-retired",
  );
  const guard = decision.indexOf('"agent-lifecycle-decision-type-unsupported"');
  assert.ok(guard > 0 && guard < decision.indexOf("const domain ="), "unsupported decision types are refused before routing");
  const c = code(CONTRACTS);
  assert.match(c, /AGENT_LIFECYCLE_SUBJECT_TYPE = "agent-lifecycle"/);
  assert.match(c, /AGENT_RETIREMENT_DECISION_TYPE = "revoke"/);
  assert.match(c, /AGENT_LIFECYCLE_DOMAIN = "agent-lifecycle"/);
  assert.match(c, /AGENT_RETIRED_OUTCOME = "agent-retired"/);
}

/* ── F4 ── */
{
  /* L-2b — the suspension writer is the fourth owner. */
  const allowed = new Set([CONTRACTS, DECISION, RETIRE, "src/features/agent-identity/suspend-durable-agent-identity.server.ts"]);
  for (const file of walk("src")) {
    if (/AGENT_LIFECYCLE_SUBJECT_TYPE|AGENT_RETIREMENT_DECISION_TYPE|AGENT_RETIRED_OUTCOME/.test(code(file))) {
      assert.ok(allowed.has(file), `${file} names the agent-lifecycle decision outside its three owners`);
    }
  }
}

/* ── F5 ── */
{
  const c = code(CONTRACTS);
  assert.match(c, /AGENT_REGISTRATION_SUBJECT_TYPE = "agent"/);
  assert.match(c, /AGENT_REGISTRATION_DECISION_TYPE = "approve"/);
  assert.match(c, /AGENT_REGISTRATION_DOMAIN = "agent-registration"/);
}

/* ── F6 ── */
{
  const feature = walk("src/features/agent-identity").map(code).join("\n");
  for (const verb of ["resumeDurableAgent", "succeedDurableAgent", "replacedByAgentId:"]) {
    assert.ok(!feature.includes(verb), `agent identity owns no ${verb}`);
  }
}

console.log("l1b firewall: ok");
