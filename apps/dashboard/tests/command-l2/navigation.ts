import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
} from "../../src/config/workspace-nav";

/*
 * Hebun UI Phase 20B — Command L2 navigation contract, AMENDED BY CMD-B2.
 *
 * Phase 20B locked eight surfaces here and this file was their pin. CMD-B2 reduced the canonical
 * menu to three — Overview, Decisions, Director Intent — and kept all five removed routes alive.
 * The Phase 20B properties that were never about the COUNT are unchanged and still asserted:
 * Alerts stays merged (no standalone "Alerts"), Command Console stays renamed, Decisions is
 * navigation-only into `/approvals` and is never duplicated, seven workspaces, Security Center in
 * Governance.
 *
 * What this file no longer says is "eight". It says three, and it says the other five still resolve
 * under Command — because a route existing and a route being canonical are different claims, and
 * this file is the pin for the second one.
 */

function sevenWorkspacesPreserved(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces — no eighth");
}

function commandFinalNav(): void {
  const command = getWorkspace("command");
  const labels = command.destinations.map((d) => d.label);
  assert.deepEqual(
    labels,
    ["Overview", "Decisions", "Director Intent"],
    "Command L2 is the canonical three, in order (CMD-B2)",
  );
  assert.equal(command.destinations.length, 3, "exactly three canonical Command destinations");
}

function removedSurfaces(): void {
  const command = getWorkspace("command");
  const labels = command.destinations.map((d) => d.label);
  assert.ok(!labels.includes("Alerts"), "standalone Alerts removed (merged into Inbox)");
  assert.ok(!labels.includes("Command Console"), "Command Console removed (renamed Director Intent)");
  assert.ok(!labels.includes("Approvals & Decisions"), "old 'Approvals & Decisions' label removed");
}

function keySurfacesPresent(): void {
  const command = getWorkspace("command");
  const byLabel = (l: string) => command.destinations.find((d) => d.label === l);

  assert.equal(byLabel("Overview")?.href, "/command", "Overview is the Command landing");
  assert.equal(byLabel("Director Intent")?.href, "/command/intent", "Director Intent present");
  assert.equal(
    byLabel("Decisions")?.href,
    "/approvals",
    "Decisions navigates to the authoritative /approvals surface (not a second system)",
  );

  // Every retained Command surface has a real, working route — no `unavailable` placeholders remain.
  for (const d of command.destinations) {
    assert.ok(d.href && !d.unavailable, `${d.label} has a real route`);
  }
}

function decisionsNotDuplicated(): void {
  const command = getWorkspace("command");
  const decisions = command.destinations.filter((d) => d.label === "Decisions");
  assert.equal(decisions.length, 1, "exactly one Decisions entry");
  assert.equal(decisions[0].href, "/approvals", "and it is navigation-only into /approvals");
  // Command owns no /command/decisions or /director/decisions route of its own.
  assert.ok(
    !command.destinations.some((d) => d.href && /decision/i.test(d.href)),
    "Command declares no second decision route",
  );
}

/*
 * CMD-B2 — the five left the MENU, not the product. Asserted here as well as in the CMD-B2 suite,
 * because this file is where a future phase will look for "what is Command's L2", and it must find
 * the removal and the survival in the same place.
 */
function removedFromMenuButNotFromTheProduct(): void {
  const labels = getWorkspace("command").destinations.map((d) => d.label);
  for (const gone of ["Inbox", "Briefings", "Strategic Goals", "Organization Health", "Reports"]) {
    assert.ok(!labels.includes(gone), `${gone} is not a canonical Command destination`);
  }
  for (const route of [
    "/command/inbox",
    "/command/briefings",
    "/director/goals",
    "/director/organization-health",
    "/director/reports",
  ]) {
    const page = `src/app/(dashboard)${route}/page.tsx`;
    assert.ok(existsSync(path.join(process.cwd(), page)), `${route} still exists on disk (${page})`);
    assert.equal(resolveActiveWorkspace(route), "command", `${route} still belongs to Command`);
  }
}

function routesResolveToCommand(): void {
  for (const route of [
    "/command",
    "/command/inbox",
    "/command/briefings",
    "/command/intent",
    "/director/goals",
    "/director/organization-health",
    "/director/reports",
  ]) {
    assert.equal(resolveActiveWorkspace(route), "command", `${route} resolves to Command`);
  }
  assert.equal(resolveActiveWorkspace("/approvals"), "command", "Decisions route resolves under Command");
}

function securityCenterPreserved(): void {
  const gov = getWorkspace("governance");
  const sec = gov.destinations.find((d) => d.href === "/director/governance/security");
  assert.ok(sec, "Security Center is still a Governance destination");
  assert.equal(sec!.label, "Security Center", "Security Center label intact");
  assert.equal(
    resolveActiveWorkspace("/director/governance/security"),
    "governance",
    "Security Center route still belongs to Governance",
  );
}

function main(): void {
  sevenWorkspacesPreserved();
  commandFinalNav();
  removedSurfaces();
  keySurfacesPresent();
  removedFromMenuButNotFromTheProduct();
  decisionsNotDuplicated();
  routesResolveToCommand();
  securityCenterPreserved();
  console.log("command L2 navigation contract checks passed (CMD-B2 canonical three)");
}

main();
