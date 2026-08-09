import assert from "node:assert/strict";
import {
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
} from "../../src/config/workspace-nav";

/*
 * Hebun UI Phase 20B — Command L2 navigation contract.
 *
 * Verifies the locked eight-surface Command IA (Phase 20A): Alerts merged into Inbox (D2),
 * Command Console → Director Intent (D1), Approvals & Decisions → Decisions (navigation-only),
 * seven workspaces preserved, and Security Center untouched.
 */

function sevenWorkspacesPreserved(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces — no eighth");
}

function commandFinalNav(): void {
  const command = getWorkspace("command");
  const labels = command.destinations.map((d) => d.label);
  assert.deepEqual(
    labels,
    [
      "Overview",
      "Inbox",
      "Briefings",
      "Decisions",
      "Strategic Goals",
      "Organization Health",
      "Reports",
      "Director Intent",
    ],
    "Command L2 is the locked eight-surface IA, in order",
  );
  assert.equal(command.destinations.length, 8, "exactly eight Command surfaces");
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

  assert.equal(byLabel("Inbox")?.href, "/command/inbox", "Inbox present at /command/inbox");
  assert.equal(byLabel("Briefings")?.href, "/command/briefings", "Briefings present");
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
  decisionsNotDuplicated();
  routesResolveToCommand();
  securityCenterPreserved();
  console.log("command L2 navigation contract checks passed");
}

main();
