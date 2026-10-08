/*
 * AP-4B — FIREWALL (structural).
 *
 *   F1 ONE ANSWER, FOUR ASKERS. The responsibility decision lives in the shared ceiling module and is
 *      asked by the proposal writer, the standing issuer and the shared permit spend (which the
 *      machine executor reaches); none re-derives it.
 *   F2 THE PROJECTION IS ONLY A PROJECTION. `listEligibleAgents` writes nothing, scores nothing,
 *      picks nothing, and no enforcement point, executor or origination core can import it.
 *   F3 THE MODEL NEVER SEES OR RETURNS A SCOPE. The origination prompt names no work scope or work
 *      domain, and the scope reaches the inlet from the human's input, not from the selection.
 *   F4 DEPARTMENT/PLACEMENT GRANT NOTHING. The ceiling and the projection reach no department or
 *      placement module.
 *   F5 ONE MANDATE ENTRY. The five-value `establishAgentMandate` is gone from src and scripts.
 *   F6 THE DIRECT HUMAN PATH STAYS UNSCOPED. `recordWork` passes its fields by name.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS, AGENT_ORIGINATION_KNOWLEDGE_SYSTEM_INSTRUCTIONS } from "../../src/features/agent-origination/originate-action.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const code = (f: string): string => read(f).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}
const SRC = walk("src").filter((f) => !f.startsWith("src/db/migrations/"));

const CEILING = "src/features/action-authorization/agent-mandate-ceiling.ts";
const WRITER = "src/features/action-authorization/record-action-request.server.ts";
const SPEND = "src/features/action-authorization/consume-action-permit.server.ts";
const ISSUER = "src/features/standing-mutation-authority/issue-permit-under-standing-authorization.server.ts";
const MACHINE = "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts";
const HUMAN_EXECUTOR = "src/features/governed-internal-action/execute-record-work.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";
const PROJECTION = "src/features/origination-availability/list-eligible-agents.server.ts";
const AVAILABILITY = "src/features/origination-availability/read-origination-availability.server.ts";
const WORK_WRITER = "src/features/organizational-work/write-work.server.ts";

/* F1 */
assert.match(code(CEILING), /export function refuseOutsideAgentResponsibility\(/, "F1: the decision lives in the ceiling");
for (const asker of [WRITER, SPEND, ISSUER]) {
  assert.match(code(asker), /refuseOutsideAgentResponsibility\(/, `F1: ${asker} asks the responsibility ceiling`);
  assert.match(code(asker), /workScopeFromPayload\(/, `F1: ${asker} reads the scope off the frozen payload`);
}
assert.match(code(MACHINE), /consumeActionPermitAsMachine/, "F1: the machine executor spends through the shared spend, which asks");
assert.deepEqual(
  SRC.filter((f) => /refuseOutsideAgentResponsibility\(/.test(code(f))).sort(),
  [CEILING, SPEND, ISSUER, PROJECTION, WRITER].sort(),
  "F1: the responsibility decision has exactly these askers",
);
assert.match(code(WRITER), /work-scope-required/, "F1: the one writer refuses unscoped record-work");

/* F2 */
const projection = code(PROJECTION);
assert.ok(!/\.(insert|update|delete)\(|\.transaction\(/.test(projection), "F2: the projection writes nothing");
assert.ok(!/\b(score|rank|weight|sort|best|default|prefer)\w*\s*[(:=]/i.test(projection), "F2: the projection scores, sorts and defaults nothing");
assert.deepEqual(
  SRC.filter((f) => f !== PROJECTION && code(f).includes("list-eligible-agents.server")),
  [AVAILABILITY],
  "F2: only the availability projection reads the eligibility projection",
);
for (const enforcer of [WRITER, SPEND, ISSUER, MACHINE, HUMAN_EXECUTOR, ORIGINATION, CEILING, WORK_WRITER]) {
  assert.ok(!code(enforcer).includes("list-eligible-agents") && !code(enforcer).includes("listEligibleAgents"), `F2: ${enforcer} cannot reach the projection`);
}

/* F3 */
for (const prompt of [AGENT_ORIGINATION_SYSTEM_INSTRUCTIONS, AGENT_ORIGINATION_KNOWLEDGE_SYSTEM_INSTRUCTIONS]) {
  assert.ok(!/workScope|work scope|work domain|workDomain/i.test(prompt), "F3: the model is told nothing about work scopes");
}
const origination = code(ORIGINATION);
const projectFn = origination.slice(origination.indexOf("export function projectOriginationForModel("), origination.indexOf("export async function originateAgentAction("));
assert.ok(projectFn.length > 0 && !/workScope|workDomain/.test(projectFn), "F3: the model projection carries no scope");
assert.match(origination, /const workScope = parseWorkScope\(input\.workScope\);/, "F3: the scope comes from the human's input");
assert.ok(!/chosen\.workScope|selection\.workScope/.test(origination), "F3: never from the model's selection");

/* F4 */
for (const f of [CEILING, PROJECTION]) {
  for (const forbidden of ["department-placement", "organization-authority", "schema/department", "agent-placement"]) {
    assert.ok(!code(f).includes(forbidden), `F4: ${f} must not reach ${forbidden}`);
  }
}

/* F5 */
for (const f of [...SRC, ...walk("scripts")]) {
  assert.ok(!/\bestablishAgentMandate\s*\(/.test(code(f)), `F5: ${f} calls no five-value mandate entry`);
}

/* F6 */
const human = code(WORK_WRITER).slice(code(WORK_WRITER).indexOf("export async function recordWork("));
assert.match(human, /const unscoped = \{ title, declaredState, departmentId, accountableUserId \};/, "F6: the direct human path names its fields");

console.log("ap4b-strict-work-eligibility/firewall: ok");
