/*
 * AP-4B — THE PURE HALF: the work-scope vocabulary, the responsibility ceiling, the approved-payload
 * parser, and the model's inability to choose a scope. No database.
 *
 *   S1 the scope parses only in its exact shape; never defaulted to organization-level.
 *   S2 the payload arguments round-trip, and a contradictory payload is no scope.
 *   C1 organization scope ← only an organization grant; domain scope ← only that IN-SERVICE domain.
 *   C2 undeclared, unreadable and absent mandates refuse; send and every other kind pass untouched.
 *   P1 the approved-payload parser refuses a record-work payload without a well-formed scope.
 *   M1 the model's selection contract has no scope key: an answer naming one is refused.
 */
import assert from "node:assert/strict";
import {
  formatWorkDomainRef,
  parseWorkDomainRef,
  parseWorkScope,
  workScopeArguments,
  workScopeFromPayload,
} from "../../src/features/work-domain/work-scope";
import { refuseOutsideAgentResponsibility } from "../../src/features/action-authorization/agent-mandate-ceiling";
import { workInputFrom } from "../../src/features/governed-internal-action/execute-record-work.server";
import { parseAgentActionSelection } from "../../src/features/agent-origination/structured-output";
import type { OriginationCandidateSet } from "../../src/features/agent-origination/contracts";

const ENG = "11111111-1111-4111-8111-111111111111";
const FIN = "22222222-2222-4222-8222-222222222222";

/* S1 */
assert.deepEqual(parseWorkScope({ kind: "organization" }), { kind: "organization" });
assert.deepEqual(parseWorkScope({ kind: "domain", workDomainId: ENG.toUpperCase() }), { kind: "domain", workDomainId: ENG });
for (const bad of [null, undefined, "organization", {}, { kind: "org" }, { kind: "organization", workDomainId: ENG }, { kind: "domain" }, { kind: "domain", workDomainId: "x" }, { kind: "domain", workDomainId: ENG, extra: 1 }]) {
  assert.equal(parseWorkScope(bad), null, `S1: ${JSON.stringify(bad)} is not a scope`);
}
assert.equal(parseWorkDomainRef("work-domain/AAAAAAAA-1111-4111-8111-111111111111"), null, "S1: uppercase reference refused");
assert.throws(() => formatWorkDomainRef("nope"));

/* S2 */
assert.deepEqual(workScopeArguments({ kind: "organization" }), { workScope: "organization" });
assert.deepEqual(workScopeArguments({ kind: "domain", workDomainId: ENG }), { workScope: "domain", workDomainRef: `work-domain/${ENG}` });
for (const scope of [{ kind: "organization" as const }, { kind: "domain" as const, workDomainId: ENG }]) {
  assert.deepEqual(workScopeFromPayload({ title: "t", ...workScopeArguments(scope) }), scope, "S2: round trip");
}
for (const bad of [{}, { workScope: "organization", workDomainRef: `work-domain/${ENG}` }, { workScope: "domain" }, { workScope: "domain", workDomainRef: "department/x" }, { workScope: "team" }]) {
  assert.equal(workScopeFromPayload(bad), null, `S2: ${JSON.stringify(bad)} carries no scope`);
}

/* C1 / C2 */
const known = (responsibility: unknown[]) => ({ status: "known" as const, mandate: { responsibility: responsibility as never } });
const org = { kind: "organization" as const };
const eng = { kind: "domain" as const, workDomainId: ENG, inService: true };
const engRetired = { kind: "domain" as const, workDomainId: ENG, inService: false };
const RW = "record-work";
const cases: [string, Parameters<typeof refuseOutsideAgentResponsibility>[0], unknown, string | null][] = [
  ["org grant admits org", known([org]), { kind: "organization" }, null],
  ["org grant does not admit a domain", known([org]), { kind: "domain", workDomainId: ENG }, "work-outside-agent-responsibility"],
  ["domain grant admits that domain", known([eng]), { kind: "domain", workDomainId: ENG }, null],
  ["domain grant does not admit org", known([eng]), { kind: "organization" }, "work-outside-agent-responsibility"],
  ["domain grant does not admit another domain", known([eng]), { kind: "domain", workDomainId: FIN }, "work-outside-agent-responsibility"],
  ["retired domain admits nothing", known([engRetired]), { kind: "domain", workDomainId: ENG }, "work-outside-agent-responsibility"],
  ["undeclared admits nothing", known([]), { kind: "organization" }, "work-outside-agent-responsibility"],
  ["no mandate", { status: "known", mandate: null }, { kind: "organization" }, "no-agent-mandate"],
  ["unreadable", { status: "unavailable" }, { kind: "organization" }, "agent-mandate-authority-unavailable"],
  ["no scope stated", known([org, eng]), null, "work-scope-required"],
];
for (const [label, read, scope, expected] of cases) {
  assert.equal(refuseOutsideAgentResponsibility(read, RW, scope as never), expected, `C1/C2: ${label}`);
}
for (const kind of ["send-external-communication", "place-human-in-department", "publish-instagram-media"]) {
  assert.equal(refuseOutsideAgentResponsibility(known([]), kind, null), null, `C2: ${kind} is outside AP-4`);
  assert.equal(refuseOutsideAgentResponsibility({ status: "unavailable" }, kind, null), null, `C2: ${kind} untouched even when unreadable`);
}

/* P1 */
const authorization = (canonicalPayload: Record<string, string>) =>
  ({ canonicalPayload } as unknown as Parameters<typeof workInputFrom>[0]);
assert.deepEqual(
  workInputFrom(authorization({ title: "Audit", departmentScope: "organization-level", ...workScopeArguments({ kind: "domain", workDomainId: ENG }) })),
  { title: "Audit", departmentId: null, workScope: { kind: "domain", workDomainId: ENG } },
);
assert.equal(workInputFrom(authorization({ title: "Audit", departmentScope: "organization-level" })), null, "P1: a pre-B unscoped payload is not recordable");
assert.equal(workInputFrom(authorization({ title: "Audit", departmentScope: "organization-level", workScope: "domain" })), null, "P1: contradictory");

/* M1 */
const CANDIDATES: OriginationCandidateSet = { recipients: [], drafts: [], work: { organizationLevel: true, departments: [], observations: [] } };
const envelope = (args: unknown) => JSON.stringify({ kind: "record-work", args, reason: "The organization owes itself this record." });
assert.equal(parseAgentActionSelection(envelope({ title: "Re-warp the loom", scope: { kind: "organization-level" } }), CANDIDATES).status, "selected");
for (const args of [
  { title: "Re-warp the loom", scope: { kind: "organization-level" }, workScope: { kind: "domain", workDomainId: ENG } },
  { title: "Re-warp the loom", scope: { kind: "organization-level", workScope: "organization" } },
  { title: "Re-warp the loom", scope: { kind: "domain", workDomainId: ENG } },
]) {
  assert.equal(parseAgentActionSelection(envelope(args), CANDIDATES).status, "refused", `M1: the model cannot state a scope: ${JSON.stringify(args)}`);
}

console.log("ap4b-strict-work-eligibility/scope-and-ceiling: passed");
