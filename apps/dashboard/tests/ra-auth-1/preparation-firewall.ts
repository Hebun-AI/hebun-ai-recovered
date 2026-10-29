/*
 * RA-AUTH-1 — THE PREPARATION-ONLY MANDATE KIND AND THE RESEARCH-REPORT TYPE, PURE.
 *
 * `prepare-research` lets an agent prepare a research report for work it is responsible for. It must
 * never become an action: not originable, not in the registry, not machine-executable, not a lifecycle
 * transition, not a Governance authorization. These assertions pin that at the vocabulary, the ceiling,
 * the capability contract and the artifact vocabulary.
 *
 *   P1 the vocabulary: one preparation kind, disjoint from every action vocabulary
 *   P2 the mandate vocabulary is the originable kinds then the preparation kinds — nothing else
 *   P3 the action ceiling admits no act from a preparation kind
 *   P4 the preparation ceiling refuses every missing condition, in order
 *   P5 the capability contract: research needs `prepare-research`; a general draft never accepts it
 *   P6 no performing seam, no origination, registry or machine path names it
 *   P7 the artifact vocabulary: `research-report` is stored, never offered to the general path
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  AGENT_PREPARATION_KINDS,
  MANDATE_SCOPE_NEVER_PRESELECTED,
  MANDATE_SCOPE_VOCABULARY,
  canonicaliseMandateScope,
  isAgentPreparationKind,
  isMandateScopeKind,
} from "../../src/features/agent-mandate/contracts";
import { scopeRequiresResponsibility } from "../../src/features/agent-mandate/responsibility-contracts";
import { AGENT_ORIGINABLE_ACTION_KINDS, AGENT_ORIGINABLE_REGISTRY_KIND } from "../../src/features/agent-origination/contracts";
import {
  RESPONSIBILITY_SCOPED_REGISTRY_KINDS,
  refuseOutsideAgentMandate,
  refuseOutsideAgentPreparation,
  refuseOutsideAgentResponsibility,
} from "../../src/features/action-authorization/agent-mandate-ceiling";
import { agentWorkCapability, refuseOutsideAgentWorkCapability } from "../../src/features/agent-work/capabilities";
import { EXECUTABLE_ACTION_KINDS, listActionTools } from "../../src/features/heby-actions/action-registry";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "../../src/features/governed-machine-execution/contracts";
import {
  RESEARCH_REPORT_ARTIFACT_TYPE,
  STORED_WORK_ARTIFACT_TYPES,
  WORK_ARTIFACT_TYPES,
  isWorkArtifactType,
} from "../../src/features/work-artifacts/contracts";
import { validateWorkArtifactInput } from "../../src/features/work-artifacts/validation";
import { workArtifactTypeEnum } from "../../src/db/schema/_enums";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const KIND = "prepare-research" as const;
const ENG = "11111111-1111-4111-8111-111111111111";
const FIN = "22222222-2222-4222-8222-222222222222";

type Grant = { kind: "organization" } | { kind: "domain"; workDomainId: string; inService: boolean };
const known = (proposalScope: string[], responsibility: Grant[]) =>
  ({ status: "known", mandate: { proposalScope, responsibility } }) as const;

/* ── P1 · one preparation kind, disjoint from every action vocabulary ── */
assert.deepEqual([...AGENT_PREPARATION_KINDS], [KIND], "P1: exactly one preparation kind is released");
assert.equal(isAgentPreparationKind(KIND), true);
for (const kind of AGENT_PREPARATION_KINDS) {
  assert.ok(!(AGENT_ORIGINABLE_ACTION_KINDS as readonly string[]).includes(kind), `P1: ${kind} is not originable`);
  assert.ok(!Object.prototype.hasOwnProperty.call(AGENT_ORIGINABLE_REGISTRY_KIND, kind), `P1: ${kind} maps to no registry kind`);
  assert.ok(!listActionTools().some((tool) => (tool.actionKind as string) === kind), `P1: ${kind} is no registry action`);
  assert.ok(!(EXECUTABLE_ACTION_KINDS as readonly string[]).includes(kind), `P1: ${kind} is not executable`);
  assert.ok(!MACHINE_EXECUTABLE_ACTION_KINDS.has(kind), `P1: ${kind} is not machine-executable`);
  assert.ok(!RESPONSIBILITY_SCOPED_REGISTRY_KINDS.includes(kind), `P1: ${kind} is no registry kind the action ceiling scopes`);
}
for (const alias of AGENT_ORIGINABLE_ACTION_KINDS) assert.equal(isAgentPreparationKind(alias), false, `P1: ${alias} is not a preparation kind`);

/* ── P2 · the mandate vocabulary ── */
assert.deepEqual([...AGENT_ORIGINABLE_ACTION_KINDS], ["send", "record-work", "set-work-declared-state"], "P2: the originable vocabulary is unchanged");
assert.deepEqual([...MANDATE_SCOPE_VOCABULARY], [...AGENT_ORIGINABLE_ACTION_KINDS, ...AGENT_PREPARATION_KINDS], "P2: originable then preparation, nothing else");
assert.equal(isMandateScopeKind(KIND), true);
assert.deepEqual(canonicaliseMandateScope([KIND, "send", KIND]), ["send", KIND], "P2: canonical order is the vocabulary's own");
assert.equal(canonicaliseMandateScope([KIND, "prepare-anything"]), null, "P2: an unknown preparation kind is refused whole");
assert.equal(scopeRequiresResponsibility([KIND]), true, "P2: prepare-research is responsibility-scoped");
assert.ok(MANDATE_SCOPE_NEVER_PRESELECTED.includes(KIND), "P2: no mandate form pre-selects it — a revision for another reason never grants research");
const vocab = read("src/features/agent-mandate/contracts.ts");
assert.match(vocab, /MANDATE_SCOPE_VOCABULARY: readonly MandateScopeKind\[\] = Object\.freeze\(\[\n  \.\.\.AGENT_ORIGINABLE_ACTION_KINDS,\n  \.\.\.AGENT_PREPARATION_KINDS,\n\]\);/, "P2: built from the two released constants, no literal");

/* ── P3 · the action ceiling admits no act from a preparation kind ── */
const researchOnly = known([KIND], [{ kind: "organization" }, { kind: "domain", workDomainId: ENG, inService: true }]);
for (const tool of listActionTools()) {
  assert.equal(refuseOutsideAgentMandate(researchOnly, tool.actionKind), "action-outside-agent-mandate", `P3: ${tool.actionKind} is outside a research-only mandate`);
}
assert.equal(refuseOutsideAgentMandate(researchOnly, KIND), "action-outside-agent-mandate", "P3: the kind itself is never an act");
for (const probe of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
  assert.equal(refuseOutsideAgentMandate(known([probe], []), probe), "action-outside-agent-mandate", `P3: ${probe} is not an alias`);
}
assert.equal(refuseOutsideAgentResponsibility(researchOnly, KIND, { kind: "organization" }), null, "P3: the action responsibility test scopes registry kinds only");
/* The released record-work answer is unchanged beside it. */
assert.equal(refuseOutsideAgentMandate(known(["record-work", KIND], []), AGENT_ORIGINABLE_REGISTRY_KIND["record-work"]), null, "P3: an action kind in the same scope still admits its act");

/* ── P4 · the preparation ceiling ── */
const D = (workDomainId: string) => ({ kind: "domain", workDomainId }) as const;
assert.equal(refuseOutsideAgentPreparation({ status: "unavailable" }, KIND, D(ENG)), "agent-mandate-authority-unavailable", "P4: unreadable");
assert.equal(refuseOutsideAgentPreparation({ status: "known", mandate: null }, KIND, D(ENG)), "no-agent-mandate", "P4: no mandate (another tenant's agent reads as this)");
assert.equal(refuseOutsideAgentPreparation(known([], [{ kind: "organization" }]), KIND, { kind: "organization" }), "action-outside-agent-mandate", "P4: withdrawn");
assert.equal(
  refuseOutsideAgentPreparation(known(["record-work", "set-work-declared-state"], [{ kind: "domain", workDomainId: ENG, inService: true }]), KIND, D(ENG)),
  "action-outside-agent-mandate",
  "P4: action kinds never admit a preparation",
);
assert.equal(refuseOutsideAgentPreparation(researchOnly, KIND, null), "work-scope-required", "P4: no work scope");
assert.equal(refuseOutsideAgentPreparation(researchOnly, KIND, { kind: "nonsense" } as never), "work-scope-required", "P4: unreadable work scope");
assert.equal(refuseOutsideAgentPreparation(researchOnly, KIND, D(FIN)), "work-outside-agent-responsibility", "P4: another domain");
assert.equal(
  refuseOutsideAgentPreparation(known([KIND], [{ kind: "domain", workDomainId: ENG, inService: false }]), KIND, D(ENG)),
  "work-outside-agent-responsibility",
  "P4: a retired domain",
);
assert.equal(refuseOutsideAgentPreparation(known([KIND], [{ kind: "domain", workDomainId: ENG, inService: true }]), KIND, { kind: "organization" }), "work-outside-agent-responsibility", "P4: a domain covers no organization work");
assert.equal(refuseOutsideAgentPreparation(known([KIND], [{ kind: "organization" }]), KIND, D(ENG)), "work-outside-agent-responsibility", "P4: organization covers no domain");
assert.equal(refuseOutsideAgentPreparation(researchOnly, KIND, D(ENG)), null, "P4: admitted for its own domain");
assert.equal(refuseOutsideAgentPreparation(researchOnly, KIND, { kind: "organization" }), null, "P4: admitted for organization work");
for (const alias of AGENT_ORIGINABLE_ACTION_KINDS) {
  assert.equal(
    refuseOutsideAgentPreparation(known([...AGENT_ORIGINABLE_ACTION_KINDS], [{ kind: "organization" }]), alias as never, { kind: "organization" }),
    "action-outside-agent-mandate",
    `P4: the preparation ceiling never admits the action ${alias}`,
  );
}

/* ── P5 · the capability contract ── */
const research = agentWorkCapability("prepare-research-report");
const draft = agentWorkCapability("prepare-work-draft");
assert.deepEqual([...research.mandateKindsAnyOf], [KIND], "P5: research needs prepare-research and nothing else");
assert.equal(research.sideEffect, "PREPARATION_ONLY");
assert.equal(research.authorizationRequired, false);
/* RA-EAI-1 — it now declares its one disclosure, and is still performed by nothing. */
assert.deepEqual(research.dataUse, { purpose: "research", dataClasses: ["conversation"] }, "P5: research × conversation, nothing else");
assert.match(research.performedBy, /^no seam yet/, "P5: declared, not performable");
assert.ok(research.cannot.some((line) => /send|publish/.test(line)) && research.cannot.some((line) => /state/.test(line)), "P5: says it cannot send, publish or change state");
assert.deepEqual([...draft.mandateKindsAnyOf], ["record-work", "set-work-declared-state"], "P5: the general draft condition is unchanged");
assert.equal(refuseOutsideAgentWorkCapability(research, researchOnly, D(ENG)), null, "P5: a research mandate admits research for its work");
assert.equal(refuseOutsideAgentWorkCapability(research, researchOnly, D(FIN)), "work-outside-agent-responsibility", "P5: and not for other work");
assert.equal(refuseOutsideAgentWorkCapability(draft, researchOnly, D(ENG)), "action-outside-agent-mandate", "P5: a research mandate grants no general draft");
const recorder = known(["record-work"], [{ kind: "domain", workDomainId: ENG, inService: true }]);
assert.equal(refuseOutsideAgentWorkCapability(research, recorder, D(ENG)), "action-outside-agent-mandate", "P5: a record-work mandate grants no research");
assert.equal(refuseOutsideAgentWorkCapability(draft, recorder, D(ENG)), null, "P5: the released draft behaviour is preserved");

/* ── P6 · no performing seam, no action path names it ── */
function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? sourceFiles(rel) : /\.(ts|tsx)$/.test(entry) ? [rel] : [];
  });
}
const src = sourceFiles("src");
for (const file of src.filter((f) => f.endsWith(".server.ts"))) {
  assert.doesNotMatch(read(file), /prepare-research-report/, `P6: ${file} performs no research capability yet`);
}
for (const file of src.filter((f) =>
  /features\/(agent-origination|heby-actions|heby-action-inlet|governed-machine-execution|standing-mutation-authority|governance-decision|tenant-machine-execution-authority)\//.test(f),
)) {
  assert.doesNotMatch(read(file), /prepare-research/, `P6: ${file} never names the preparation kind`);
}
assert.match(
  read("src/features/origination-availability/read-origination-availability.server.ts"),
  /proposalScope: mandate\.mandate\.proposalScope\.filter\(\(kind\) => !isAgentPreparationKind\(kind\)\)/,
  "P6: origination's view of a mandate holds only what it may propose",
);

/* ── P7 · the artifact vocabulary ── */
assert.deepEqual([...WORK_ARTIFACT_TYPES], ["operational-plan", "message-draft", "content-draft"], "P7: the general preparation vocabulary is unchanged");
assert.equal(RESEARCH_REPORT_ARTIFACT_TYPE, "research-report");
assert.deepEqual([...STORED_WORK_ARTIFACT_TYPES], [...workArtifactTypeEnum.enumValues], "P7: the stored types are the database enum, one for one");
assert.equal(isWorkArtifactType(RESEARCH_REPORT_ARTIFACT_TYPE), false, "P7: the general path does not accept research-report");
assert.ok(
  validateWorkArtifactInput({ artifactType: RESEARCH_REPORT_ARTIFACT_TYPE, title: "Market scan", content: "x" }).some((p) => p.field === "artifactType"),
  "P7: the general writer's validation refuses research-report",
);
for (const type of WORK_ARTIFACT_TYPES) {
  assert.deepEqual(validateWorkArtifactInput({ artifactType: type, title: "t", content: "c", intendedDestination: type === "content-draft" ? "instagram" : undefined }), [], `P7: ${type} still validates`);
}
assert.match(read("src/features/work-artifacts/prepare-work-artifact.server.ts"), /if \(!isWorkArtifactType\(target\.artifactType\)\) return \{ status: "refused", reason: "invalid-input", problems: \[\] \};/, "P7: the general seam never revises a research report");
assert.match(read("src/features/agent-work/assign-work-draft.server.ts"), /if \(!isWorkArtifactType\(draft\.artifactType\)\) return \{ status: "refused", reason: "agent-not-eligible" \};/, "P7: a general draft agent never revises a research report");

console.log("ra-auth-1/preparation-firewall: passed");
