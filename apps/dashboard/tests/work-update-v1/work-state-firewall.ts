/*
 * WORK-UPDATE V1 — THE STRUCTURAL FIREWALL FOR `set-work-declared-state`.
 *
 * What the Postgres suite cannot see, asserted over source (comments stripped where a sentence could
 * otherwise satisfy a check):
 *
 *   F1  the permit's transaction type and the recording seam's are byte-identical to GIA-1's —
 *       no `update` reached either; the state core has its own type
 *   F2  exactly ONE `declared_state` UPDATE in the Work Authority, shared by the human path and the
 *       governed door; the Work Authority reaches no permit table and imports no permit module
 *   F3  the governed door locks the row, checks lifecycle, domain and `fromState` BEFORE the one
 *       UPDATE, and throws (rolls back) on every refusal
 *   F4  the executor owns nothing: it opens no transaction, writes nothing, spends through the
 *       released `consumeActionPermit` on the Work Authority's handle, and calls no inverse
 *   F5  the kind is outside the machine and standing paths
 *   F6  the model is shown no work data; the general origination contract cannot select the kind
 *   F7  the registry entry, the closed state vocabulary and the storage CHECK agree
 *   F8  the mandate form never pre-selects the kind; responsibility is required for it
 *   F9  WORK-1's own modules still reach no agent origination
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import {
  EXECUTABLE_ACTION_KINDS,
  executablePostureFor,
  getActionTool,
  validateActionRegistry,
  SET_WORK_DECLARED_STATE_TOOL_ID,
} from "../../src/features/heby-actions/action-registry";
import { WORK_DECLARED_STATES } from "../../src/features/organizational-work/work-contracts";
import {
  AGENT_ORIGINABLE_ACTION_KINDS,
  AGENT_ORIGINABLE_REGISTRY_KIND,
} from "../../src/features/agent-origination/contracts";
import { parseAgentActionSelection } from "../../src/features/agent-origination/structured-output";
import {
  WORK_STATE_ORIGINATION_DATA_CLASSES,
  WORK_STATE_ORIGINATION_GOALS,
  WORK_STATE_ORIGINATION_SYSTEM_INSTRUCTIONS,
  parseWorkStateSelection,
} from "../../src/features/agent-origination/originate-work-state.server";
import { MANDATE_SCOPE_NEVER_PRESELECTED } from "../../src/features/agent-mandate/contracts";
import {
  RESPONSIBILITY_SCOPED_ACTION_KINDS,
  scopeRequiresResponsibility,
} from "../../src/features/agent-mandate/responsibility-contracts";
import { refuseOutsideAgentResponsibility } from "../../src/features/action-authorization/agent-mandate-ceiling";

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const withoutComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel];
  });

const KIND = "set-work-declared-state";
const PERMIT = "src/features/action-authorization/consume-action-permit.server.ts";
const WRITER = "src/features/organizational-work/write-work.server.ts";
const EXECUTOR = "src/features/governed-internal-action/execute-set-work-state.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-work-state.server.ts";
const INLET = "src/features/heby-action-inlet/work-state-proposal.server.ts";

/* F1 */
assert.match(withoutComments(read(PERMIT)), /export type PermitConsumptionTx = Pick<ControlPlaneDatabase, "insert" \| "select">;/, "F1: the spend transaction still exposes exactly insert and select");
const writer = withoutComments(read(WRITER));
assert.match(writer, /export type WorkRecordingTx = Pick<ControlPlaneDatabase, "insert" \| "select">;/, "F1: the recording seam is unchanged");
assert.match(writer, /export type WorkStateTx = Pick<ControlPlaneDatabase, "select" \| "insert" \| "update">;/, "F1: the state core has its own type");

/* F2 */
assert.equal((writer.match(/\.set\(\{\s*declaredState\b/g) ?? []).length, 1, "F2: exactly one declared_state UPDATE in the Work Authority");
const human = writer.slice(writer.indexOf("export async function setWorkDeclaredState("), writer.indexOf("export type WorkStateTx"));
assert.ok(human.includes("declareWorkStateCore(") && !human.includes(".update("), "F2: the human path goes through the shared core");
for (const forbidden of ["actionPermits", "hebyActionRequests", "decisionRecords", "@/features/action-authorization", "consumeActionPermit"]) {
  assert.ok(!writer.includes(forbidden), `F2: the Work Authority names no ${forbidden}`);
}

/* F3 */
const door = writer.slice(writer.indexOf("export async function declareWorkStateUnderPermit("));
const at = (needle: string) => {
  const i = door.indexOf(needle);
  assert.ok(i >= 0, `F3: the door contains ${needle}`);
  return i;
};
const spend = at("await spendWithin(tx)");
const lock = at('.for("update")');
const retired = at('"work-retired"');
const scope = at('"work-scope-changed"');
const stale = at('"work-state-changed"');
const change = at("declareWorkStateCore(");
assert.ok(spend < lock && lock < retired && retired < scope && scope < stale && stale < change, "F3: spend, lock, re-ask, then the one UPDATE — in that order");
assert.match(door, /eq\(workItems\.tenantId, tenant\.tenantId\)/, "F3: the row is read with the tenant in the predicate");
assert.equal((door.match(/db\.transaction\(/g) ?? []).length, 1, "F3: the door opens exactly one transaction — the spend joins it");
assert.ok(!/onConflict|on conflict/i.test(writer), "F3: no update-through-insert anywhere in the Work Authority");

/* F4 */
const executor = withoutComments(read(EXECUTOR));
assert.ok(executor.includes("consumeActionPermit") && executor.includes("onAuthorizedWithin"), "F4: the released spend is the entry");
assert.ok(executor.includes("getDb: () => tx as unknown as ControlPlaneDatabase"), "F4: the spend joins the Work Authority's transaction");
for (const banned of ["db.transaction(", "getControlPlaneDb", ".insert(", ".update(", ".delete(", "onConflict", "retireWork", "rollback", "compensate", "undo", "resolveGovernanceAuthority"]) {
  assert.ok(!executor.includes(banned), `F4: the executor contains no ${banned}`);
}
const callback = executor.slice(executor.indexOf("async onAuthorizedWithin("), executor.indexOf("if (consumption.status"));
assert.ok(!/_tx\./.test(callback) && !/\btx\.(insert|update|delete|select)\b/.test(callback), "F4: the permit callback writes nothing");
const signature = executor.slice(executor.indexOf("export async function executeSetWorkDeclaredState"));
const params = signature.slice(0, signature.indexOf(")"));
for (const forbidden of ["workItemId", "toState", "fromState", "tenantId", "workDomainId"]) {
  assert.ok(!params.includes(forbidden), `F4: no client parameter for ${forbidden}`);
}

/* F5 */
assert.ok(!MACHINE_EXECUTABLE_ACTION_KINDS.has(KIND), "F5: not machine-executable");
for (const file of [...walk("src/features/governed-machine-execution"), ...walk("src/features/standing-mutation-authority")]) {
  assert.ok(!read(file).includes(KIND), `F5: ${file} does not name the kind`);
}

/* F6 */
assert.deepEqual([...WORK_STATE_ORIGINATION_DATA_CLASSES], ["conversation"], "F6: the model is declared conversation only");
for (const [state, goal] of Object.entries(WORK_STATE_ORIGINATION_GOALS)) {
  assert.match(goal, new RegExp(`as ${state}\\.$`), "F6: each goal names only the chosen state");
  assert.ok(!/work-item\/|work-domain\/|[0-9a-f]{8}-/.test(goal), "F6: no reference in a goal");
}
const origination = withoutComments(read(ORIGINATION));
assert.ok(origination.includes("evidence: []"), "F6: no grounding line is ever rendered");
assert.equal((origination.match(/userPrompt:/g) ?? []).length, (origination.match(/userPrompt:\s*WORK_STATE_ORIGINATION_GOALS\[/g) ?? []).length, "F6: the prompt is always a fixed goal");
assert.ok(!/\b(title|workItemRef|workItemId|fromState)\b/.test(WORK_STATE_ORIGINATION_SYSTEM_INSTRUCTIONS), "F6: the instructions name no work field");
assert.deepEqual(
  parseAgentActionSelection('{"kind":"set-work-declared-state","reason":"x"}', { recipients: [], drafts: [], work: { organizationLevel: true, departments: [], observations: [] } }),
  { status: "refused", reason: "unsupported-action-kind" },
  "F6: the general origination contract cannot select the kind",
);
assert.deepEqual(parseWorkStateSelection('{"kind":"set-work-declared-state","reason":"ok","extra":1}'), { status: "refused", reason: "unexpected-shape" });
assert.deepEqual(parseWorkStateSelection('{"kind":"record-work","reason":"ok"}'), { status: "refused", reason: "unsupported-action-kind" });
assert.deepEqual(parseWorkStateSelection('```json\n{"kind":"none","reason":"ok"}\n```'), { status: "selected", kind: "none", reason: "ok" });
const inlet = withoutComments(read(INLET));
assert.ok(!inlet.includes("recordActionRequest("), "F6: the inlet has no human entry point");

/* F7 */
assert.deepEqual(validateActionRegistry(), [], "F7: the registry is internally honest");
assert.deepEqual([...EXECUTABLE_ACTION_KINDS].at(-1), KIND, "F7: appended in authorization order");
const posture = executablePostureFor(KIND);
assert.deepEqual(
  [posture?.toolId, posture?.sideEffect, posture?.reversibility, posture?.execution],
  [SET_WORK_DECLARED_STATE_TOOL_ID, "CONSEQUENTIAL_MUTATION", "deterministic-inverse", "internal-authority"],
);
const tool = getActionTool(SET_WORK_DECLARED_STATE_TOOL_ID);
assert.equal(tool?.actionKind, KIND);
assert.equal(tool?.authorityRequirement, "human-review-required");
assert.equal(tool?.governanceGated, true);
for (const field of ["fromState", "toState"]) {
  assert.deepEqual(tool?.argumentSchema.fields.find((f) => f.name === field)?.enumValues, [...WORK_DECLARED_STATES], `F7: ${field} is the closed state vocabulary`);
}
assert.equal(AGENT_ORIGINABLE_REGISTRY_KIND[KIND], KIND);
assert.ok((AGENT_ORIGINABLE_ACTION_KINDS as readonly string[]).includes(KIND));
/* RA-AUTH-1: the echo now follows the whole mandate vocabulary — the originable kinds, then the preparation kind `prepare-research`. */
assert.match(read("src/db/schema/agent-mandate.ts"), /array\['send','record-work','set-work-declared-state','prepare-research'\]::text\[\]/, "F7: the CHECK echoes the vocabulary");
const migration = read("src/db/migrations/20261014042643_work_update_v1_mandate_scope.sql");
assert.equal((migration.match(/ALTER TABLE/g) ?? []).length, 2, "F7: the migration is one DROP and one ADD");
assert.ok(/DROP CONSTRAINT "agent_mandates_scope_subset_chk"/.test(migration) && /ADD CONSTRAINT "agent_mandates_scope_subset_chk"/.test(migration));
assert.ok(!/UPDATE|DELETE|INSERT|DROP TABLE|DROP COLUMN/i.test(migration.replace(/DROP CONSTRAINT/g, "")), "F7: no row is touched");

/* F8 */
/* RA-AUTH-1 added `prepare-research` beside it: a preparation kind is never pre-selected either. */
assert.deepEqual([...MANDATE_SCOPE_NEVER_PRESELECTED], [KIND, "prepare-research"], "F8: the mandate form never pre-selects the kind");
assert.ok(withoutComments(read("src/components/agents/agent-mandate-card.tsx")).includes("!MANDATE_SCOPE_NEVER_PRESELECTED.includes(kind)"), "F8: the form applies it");
assert.ok((RESPONSIBILITY_SCOPED_ACTION_KINDS as readonly string[]).includes(KIND) && scopeRequiresResponsibility([KIND]), "F8: a scope naming it needs a responsibility");
assert.equal(
  refuseOutsideAgentResponsibility({ status: "known", mandate: { responsibility: [] } }, KIND, { kind: "domain", workDomainId: "00000000-0000-4000-8000-000000000000" }),
  "work-outside-agent-responsibility",
  "F8: the ceiling scopes the kind to the agent's responsibility",
);

/* F9 */
for (const file of ["src/app/(dashboard)/director/work/actions.ts", "src/app/(dashboard)/director/work/page.tsx", "src/components/organizational-work/work-register.tsx", ...walk("src/features/organizational-work")]) {
  assert.ok(!withoutComments(read(file)).includes("@/features/agent-origination"), `F9: ${file} reaches no agent origination`);
}

/* F10 — the pre-model preflight: required, read-only, asked before anything is registered or disclosed. */
{
  const body = origination.slice(origination.indexOf("export async function originateWorkStateChange("));
  const at = (needle: string) => body.indexOf(needle);
  assert.ok(at("deps.preflight(") > at("resolveWorkStateTarget("), "F10: the preflight is asked about the resolved item");
  assert.ok(at("deps.preflight(") !== -1 && at("deps.preflight(") < at("registerInvocation("), "F10: the preflight runs before any invocation is registered");
  assert.ok(at("deps.preflight(") < at("deps.generate ??"), "F10: and before the model is reached");
  assert.match(body, /typeof deps\.preflight !== "function"\) return refused\(/, "F10: a missing preflight refuses");
  assert.match(body, /if \(preflight\.status !== "admitted"\) return refused\(/, "F10: anything but admitted refuses");
  for (const reach of ["@/features/agent-mandate", "readEffectiveAgentMandate", "list-eligible-agents", "@/features/origination-availability"]) {
    assert.ok(!origination.includes(reach), `F10: origination reaches no mandate reader itself (${reach}) — the preflight is injected`);
  }
  const action = withoutComments(read("src/app/(dashboard)/heby/work-state-origination-actions.ts"));
  /* WORK-UPDATE-ORGANIZATION-SCOPE-1 (Director-approved 2026-10-21): the preflight is asked about the item's recorded scope. */
  assert.match(action, /preflight: \(tenant, agentId, workScope\) => preflightWorkStateOrigination\(tenant, agentId, workScope\)/, "F10: the boundary injects the WF-1 preflight");
  const projection = withoutComments(read("src/features/origination-availability/read-origination-availability.server.ts"));
  const pre = projection.slice(projection.indexOf("export async function preflightWorkStateOrigination("));
  assert.match(pre, /refuseOutsideAgentMandate\(await readEffectiveAgentMandate\(/, "F10: the kind is asked through the shared ceiling");
  /* WORK-UPDATE-ORGANIZATION-SCOPE-1: the scope passed is the item's recorded one, organization or domain. */
  assert.match(pre, /listEligibleAgents\(tenant, workScope, deps, kind\)/, "F10: responsibility through the eligibility projection, for this kind");
  assert.ok(!/\.(insert|update|delete)\(|\.transaction\(/.test(pre), "F10: the preflight writes nothing");
  /* The writer is still the authority: its gate precedes its insert (AMA-2 pins the order). */
  assert.match(withoutComments(read("src/features/action-authorization/record-action-request.server.ts")), /refuseOutsideAgentResponsibility\(read, actionKind, workScopeFromPayload\(proposedArguments\)\)/, "F10: the writer still asks responsibility");
}

console.log("work-update-v1/work-state-firewall: OK");
