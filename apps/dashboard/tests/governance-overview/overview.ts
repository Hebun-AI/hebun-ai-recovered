import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getGovernanceOverviewModel } from "../../src/features/governance-overview";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";

/*
 * Governance Overview honesty (Hebun UI Phase 23B).
 *
 * Honest availability map with authority owner + mutation boundary per area; no fabricated
 * compliance/health/risk % or policy/approval count; Security Center authoritative; human
 * decisions external (Decisions); execution gate not falsely connected; Heby restricted.
 */

const STATUSES = new Set(["authoritative-real", "derived-seeded", "not-connected", "external-authority", "restricted"]);

function availabilityIsHonest(): void {
  const model = getGovernanceOverviewModel();
  assert.ok(model.availability.length >= 6, "the availability map is shown");
  for (const area of model.availability) {
    assert.ok(STATUSES.has(area.status), `${area.area} uses an honest status (${area.status})`);
    assert.equal(area.canMutate, false, `${area.area} cannot mutate anything`);
    assert.ok(!/\d+\s*%/.test(area.detail), `${area.area} states no fabricated percentage`);
    assert.ok(!/\b\d+\s+(policies|policy|violations?|approvals?|incidents?)\b/i.test(area.detail), `${area.area} states no fabricated count`);
  }
  const byArea = (a: string) => model.availability.find((x) => x.area === a);
  assert.equal(byArea("Policies & Rules")?.status, "derived-seeded");
  assert.equal(byArea("Security Center")?.status, "authoritative-real");
  assert.equal(byArea("Security Center")?.href, "/director/governance/security");
  assert.equal(byArea("Human decisions")?.status, "external-authority");
  assert.equal(byArea("Human decisions")?.href, "/approvals");
  assert.equal(byArea("Human decisions")?.authorityOwner, "Decisions");
  assert.equal(byArea("Execution governance gate")?.status, "not-connected", "execution governance gate is not falsely connected");
  assert.equal(byArea("Heby Governance")?.status, "restricted");
}

function pageIsMockFreeAndHasNoControls(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "governance", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.some((t) => t === "@/features/governance" || t.startsWith("@/features/governance/")), "Overview imports no governance mock");
  assert.ok(imports.some((t) => t.includes("governance-overview")), "Overview renders the truth surface");
  const component = readFileSync(join(process.cwd(), "src", "components", "governance-overview", "governance-overview.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "Approve", "Reject", "Authorize", "Ratify", "Enforce", "Execute"]) {
    assert.ok(!component.includes(banned), `Overview exposes no control (${banned})`);
  }
}

function navAndRoutesIntact(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const gov = getWorkspace("governance");
  assert.deepEqual(
    gov.destinations.map((d) => d.label),
    ["Overview", "Policies & Rules", "Compliance & Risk", "Audit & Explainability", "Security Center"],
    "Governance L2 = the final five authoritative surfaces (Phase 23C)",
  );
  assert.ok(gov.destinations.some((d) => d.href === "/director/governance/security"), "Security Center preserved");
  // No catch-all shadow for the authoritative governance routes.
  const shadowed = placeholderPaths();
  for (const route of ["/governance", "/director/governance/policies", "/director/governance/security"]) {
    assert.ok(!shadowed.includes(route), `${route} is not a placeholder`);
    assert.equal(resolveActiveWorkspace(route), "governance", `${route} resolves to Governance`);
  }
  assert.ok(staticRoutes.has("/director/governance/policies"), "policies route registered in staticRoutes");
}

function main(): void {
  availabilityIsHonest();
  pageIsMockFreeAndHasNoControls();
  navAndRoutesIntact();
  console.log("governance-overview honesty checks passed");
}

main();
