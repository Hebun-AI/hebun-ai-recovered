import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";
import { getTeamsRolesModel } from "../../src/features/workforce/teams-roles-model";
import { getCapabilitiesModel } from "../../src/features/workforce/capabilities-model";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { listActionTools } from "../../src/features/heby-actions/action-registry";

/*
 * Hebun UI Phase 25C — Workforce Teams & Roles + Capabilities + department authority cleanup.
 *
 * Structural + read-model assertions. The authoritative Workforce IA is exactly four surfaces;
 * Teams & Roles and Capabilities are real, provenance-honest routes; capability is kept distinct
 * from permission / authorization / connected tool / execution; departments are demoted to legacy
 * domain surfaces (kept reachable for 25D) with Finance's Decisions-duplicating ApprovalRow removed;
 * Heby stays advisory-only; and the seven-workspace IA plus Phase 25B truth remain intact.
 */

const APP = "src/app/(dashboard)";
const read = (p: string): string => readFileSync(p, "utf8");

const financeSrc = read(`${APP}/finance/page.tsx`);
const hrSrc = read(`${APP}/hr/page.tsx`);
const legalSrc = read(`${APP}/legal/page.tsx`);
const ticketsSrc = read(`${APP}/tickets/page.tsx`);
const agentsPageSrc = read(`${APP}/agents/page.tsx`);
const agentsSurfaceSrc = read("src/components/agents/agents-truth-surface.tsx");
const sidebarSrc = read("src/config/sidebar.config.ts");

const NEW_FILES = [
  "src/features/workforce/teams-roles-model.ts",
  "src/features/workforce/capabilities-model.ts",
  "src/components/workforce-workspace/teams-roles-surface.tsx",
  "src/components/workforce-workspace/capabilities-surface.tsx",
  "src/components/workforce-workspace/legacy-domain.tsx",
  `${APP}/workforce/teams/page.tsx`,
  `${APP}/workforce/capabilities/page.tsx`,
];

/* 1, 10, 24 — Authoritative Workforce L2 = exactly the four locked surfaces. */
function authoritativeIa(): void {
  const labels = getWorkspace("workforce").destinations.map((d) => d.label);
  assert.deepEqual(labels, ["Overview", "Agents", "Teams & Roles", "Capabilities"], "Workforce L2 is the four locked surfaces");
  for (const dept of ["Finance", "HR", "Legal", "Customer Ops"]) {
    assert.ok(!labels.includes(dept), `${dept} is not an authoritative Workforce L2`);
  }
  assert.equal(getWorkspace("workforce").destinations.find((d) => d.label === "Teams & Roles")?.href, "/workforce/teams");
  assert.equal(getWorkspace("workforce").destinations.find((d) => d.label === "Capabilities")?.href, "/workforce/capabilities");
  assert.equal(WORKSPACES.length, 7, "seven workspaces intact");
  assert.deepEqual(
    WORKSPACES.map((w) => w.id),
    ["command", "intelligence", "knowledge", "operations", "workforce", "governance", "platform"],
    "seven-workspace order intact",
  );
}

/* 2, 3, 25 — Teams & Roles and Capabilities are real routes, not placeholder-shadowed. */
function realRoutesNoShadow(): void {
  assert.ok(existsSync(`${APP}/workforce/teams/page.tsx`), "Teams & Roles page exists");
  assert.ok(existsSync(`${APP}/workforce/capabilities/page.tsx`), "Capabilities page exists");
  assert.ok(/getTeamsRolesModel/.test(read(`${APP}/workforce/teams/page.tsx`)), "Teams page binds a read model");
  assert.ok(/getCapabilitiesModel/.test(read(`${APP}/workforce/capabilities/page.tsx`)), "Capabilities page binds a read model");
  // Not shadowed by the legacy sidebar catch-all registry.
  assert.ok(!sidebarSrc.includes("/workforce/teams"), "no sidebar shadow for /workforce/teams");
  assert.ok(!sidebarSrc.includes("/workforce/capabilities"), "no sidebar shadow for /workforce/capabilities");
}

/* 4 — Teams & Roles fabricates no live staffing. */
function teamsNoFakeStaffing(): void {
  const m = getTeamsRolesModel();
  assert.equal(m.humanWorkforceConnected, false, "no human workforce connected");
  assert.equal(m.liveStaffing, false, "no live staffing");
  assert.equal(m.reportingHierarchy, false, "no reporting hierarchy");
  assert.ok(m.honestEmpty.some((f) => /staffing/i.test(f.concept)), "honest-empty names live staffing");
  // Groupings are seeded structure, present but labelled seeded.
  assert.ok(m.seededDefinitionCount > 0 && m.groupingCount > 0, "seeded groupings read structurally");
  assert.ok(/seeded/i.test(m.provenanceNote) && /not an authoritative/i.test(m.provenanceNote), "provenance says seeded, not authoritative teams");
}

/* 5-9 — Capabilities keeps declaration distinct from tool / permission / authorization / execution. */
function capabilityDistinctions(): void {
  const m = getCapabilitiesModel();
  const stage = (k: string) => m.capabilityLadder.find((s) => s.key === k);
  assert.equal(stage("declared")?.state, "reached", "capabilities are declared");
  assert.equal(stage("tool-connected")?.state, "not-reached", "declared ≠ connected tool");
  assert.equal(stage("permission-granted")?.state, "not-reached", "declared ≠ granted permission");
  assert.equal(stage("authorized")?.state, "not-reached", "declared ≠ authorization");
  assert.equal(stage("executed")?.state, "not-reached", "declared ≠ execution");
  assert.equal(m.executionAvailable, false, "execution unavailable");
  // Separate aggregates prove capability, tool, and permission are distinct concepts.
  assert.ok(Array.isArray(m.declaredCapabilities) && Array.isArray(m.declaredPermissions) && Array.isArray(m.referencedTools), "distinct aggregates");
  assert.ok(m.authorityOwnership.some((r) => /Decisions/.test(r.owner)), "authorization owned by Decisions");
  assert.ok(m.authorityOwnership.some((r) => /Operations/.test(r.owner)), "execution owned by Operations");
  assert.ok(m.authorityOwnership.some((r) => /Platform/.test(r.owner)), "tool connection owned by Platform");
}

/* 11, 12, 17 — Departments reachable but demoted to explicit legacy domain surfaces. */
function departmentsDemoted(): void {
  for (const rel of ["finance", "hr", "legal", "tickets"]) {
    assert.ok(existsSync(`${APP}/${rel}/page.tsx`), `/${rel} route remains reachable`);
  }
  const match = getWorkspace("workforce").match ?? [];
  for (const href of ["/finance", "/hr", "/legal", "/tickets"]) {
    assert.ok(match.includes(href), `${href} still resolves to Workforce (reachable for 25D)`);
  }
  for (const [name, src] of [["finance", financeSrc], ["hr", hrSrc], ["legal", legalSrc], ["tickets", ticketsSrc]] as const) {
    assert.ok(/LegacyDomainNotice/.test(src), `${name} renders the legacy domain notice`);
  }
}

/* 13 — Finance no longer presents Approve/Reject (Decisions duplication removed). */
function financeNoApproval(): void {
  assert.ok(!/import[^\n]*ApprovalRow/.test(financeSrc), "finance does not import ApprovalRow");
  assert.ok(!/features\/approvals/.test(financeSrc), "finance imports nothing from features/approvals");
  assert.ok(!financeSrc.includes('commandType="approval.approve"'), "finance has no Approve control");
  assert.ok(!financeSrc.includes('commandType="approval.reject"'), "finance has no Reject control");
}

/* 14 — Decisions remains the sole human-decision authority. */
function decisionsAuthorityIntact(): void {
  const approvals = read(`${APP}/approvals/page.tsx`);
  assert.ok(/DecisionWorkspace/.test(approvals), "/approvals still renders the Decisions workspace");
  assert.equal(getWorkspace("command").destinations.find((d) => d.label === "Decisions")?.href, "/approvals", "Command → Decisions still points at /approvals");
  // The legacy notice points humans to Decisions rather than duplicating it.
  assert.ok(read("src/components/workforce-workspace/legacy-domain.tsx").includes("/approvals"), "legacy notice references Decisions");
}

/* 15 — Legal does not become a second Governance authority. */
function legalNotGovernance(): void {
  assert.ok(!/@\/features\/governance/.test(legalSrc), "legal imports no governance engine");
  assert.ok(/LegacyDomainNotice/.test(legalSrc), "legal is a legacy domain surface");
}

/* 16 — Customer Ops is not Operations execution authority. */
function ticketsNotOperations(): void {
  const opsMatch = getWorkspace("operations").match ?? [];
  assert.ok(!opsMatch.includes("/tickets"), "/tickets is not claimed by Operations");
  assert.ok(!/owned by the Operations Department/.test(ticketsSrc), "tickets drops the Operations-ownership claim");
  assert.ok(/LegacyDomainNotice/.test(ticketsSrc), "tickets is a legacy domain surface");
}

/* 18, 22 — Phase 25B truth preserved: AgentCard is not in the authoritative Agents surface. */
function phase25bPreserved(): void {
  assert.ok(!/agents\/agent-card/.test(agentsPageSrc), "agents page does not import AgentCard");
  assert.ok(!/agents\/agent-card/.test(agentsSurfaceSrc), "agents surface does not import AgentCard");
  assert.ok(/getAgentsTruthModel/.test(agentsPageSrc), "agents page still reads the truth model");
  assert.ok(!/@\/features\/agent-runtime/.test(agentsPageSrc), "agents page still avoids the runtime projection");
}

/* 19 — agents/mock remains load-bearing and untouched (still seeds agent-crud). */
function mockLoadBearing(): void {
  assert.ok(existsSync("src/features/agents/mock.ts"), "agents/mock remains");
  assert.ok(/features\/agents\/mock/.test(read("src/features/agent-crud/agent-adapter.ts")), "agent-crud still seeds from agents/mock");
}

/* 20 — Heby remains advisory-only and cannot manage the workforce. */
function hebyAdvisoryOnly(): void {
  const profile = getHebyWorkspaceProfile("workforce");
  assert.equal(profile.authority, "advisory-only", "Heby Workforce authority is advisory-only");
  for (const cap of profile.capabilities) assert.equal(cap.state, "contract-only", "capabilities contract-only");
  assert.equal(listActionTools().filter((t) => t.ownerWorkspace === "workforce").length, 0, "no Heby action tool owned by Workforce");
}

/* 21 — No new execution/secret/provider controls in any Phase 25C file. Code-only tokens. */
function noNewControls(): void {
  for (const file of NEW_FILES) {
    const src = read(file);
    for (const forbidden of [
      "child_process",
      "process.env",
      "spawn(",
      "execSync",
      "fetch(",
      'type="password"',
      "dangerouslySet",
      "provider-invocation",
      "device-runtime",
    ]) {
      assert.ok(!src.includes(forbidden), `no "${forbidden}" in ${file}`);
    }
    // No mutation control vocabulary in the new surfaces/models.
    for (const mutation of ["grant-permission", "approval.approve", "approval.reject", "dispatchCommand"]) {
      assert.ok(!src.includes(mutation), `no "${mutation}" control in ${file}`);
    }
  }
}

/* 23 — Phase 20-24 spot checks unaffected. */
function priorPhasesIntact(): void {
  assert.ok(getWorkspace("governance").destinations.some((d) => d.label === "Security Center"), "Security Center intact");
  assert.equal(getWorkspace("platform").destinations[0]?.href, "/platform", "Platform overview intact");
}

function main(): void {
  authoritativeIa();
  realRoutesNoShadow();
  teamsNoFakeStaffing();
  capabilityDistinctions();
  departmentsDemoted();
  financeNoApproval();
  decisionsAuthorityIntact();
  legalNotGovernance();
  ticketsNotOperations();
  phase25bPreserved();
  mockLoadBearing();
  hebyAdvisoryOnly();
  noNewControls();
  priorPhasesIntact();
  console.log("phase 25C workforce IA + capabilities + department-cleanup contract checks passed");
}

main();
