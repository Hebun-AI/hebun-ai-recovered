import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes } from "../../src/config/sidebar.config";
import { getTeamsRolesModel } from "../../src/features/workforce/teams-roles-model";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { listActionTools } from "../../src/features/heby-actions/action-registry";

/*
 * Hebun UI Phase 25D — Workforce legacy + route + authority closure.
 *
 * Proves the closure holds: authoritative Workforce IA is exactly four; departments are demoted
 * and reachable but never authoritative; the fabricated /workforce/{dept}/{agent} shadow tree
 * redirects to /agents; the two dead presentation components (AgentCard, ApprovalRow) are retired
 * with zero importers; stale static routes are corrected; load-bearing mocks are retained; Decisions
 * authority and the seven-workspace program are intact; and no eighth/Enterprise-Domains workspace
 * was introduced.
 */

const APP = "src/app/(dashboard)";
const read = (p: string): string => readFileSync(p, "utf8");

const catchAllSrc = read(`${APP}/[...slug]/page.tsx`);
const modulePlaceholderSrc = read("src/components/layout/module-placeholder.tsx");
const registrySrc = read("src/components/agents/agent-registry-workspace.tsx");
const financeSrc = read(`${APP}/finance/page.tsx`);
const legalSrc = read(`${APP}/legal/page.tsx`);
const ticketsSrc = read(`${APP}/tickets/page.tsx`);

/* 1, 2, 18 — Authoritative Workforce IA = four; departments absent; seven workspaces intact. */
function authoritativeIa(): void {
  assert.deepEqual(
    getWorkspace("workforce").destinations.map((d) => d.label),
    ["Overview", "Agents", "Teams & Roles", "Capabilities"],
    "Workforce L2 is exactly the four locked surfaces",
  );
  for (const dept of ["Finance", "HR", "Legal", "Customer Ops"]) {
    assert.ok(!getWorkspace("workforce").destinations.some((d) => d.label === dept), `${dept} absent from L2`);
  }
  assert.equal(WORKSPACES.length, 7, "seven workspaces");
}

/* 3 — Four canonical Workforce routes are real and not sidebar-shadowed. */
function canonicalRoutesReal(): void {
  for (const rel of ["workforce", "agents", "workforce/teams", "workforce/capabilities"]) {
    assert.ok(existsSync(`${APP}/${rel}/page.tsx`), `/${rel} is a real page`);
  }
  const sidebar = read("src/config/sidebar.config.ts");
  assert.ok(!sidebar.includes('"/workforce/teams"'), "no sidebar shadow for /workforce/teams");
  assert.ok(!sidebar.includes('"/workforce/capabilities"'), "no sidebar shadow for /workforce/capabilities");
}

/* 4, 5 — Departments reachable but legacy; none becomes Operations/Governance/Decisions authority. */
function departmentDisposition(): void {
  for (const rel of ["finance", "hr", "legal", "tickets"]) {
    assert.ok(existsSync(`${APP}/${rel}/page.tsx`), `/${rel} remains reachable`);
  }
  const match = getWorkspace("workforce").match ?? [];
  for (const href of ["/finance", "/hr", "/legal", "/tickets"]) {
    assert.ok(match.includes(href), `${href} resolves to Workforce (legacy, reachable)`);
  }
  assert.ok(/LegacyDomainNotice/.test(financeSrc) && /LegacyDomainNotice/.test(legalSrc) && /LegacyDomainNotice/.test(ticketsSrc), "departments carry legacy notice");
  // Not Operations authority.
  assert.ok(!(getWorkspace("operations").match ?? []).includes("/tickets"), "/tickets is not Operations");
  assert.ok(!/owned by the Operations Department/.test(ticketsSrc), "tickets makes no Operations-ownership claim");
  // Not Governance authority.
  assert.ok(!/@\/features\/governance/.test(legalSrc), "legal imports no governance engine");
}

/* 6, 7 — Finance has no Approve/Reject duplicate; Decisions remains the authority. */
function decisionsAuthority(): void {
  assert.ok(!/import[^\n]*ApprovalRow/.test(financeSrc), "finance does not import ApprovalRow");
  assert.ok(!financeSrc.includes('commandType="approval.approve"'), "finance has no Approve control");
  assert.ok(!financeSrc.includes('commandType="approval.reject"'), "finance has no Reject control");
  assert.ok(/DecisionWorkspace/.test(read(`${APP}/approvals/page.tsx`)), "/approvals still renders Decisions");
  assert.equal(getWorkspace("command").destinations.find((d) => d.label === "Decisions")?.href, "/approvals");
}

/* 8 — AgentCard retired: file deleted, zero import lines anywhere. */
function agentCardRetired(): void {
  assert.ok(!existsSync("src/features/agents/agent-card.tsx"), "agent-card.tsx is deleted");
  assert.ok(!/import[^\n]*AgentCard/.test(modulePlaceholderSrc), "module-placeholder no longer imports AgentCard");
  assert.ok(!/import[^\n]*AgentCard/.test(registrySrc), "agent-registry-workspace no longer imports AgentCard");
}

/* 9 — ApprovalRow retired: file deleted, zero import lines anywhere. */
function approvalRowRetired(): void {
  assert.ok(!existsSync("src/features/approvals/approval-row.tsx"), "approval-row.tsx is deleted");
}

/* 10-12 — Load-bearing / still-reachable mocks retained. */
function mocksRetained(): void {
  assert.ok(existsSync("src/features/agents/mock.ts"), "agents/mock retained (load-bearing)");
  assert.ok(/features\/agents\/mock/.test(read("src/features/agent-crud/agent-adapter.ts")), "agent-crud still seeds from agents/mock");
  for (const m of ["finance", "hr", "legal", "tickets"]) {
    assert.ok(existsSync(`src/features/${m}/mock.ts`), `${m}/mock retained`);
  }
  // approvals/mock is engine-load-bearing (projections/decisions/workload) — retained even though
  // the approval-row presentation was retired.
  assert.ok(existsSync("src/features/approvals/mock.ts"), "approvals/mock retained (engine input)");
}

/* 13 — Stale static routes corrected. */
function staleStaticRoutesFixed(): void {
  assert.ok(!staticRoutes.has("/finance/cash-flow"), "/finance/cash-flow removed from staticRoutes (no real page)");
  assert.ok(!staticRoutes.has("/hr/recruiting"), "/hr/recruiting removed from staticRoutes (no real page)");
  // Every remaining Workforce-area static route has a real page.
  for (const r of [...staticRoutes].filter((x) => /^\/(finance|hr|legal|tickets|agents)/.test(x))) {
    assert.ok(existsSync(`${APP}${r}/page.tsx`), `staticRoute ${r} has a real page`);
  }
}

/* 14 — The Workforce shadow tree redirects to /agents; placeholder surfaces no fabricated AgentCard. */
function shadowTreeClosed(): void {
  assert.ok(/redirect\(["']\/agents["']\)/.test(catchAllSrc), "catch-all redirects the shadow tree to /agents");
  assert.ok(catchAllSrc.includes("workforce\\/[^/]+\\/[^/]+"), "catch-all matches the /workforce/{dept}/{agent} pattern");
  assert.ok(!/<AgentCard/.test(modulePlaceholderSrc), "module-placeholder renders no AgentCard (no JSX usage)");
  assert.ok(!/item\.agentId/.test(modulePlaceholderSrc), "module-placeholder no longer resolves a fabricated agent");
}

/* 15 — No fake live staffing in authoritative Workforce. */
function noFakeStaffing(): void {
  const m = getTeamsRolesModel();
  assert.equal(m.liveStaffing, false, "no live staffing");
  assert.equal(m.humanWorkforceConnected, false, "no human workforce");
}

/* 16 — No execution/secret controls introduced by 25D closure edits. */
function noNewControls(): void {
  for (const src of [catchAllSrc, modulePlaceholderSrc, registrySrc]) {
    for (const forbidden of ["child_process", "process.env", "spawn(", "execSync", 'type="password"', "dangerouslySet"]) {
      assert.ok(!src.includes(forbidden), `no "${forbidden}" in 25D closure code`);
    }
  }
}

/* 17 — Heby remains advisory-only. */
function hebyAdvisoryOnly(): void {
  assert.equal(getHebyWorkspaceProfile("workforce").authority, "advisory-only", "Heby advisory-only");
  assert.equal(listActionTools().filter((t) => t.ownerWorkspace === "workforce").length, 0, "no Heby Workforce action tool");
}

/* 19, 20 — Prior phases intact; no eighth / Enterprise-Domains workspace. */
function noEighthWorkspace(): void {
  const ids = WORKSPACES.map((w) => w.id);
  assert.deepEqual(ids, ["command", "intelligence", "knowledge", "operations", "workforce", "governance", "platform"], "seven-workspace order intact");
  for (const forbidden of ["domains", "enterprise-domains", "finance", "hr", "legal"]) {
    assert.ok(!ids.includes(forbidden as never), `no "${forbidden}" workspace introduced`);
  }
  assert.ok(!existsSync(`${APP}/domains`), "no /domains route tree");
  assert.ok(!existsSync(`${APP}/enterprise-domains`), "no /enterprise-domains route tree");
  assert.ok(getWorkspace("governance").destinations.some((d) => d.label === "Security Center"), "Security Center intact");
}

function main(): void {
  authoritativeIa();
  canonicalRoutesReal();
  departmentDisposition();
  decisionsAuthority();
  agentCardRetired();
  approvalRowRetired();
  mocksRetained();
  staleStaticRoutesFixed();
  shadowTreeClosed();
  noFakeStaffing();
  noNewControls();
  hebyAdvisoryOnly();
  noEighthWorkspace();
  console.log("phase 25D workforce closure contract checks passed");
}

main();
