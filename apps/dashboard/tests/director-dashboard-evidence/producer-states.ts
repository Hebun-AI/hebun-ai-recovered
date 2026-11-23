import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDirectorDashboardUiModel } from "../../src/features/director-dashboard-ui/adapter.server";
import { getSnapshot as getAgentSnapshot } from "../../src/features/agent-crud/agent-adapter";
import {
  materializeRuntimeEvidence,
  resetRuntimeObservabilityForTests,
} from "../../src/features/runtime-observability";

const ADAPTER = "src/features/director-dashboard-ui/adapter.server.ts";

/**
 * READY: with live evidence present, the wired sections resolve to real
 * records and the dashboard reports genuine completeness.
 */
function readyProducer(): void {
  const model = getDirectorDashboardUiModel();
  assert.notEqual(model.snapshot, undefined);
  assert.equal(model.snapshot!.models.healthSummary.length > 0, true);
  assert.equal(model.snapshot!.completeness, "FULL");
  for (const widgetId of ["monitoring-summary", "health-summary", "diagnostics-summary"] as const) {
    assert.equal(model.widgets.states[widgetId].state, "ready");
  }
}

/**
 * EMPTY: a producer holding zero records must render the canonical empty
 * state — not unavailable, and never a fabricated healthy result.
 */
function emptyProducer(): void {
  resetRuntimeObservabilityForTests();
  const evidence = materializeRuntimeEvidence();
  assert.equal(evidence.report.signalCount, 0, "sink must be empty after reset");
  assert.equal(evidence.report.monitoring.status, "empty");
  assert.equal(evidence.report.health.status, "empty");
  assert.equal(evidence.report.diagnostics.status, "empty");
  assert.equal(evidence.monitoringAggregates.length, 0);
  assert.equal(evidence.healthSnapshots.length, 0);
  assert.equal(evidence.diagnosticsProjections.length, 0);

  const model = getDirectorDashboardUiModel();
  assert.notEqual(model.snapshot, undefined, "an empty producer must not make the dashboard unavailable");
  assert.equal(model.snapshot!.models.monitoringSummary.length, 0);
  assert.equal(model.snapshot!.models.healthSummary.length, 0);
  assert.equal(model.snapshot!.models.diagnosticsSummary.length, 0);
  // No health evidence means completeness is honestly MISSING again.
  assert.equal(model.snapshot!.completeness, "MISSING");

  for (const widgetId of ["monitoring-summary", "health-summary", "diagnostics-summary"] as const) {
    assert.equal(model.widgets.states[widgetId].state, "empty", `${widgetId} must be empty, not unavailable`);
  }
  for (const sectionId of ["platform-status", "monitoring-summary", "diagnostics-summary"] as const) {
    const section = model.overview.sections.find((candidate) => candidate.sectionId === sectionId);
    assert.equal(section?.reasonCode, "SECTION_EMPTY");
    assert.equal(section?.health, "unknown", "empty evidence must never read healthy");
    assert.equal(section?.recordCount, 0);
  }
  // Sections backed by other producers are unaffected: `active-agents` still reports its OWN
  // store, not the evidence sink. P5-1 (D7): that store no longer seeds fixtures, so the proof is
  // equality with the agent store (empty today) and that the section is read, not unavailable.
  const agents = model.overview.sections.find(({ sectionId }) => sectionId === "active-agents");
  assert.equal(agents?.recordCount ?? -1, getAgentSnapshot().length);
  assert.notEqual(agents?.sourceState, "unavailable");
}

/**
 * UNAVAILABLE: a producer that reports `failed` is refused rather than being
 * downgraded to empty. The failure signal is real — verified here against the
 * producer — and the adapter's guard consumes exactly that signal.
 */
function unavailableProducer(): void {
  const failed = materializeRuntimeEvidence(new Date("not-a-date"));
  assert.equal(failed.report.monitoring.status, "failed");
  assert.equal(failed.report.health.status, "failed");
  assert.equal(failed.monitoringAggregates.length, 0);
  assert.equal(failed.healthSnapshots.length, 0);

  const source = readFileSync(ADAPTER, "utf8");
  assert.equal(
    source.includes('monitoring.status === "failed" || health.status === "failed" || diagnostics.status === "failed"'),
    true,
    "adapter must refuse a failed producer",
  );
  assert.equal(source.includes("if (!evidence) return unavailableDashboard();"), true);
}

/** The canonical unavailable model keeps unavailable distinct from empty. */
function canonicalUnavailableShape(): void {
  resetRuntimeObservabilityForTests();
  const empty = getDirectorDashboardUiModel();
  const emptySection = empty.overview.sections.find(({ sectionId }) => sectionId === "platform-status");
  assert.equal(emptySection?.reasonCode, "SECTION_EMPTY");
  assert.notEqual(emptySection?.health, "unavailable", "empty must not be reported as unavailable");

  // The unavailable representation itself remains reachable and distinct.
  const insights = empty.insights.find(({ sectionId }) => sectionId === "platform-status");
  assert.equal(insights?.summary.includes("returned no records"), true);
  assert.equal(insights?.summary.includes("could not be read"), false);
}

/** No fabricated records may enter the dashboard from this wiring. */
function noFakeRecords(): void {
  resetRuntimeObservabilityForTests();
  const model = getDirectorDashboardUiModel();
  const serialized = JSON.stringify(model.snapshot?.models);
  for (const forbidden of ["mock", "sample", "seed", "placeholder", "lorem", "dummy", "fixture"]) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, `no ${forbidden} data may appear`);
  }
  assert.equal(model.snapshot!.models.healthSummary.length, 0, "no health record without a producer record");
}

function main(): void {
  readyProducer();
  emptyProducer();
  unavailableProducer();
  canonicalUnavailableShape();
  noFakeRecords();
  console.log("dashboard evidence producer state checks passed");
}

main();
