import assert from "node:assert/strict";
import {
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
} from "../../src/config/workspace-nav";

/*
 * Hebun UI Phase 20C — Intelligence L2 navigation contract.
 *
 * Verifies the locked six-surface Intelligence IA (Phase 20A): standalone Patterns removed (D3),
 * seven workspaces preserved, the Phase 20B Command IA preserved, and Security Center untouched.
 */

function sevenWorkspacesPreserved(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces — no eighth");
}

function intelligenceFinalNav(): void {
  const intel = getWorkspace("intelligence");
  const labels = intel.destinations.map((d) => d.label);
  assert.deepEqual(
    labels,
    [
      "Overview",
      "Signals & Assessments",
      "Candidates",
      "Insights",
      "Readiness & Pathways",
      "Recommendations",
      /*
       * SOC-UI1 amended this list from six to seven, under SOC-0's approval. The six above keep
       * their identity, their order and their lifecycle meaning; Social Intelligence is appended
       * because it is a new SOURCE of intelligence rather than a new stage of the existing cycle.
       */
      "Social Intelligence",
    ],
    "Intelligence L2 is the locked seven-surface IA — six in lifecycle order, then SOC-UI1",
  );
  assert.equal(intel.destinations.length, 7, "exactly seven Intelligence surfaces");
}

function patternsRemoved(): void {
  const intel = getWorkspace("intelligence");
  assert.ok(!intel.destinations.some((d) => d.label === "Patterns"), "standalone Patterns removed");
  assert.ok(
    !intel.destinations.some((d) => d.href && d.href.includes("/patterns")),
    "authoritative Intelligence nav routes nowhere near /patterns",
  );
}

function retainedSurfacesPresent(): void {
  const intel = getWorkspace("intelligence");
  const byLabel = (l: string) => intel.destinations.find((d) => d.label === l);
  assert.equal(byLabel("Overview")?.href, "/intelligence", "Overview retained");
  assert.equal(byLabel("Signals & Assessments")?.href, "/intelligence/signals");
  assert.equal(byLabel("Candidates")?.href, "/intelligence/candidates");
  assert.equal(byLabel("Insights")?.href, "/director/intelligence/insights");
  assert.equal(byLabel("Readiness & Pathways")?.href, "/intelligence/evolution");
  assert.equal(byLabel("Recommendations")?.href, "/director/intelligence/recommendations");
  assert.equal(byLabel("Social Intelligence")?.href, "/intelligence/social", "SOC-0's approved route");
  // Every retained Intelligence surface has a real, working route — no `unavailable` placeholders.
  for (const d of intel.destinations) {
    assert.ok(d.href && !d.unavailable, `${d.label} has a real route`);
  }
}

function routesResolveToIntelligence(): void {
  for (const route of [
    "/intelligence",
    "/intelligence/signals",
    "/intelligence/candidates",
    "/intelligence/evolution",
    "/director/intelligence/insights",
    "/director/intelligence/recommendations",
    "/intelligence/social",
  ]) {
    assert.equal(resolveActiveWorkspace(route), "intelligence", `${route} resolves to Intelligence`);
  }
}

/*
 * The point of this check is that the Intelligence phase did not reach into Command's menu. CMD-B2
 * did — deliberately, and it is the only phase authorized to — so the expected value moved from the
 * Phase 20B eight to the canonical three. The Alerts property is Phase 20B's and is untouched.
 */
function commandNavUndisturbedByIntelligence(): void {
  const command = getWorkspace("command");
  const labels = command.destinations.map((d) => d.label);
  assert.deepEqual(
    labels,
    /* L4 added Live Map as a fourth canonical Command destination; the list stays exhaustive. */
    ["Overview", "Decisions", "Director Intent", "Live Map"],
    "Command canonical L2 is untouched by Intelligence",
  );
  assert.ok(!labels.includes("Alerts"), "Command Alerts still merged into Inbox");
}

function securityCenterPreserved(): void {
  const gov = getWorkspace("governance");
  const sec = gov.destinations.find((d) => d.href === "/director/governance/security");
  assert.ok(sec && sec.label === "Security Center", "Security Center preserved in Governance");
  assert.equal(resolveActiveWorkspace("/director/governance/security"), "governance");
}

function main(): void {
  sevenWorkspacesPreserved();
  intelligenceFinalNav();
  patternsRemoved();
  retainedSurfacesPresent();
  routesResolveToIntelligence();
  commandNavUndisturbedByIntelligence();
  securityCenterPreserved();
  console.log("intelligence L2 navigation contract checks passed");
}

main();
