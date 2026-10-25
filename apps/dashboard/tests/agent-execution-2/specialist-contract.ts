/*
 * AGENT-EXECUTION-2 — the specialist rule and the specialist brief. Pure and source-level; no database.
 *
 *   R1  agentWorkRole: a specialist is responsible for domain work and NOT organization-wide; organization
 *       work, an organization-wide grant, or an unread mandate is never a specialist
 *   R2  no specialist claim reaches the model: the brief and the preparation seam are AE-1's (the domain-less
 *       brief made the model decline the task in production acceptance, 2026-10-25)
 *   R3  no client input carries a role
 *   R4  Heby's words: the recommendation names the specialist and leaves the choice to the person
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
assert.equal(preparationBriefFor({ artifactType: "operational-plan" }), undefined, "a plan is prepared exactly as in AE-1");
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
