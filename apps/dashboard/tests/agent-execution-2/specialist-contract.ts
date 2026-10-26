/*
 * AGENT-EXECUTION-2 — the specialist rule and the specialist brief. Pure and source-level; no database.
 *
 *   R1  agentWorkRole: a specialist is responsible for domain work and NOT organization-wide; organization
 *       work, an organization-wide grant, or an unread mandate is never a specialist
 *   R2  no specialist claim reaches the model: the brief and the preparation seam are AE-1's (the domain-less
 *       brief made the model decline the task in production acceptance, 2026-10-25)
 *   R3  no client input carries a role
 *   R4  Heby's words: the recommendation names the specialist and leaves the choice to the person
 *   R5  plans and messages carry the internal-draft brief; content drafts keep their strict brief
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agentWorkRole } from "../../src/features/agent-work/capabilities";
import { preparationBriefFor } from "../../src/features/work-artifacts/preparation-brief";
import { describeAssignment, describeRecommendation } from "../../src/components/layout/heby/heby-work-draft-affordance";

const ROOT = path.resolve(__dirname, "../..");
const code = (f: string) =>
  readFileSync(path.join(ROOT, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
const D = "11111111-1111-4111-8111-111111111111";
const domainWork = { kind: "domain", workDomainId: D } as const;
const mandate = (responsibility: unknown[]) => ({ status: "known", mandate: { responsibility } }) as never;

/* ── R1 ── */
assert.equal(agentWorkRole(mandate([{ kind: "domain", workDomainId: D, inService: true }]), domainWork), "specialist");
assert.equal(agentWorkRole(mandate([{ kind: "organization" }, { kind: "domain", workDomainId: D, inService: true }]), domainWork), "coordinator");
assert.equal(agentWorkRole(mandate([{ kind: "domain", workDomainId: D, inService: true }]), { kind: "organization" }), "coordinator");
assert.equal(agentWorkRole({ status: "unavailable" } as never, domainWork), "coordinator", "an unread mandate is never a specialist");
assert.equal(agentWorkRole({ status: "known", mandate: null } as never, domainWork), "coordinator");

/* ── R2 / R3 · the role is Heby's and the person's, never the model's ── */
const BRIEF_SRC = code("src/features/work-artifacts/preparation-brief.ts");
const PREPARE = code("src/features/work-artifacts/prepare-work-artifact.server.ts");
assert.doesNotMatch(BRIEF_SRC, /specialist/i, "the preparation brief makes no specialist claim");
assert.doesNotMatch(PREPARE, /specialist|agentWorkRole/, "the preparation seam does not derive or forward a role");
/* R5 · the internal-draft brief: the reply is the draft; organizational claims need grounding; general practice
 * is allowed as guidance; missing facts are placeholders, not a refusal; no act is claimed; it carries no
 * tenant text and no material; the content draft keeps its own strict brief. */
for (const type of ["operational-plan", "message-draft"] as const) {
  const brief = preparationBriefFor({ artifactType: type });
  const text = String(brief?.instruction ?? "");
  assert.match(text, /Your entire reply becomes the draft/, `${type}: the reply is the draft`);
  assert.match(text, /statements about this organization[^.]*\. Make such a statement only when the GROUNDING CONTEXT supports it\./, `${type}: organizational claims need grounding`);
  assert.match(text, /You may use general professional practice/, `${type}: general practice is allowed`);
  assert.match(text, /never present it as a record or as evidence/, `${type}: general practice is never evidence`);
  assert.match(text, /bracketed placeholder/, `${type}: a missing fact is a placeholder, not an invention`);
  assert.match(text, /Do not decline a draft that general practice can write/, `${type}: no refusal of a writable draft`);
  assert.match(text, /Never state or imply that a step, review, approval, delivery or any other act has already happened/, `${type}: no act is claimed`);
  assert.deepEqual(brief?.material, [], `${type}: instruction only, so the declared data classes are unchanged`);
  assert.doesNotMatch(text, /specialist|\$\{/i, `${type}: no role claim, no interpolation`);
}
const contentText = String(preparationBriefFor({ artifactType: "content-draft", intendedDestination: "instagram" })!.instruction);
assert.doesNotMatch(contentText, /general professional practice|bracketed placeholder/, "the content draft stays strict");
assert.ok(BRIEF_SRC.includes("INTERNAL_DRAFT_PREPARATION_BRIEF: readonly string[] = ["), "the brief is a constant list of minted sentences");
assert.doesNotMatch(code("src/features/agent-work/assign-work-draft.server.ts"), /specialist:/, "the assignment seam passes no specialist flag");
assert.doesNotMatch(code("src/app/(dashboard)/heby/work-state-origination-actions.ts"), /specialist|role/i, "the client action carries ids and words only");

/* ── R4 ── */
const read = {
  status: "read", workItemId: "w", mayAssign: true, notResponsible: 0, drafts: [], recommendedAgentId: "s",
  /* WORK-OUTCOME-CLOSURE-1 added the work's declared state and completion suggestion to the read. */
  declaredState: "planned", completion: { offered: false, reason: "no-evidence" },
  agents: [
    { agentId: "c", name: "Heby", role: "coordinator", openDraftId: null },
    { agentId: "s", name: "Research Agent", role: "specialist", openDraftId: null },
  ],
} as const;
assert.match(describeRecommendation(read)!, /^Heby recommends Research Agent: .*You decide who is assigned\.$/);
/* WORK-OUTCOME-CLOSURE-1 (AE2-RECOMMENDATION-WORDING-1): the role is selection and attribution only, said so. */
assert.doesNotMatch(describeRecommendation(read)!, /writes as/, "the recommendation does not claim the agent writes as a specialist");
assert.match(describeRecommendation(read)!, /the model is not told the agent's specialty/);
assert.equal(describeRecommendation({ ...read, recommendedAgentId: null }), null);
assert.match(
  describeAssignment({ status: "prepared", workItemId: "w", artifactId: "a", revisionNo: 1, agentName: "Research Agent", agentRole: "specialist" }, "Research Agent"),
  /* WORK-OUTCOME-CLOSURE-1 (AE2-RECOMMENDATION-WORDING-1): "as this work's specialist" became attribution wording. */
  /^Research Agent wrote the draft \(revision 1\) and is recorded as its author, chosen as this work's specialist\. .*nothing was sent, published or changed\.$/,
);

console.log("agent-execution-2 specialist contract: ok");
