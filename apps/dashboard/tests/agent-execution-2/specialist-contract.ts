/*
 * AGENT-EXECUTION-2 — the specialist rule and the specialist brief. Pure and source-level; no database.
 *
 *   R1  agentWorkRole: a specialist is responsible for domain work and NOT organization-wide; organization
 *       work, an organization-wide grant, or an unread mandate is never a specialist
 *   R2  the specialist brief is minted Hebun text (SCI-1): a constant, no interpolation, no tenant name; it
 *       reaches every artifact type for a specialist and nothing changes for anyone else
 *   R3  the specialist flag is server-derived: the preparation seam computes it from the author's mandate
 *       read and the server-side scope; no client input carries it
 *   R4  Heby's words: the recommendation names the specialist and leaves the choice to the person
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agentWorkRole } from "../../src/features/agent-work/capabilities";
import { preparationBriefFor, SPECIALIST_PREPARATION_BRIEF } from "../../src/features/work-artifacts/preparation-brief";
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

/* ── R2 ── */
const brief = SPECIALIST_PREPARATION_BRIEF.join(" ");
for (const type of ["operational-plan", "message-draft"] as const) {
  assert.equal(preparationBriefFor({ artifactType: type }), undefined, `${type}: unchanged without a specialist`);
  const made = preparationBriefFor({ artifactType: type, specialist: true });
  assert.ok(made && String(made.instruction).includes(brief), `${type}: a specialist is briefed`);
  assert.deepEqual(made?.material, [], `${type}: the specialist brief carries no material`);
}
const content = preparationBriefFor({ artifactType: "content-draft", intendedDestination: "instagram", specialist: true });
assert.ok(content && String(content.instruction).includes(brief), "content-draft: specialist sentences are appended");
assert.ok(!String(preparationBriefFor({ artifactType: "content-draft", intendedDestination: "instagram" })!.instruction).includes(SPECIALIST_PREPARATION_BRIEF[0]!));
const BRIEF_SRC = code("src/features/work-artifacts/preparation-brief.ts");
const constant = BRIEF_SRC.slice(BRIEF_SRC.indexOf("SPECIALIST_PREPARATION_BRIEF: readonly string[] = ["), BRIEF_SRC.indexOf("] as const;", BRIEF_SRC.indexOf("SPECIALIST_PREPARATION_BRIEF")));
assert.ok(constant.length > 0 && !constant.includes("${"), "the specialist brief is a constant with no interpolation");

/* ── R3 ── */
const PREPARE = code("src/features/work-artifacts/prepare-work-artifact.server.ts");
assert.match(PREPARE, /const specialist = authorMandate !== undefined && agentWorkRole\(authorMandate, workScope\) === "specialist";/);
assert.doesNotMatch(PREPARE, /input\.specialist/, "the preparation seam never reads a specialist flag from its input");
assert.doesNotMatch(code("src/features/agent-work/assign-work-draft.server.ts"), /specialist:/, "the assignment seam passes no specialist flag");
assert.doesNotMatch(code("src/app/(dashboard)/heby/work-state-origination-actions.ts"), /specialist|role/i, "the client action carries ids and words only");

/* ── R4 ── */
const read = {
  status: "read", workItemId: "w", mayAssign: true, notResponsible: 0, drafts: [], recommendedAgentId: "s",
  agents: [
    { agentId: "c", name: "Heby", role: "coordinator", openDraftId: null },
    { agentId: "s", name: "Research Agent", role: "specialist", openDraftId: null },
  ],
} as const;
assert.match(describeRecommendation(read)!, /^Heby recommends Research Agent: .*You decide who is assigned\.$/);
assert.equal(describeRecommendation({ ...read, recommendedAgentId: null }), null);
assert.match(
  describeAssignment({ status: "prepared", workItemId: "w", artifactId: "a", revisionNo: 1, agentName: "Research Agent", agentRole: "specialist" }, "Research Agent"),
  /^Research Agent, as this work's specialist, wrote the draft .*nothing was sent, published or changed\.$/,
);

console.log("agent-execution-2 specialist contract: ok");
