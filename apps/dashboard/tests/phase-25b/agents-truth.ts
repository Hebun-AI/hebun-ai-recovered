import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getAgentsTruthModel } from "../../src/features/workforce/agents-truth-model";
import { getWorkforceWorkspaceModel } from "../../src/features/workforce/workspace-model";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";
import { activeProvider } from "../../src/features/persistence";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { listActionTools } from "../../src/features/heby-actions/action-registry";

/*
 * Hebun UI Phase 25B — Workforce Overview + Agents truth surface contract.
 *
 * Structural + read-model assertions (never brittle substring-on-prose): the authoritative
 * Agents surface presents seeded, in-memory DEFINITIONS with explicit provenance and never
 * seeded activity as live; the Overview stays honest/empty; Workforce absorbs no neighbouring
 * authority; Heby stays advisory-only; no execution/secret control is introduced; the
 * seven-workspace IA and departments are preserved (disposition is Phase 25C).
 */

const APP = "src/app/(dashboard)";
const read = (p: string): string => readFileSync(p, "utf8");

const pageSrc = read(`${APP}/agents/page.tsx`);
const surfaceSrc = read("src/components/agents/agents-truth-surface.tsx");
const modelSrc = read("src/features/workforce/agents-truth-model.ts");
const boundarySrc = read("src/components/workforce-workspace/workforce-boundary.tsx");

/* 1 — Workforce Overview remains honest / empty. */
function overviewHonest(): void {
  const model = getWorkforceWorkspaceModel();
  assert.equal(model.workers.length, 0, "Overview surfaces no workers");
  assert.ok(model.entityTypes.length > 0, "Overview keeps its entity-type information model");
  for (const type of model.entityTypes) {
    assert.equal(type.connected, 0, `${type.label} connects zero identities`);
  }
  const overviewPage = read(`${APP}/workforce/page.tsx`);
  assert.ok(/getWorkforceWorkspaceModel/.test(overviewPage), "Overview page builds the honest model");
  assert.ok(!/features\/agents\/mock/.test(overviewPage), "Overview imports no seeded roster");
}

/* 2 — Agents surface does not use the pulsing AgentCard live-activity presentation as truth. */
function noLiveActivityCard(): void {
  assert.ok(!/agents\/agent-card/.test(pageSrc), "agents page does not import AgentCard");
  assert.ok(!/agents\/agent-card/.test(surfaceSrc), "truth surface does not import AgentCard");
  // The in-memory CRUD registry is rendered. Its seeded-AgentCard grid was suppressed in 25B via
  // showCards={false} and then removed outright in 25D (AgentCard retired), so the surface simply
  // renders the registry with no fabricated card grid.
  assert.ok(/<AgentRegistryWorkspace/.test(surfaceSrc), "the in-memory CRUD registry is rendered without a fabricated card grid");
  // The four live-activity panels are gone from the authoritative surface.
  for (const panel of [
    "AgentContextPanel",
    "AgentReasoningPanel",
    "TaskPlanningPanel",
    "ExecutionQueuePanel",
  ]) {
    assert.ok(!new RegExp(panel).test(pageSrc), `agents page no longer renders ${panel}`);
    assert.ok(!new RegExp(panel).test(surfaceSrc), `truth surface does not render ${panel}`);
  }
  // The authoritative surface reads DEFINITIONS (agent-crud), not the simulated runtime projection.
  assert.ok(!/@\/features\/agent-runtime/.test(pageSrc), "agents page does not read the runtime projection");
  assert.ok(!/@\/features\/agent-runtime/.test(surfaceSrc), "truth surface does not read the runtime projection");
}

/* 3 — Seeded activity metrics are not surfaced as live truth.
 * Assert on real property ACCESS (`.tasksToday`), not bare words — honest prose that names a
 * field only to say it is never rendered must not trip the guard (STEP 16). */
function noSeededActivityAsLive(): void {
  for (const field of ["tasksToday", "costToday", "lastActive"]) {
    const access = new RegExp(`\\.${field}\\b`);
    assert.ok(!access.test(pageSrc), `agents page does not read .${field}`);
    assert.ok(!access.test(surfaceSrc), `truth surface does not read .${field}`);
  }
  // The read-model definition shape carries no live-activity field (structural).
  const [def] = getAgentsTruthModel().definitions;
  assert.ok(def, "at least one definition exists");
  for (const field of ["tasksToday", "costToday", "lastActive", "workload", "queue"]) {
    assert.ok(!(field in (def as unknown as Record<string, unknown>)), `definition view has no ${field}`);
  }
}

/* 4 — No pulsing online/running presentation. */
function noPulsingStatus(): void {
  assert.ok(!/\bpulse\b/.test(pageSrc), "agents page renders no pulsing indicator");
  assert.ok(!/\bpulse\b/.test(surfaceSrc), "truth surface renders no pulsing indicator");
}

/* 5 — Seeded roster provenance is explicit. */
function provenanceExplicit(): void {
  const model = getAgentsTruthModel();
  const classes = model.provenanceLegend.map((entry) => entry.provenance);
  for (const cls of ["structural", "seeded", "derived-from-seeded", "simulated", "unavailable"]) {
    assert.ok(classes.includes(cls as never), `legend documents provenance "${cls}"`);
  }
  assert.ok(model.seededDefinitionCount > 0, "seeded definition count is read structurally");
  assert.ok(/seeded/.test(pageSrc), "agents page frames the count as seeded, not registered-live");
  assert.ok(!/digital employees registered/.test(pageSrc), "old 'digital employees registered' framing is gone");
}

/* 6 — Active persistence provider is memory. */
function persistenceIsMemory(): void {
  assert.equal(activeProvider(), "memory", "live persistence provider is memory");
  assert.equal(getAgentsTruthModel().persistenceProvider, "memory", "model reads the memory provider");
}

/* 7 — Durable DB persistence is not claimed. */
function noDurableClaim(): void {
  const model = getAgentsTruthModel();
  assert.equal(model.durablePersistence, false, "durable persistence is not claimed");
  const durable = model.executionLadder.find((s) => s.key === "persisted-durable");
  assert.ok(durable && durable.state === "not-reached", "durable-persistence rung is not reached");
}

/* 8 — Runtime is simulation. */
function runtimeIsSimulation(): void {
  assert.equal(getAgentsTruthModel().runtimeMode, "simulation", "runtime mode is simulation");
}

/* 9 — Agent definition ≠ runtime execution. */
function definitionIsNotExecution(): void {
  const ladder = getAgentsTruthModel().executionLadder;
  const defined = ladder.find((s) => s.key === "defined");
  const executed = ladder.find((s) => s.key === "executed");
  assert.ok(defined && defined.state === "reached", "definitions exist (defined reached)");
  assert.ok(executed && executed.state === "not-reached", "nothing is executed");
}

/* 10 & 11 — No live provider invocation, no Computer Use. */
function noLiveProviderNoComputerUse(): void {
  const model = getAgentsTruthModel();
  assert.equal(model.liveProviderInvocation, false, "no live provider invocation claimed");
  assert.equal(model.computerUseAvailable, false, "no Computer Use claimed");
  assert.equal(model.liveExecutionAvailable, false, "no live execution claimed");
  const connected = model.executionLadder.find((s) => s.key === "connected");
  assert.ok(connected && connected.state === "not-reached", "no provider is connected");
}

/* 12-15 — Workforce does not absorb Operations / Governance / Platform / Decisions (nor Knowledge). */
function noAbsorption(): void {
  // The authoritative Agents surface introduces no execution / approval / policy / provider control.
  for (const forbidden of [
    "approval.approve",
    "approval.reject",
    "dispatchCommand",
    "grant-permission",
    "modify-policy",
    "execute(",
  ]) {
    assert.ok(!surfaceSrc.includes(forbidden), `truth surface has no "${forbidden}" control`);
  }
  // The Overview boundary explicitly defers to the owning workspaces (no duplication).
  for (const href of ["/operations", "/governance", "/platform", "/knowledge", "/approvals"]) {
    assert.ok(boundarySrc.includes(href), `Workforce boundary defers to ${href}`);
  }
  assert.ok(/who/i.test(boundarySrc), "boundary states Workforce = who can perform work");
}

/* 16 — Heby remains advisory-only and cannot manage agents. */
function hebyAdvisoryOnly(): void {
  const profile = getHebyWorkspaceProfile("workforce");
  assert.equal(profile.authority, "advisory-only", "Heby Workforce authority is advisory-only");
  for (const cap of profile.capabilities) {
    assert.equal(cap.state, "contract-only", "Heby Workforce capabilities are contract-only");
  }
  const workforceOwned = listActionTools().filter((t) => t.ownerWorkspace === "workforce");
  assert.equal(workforceOwned.length, 0, "no Heby action tool is owned by Workforce (cannot manage agents)");
}

/* 17 — No secret/execution controls introduced. Code-only tokens (never honest prose). */
function noSecretsNoExecution(): void {
  for (const src of [pageSrc, surfaceSrc, modelSrc]) {
    for (const forbidden of [
      "child_process",
      "process.env",
      "spawn(",
      "execSync",
      "fetch(",
      'type="password"',
      "dangerouslySet",
    ]) {
      assert.ok(!src.includes(forbidden), `no "${forbidden}" in Phase 25B code`);
    }
  }
}

/* 18 & 19 — Phase 20-24 surfaces and the seven-workspace IA remain intact. */
function sevenWorkspaceIaIntact(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces");
  assert.deepEqual(
    WORKSPACES.map((w) => w.id),
    ["command", "intelligence", "knowledge", "operations", "workforce", "governance", "platform"],
    "seven-workspace order intact",
  );
  // Phase 20 + 23 spot checks (unaffected by 25B).
  assert.equal(getWorkspace("command").destinations.find((d) => d.label === "Decisions")?.href, "/approvals");
  assert.ok(getWorkspace("governance").destinations.some((d) => d.label === "Security Center"), "Security Center intact");
  // 25B established Overview + Agents as the authoritative truth surfaces. The full Workforce L2
  // set is a moving target owned by the Phase 25C test (25C locked it to four surfaces and
  // relocated the department applications), so this test pins only the invariants 25B owns.
  const workforceLabels = getWorkspace("workforce").destinations.map((d) => d.label);
  assert.ok(workforceLabels.includes("Overview") && workforceLabels.includes("Agents"), "Workforce keeps Overview + Agents");
  assert.equal(getWorkspace("workforce").destinations.find((d) => d.label === "Agents")?.href, "/agents");
}

/* 20 — Route/shadow behaviour is not worsened; no fake authoritative surfaces invented. */
function routesNotWorsened(): void {
  assert.ok(existsSync(`${APP}/agents/page.tsx`), "/agents page exists");
  assert.ok(existsSync(`${APP}/workforce/page.tsx`), "/workforce page exists");
  // (Teams & Roles + Capabilities pages are built for real in Phase 25C; their existence and
  // shadow-safety are asserted by the Phase 25C test, not here.)
  // staticRoutes still knows /agents (regression guard).
  assert.ok(/"\/agents"/.test(read("src/config/sidebar.config.ts")), "staticRoutes still lists /agents");
}

function main(): void {
  overviewHonest();
  noLiveActivityCard();
  noSeededActivityAsLive();
  noPulsingStatus();
  provenanceExplicit();
  persistenceIsMemory();
  noDurableClaim();
  runtimeIsSimulation();
  definitionIsNotExecution();
  noLiveProviderNoComputerUse();
  noAbsorption();
  hebyAdvisoryOnly();
  noSecretsNoExecution();
  sevenWorkspaceIaIntact();
  routesNotWorsened();
  console.log("phase 25B workforce overview + agents truth-surface contract checks passed");
}

main();
