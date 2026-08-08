import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isHebyCapability } from "../../src/features/heby-core";
import {
  HEBY_AUTHORITY_DESCRIPTORS,
  HEBY_AUTHORITY_MODES,
  HEBY_CAPABILITY_FAMILIES,
  HEBY_CAPABILITY_STATE_DESCRIPTORS,
  HEBY_CAPABILITY_STATES,
  HEBY_INTENT_CAPABILITY,
  HEBY_INTENT_DESCRIPTORS,
  HEBY_NAV_WORKSPACE_IDS,
  HEBY_PRODUCT_INTENTS,
  HEBY_REQUIRED_PROVENANCE_FACETS,
  HEBY_SOURCE_CLASSES,
  HEBY_UNCERTAINTY_DESCRIPTORS,
  HEBY_UNCERTAINTY_STATES,
  HEBY_WORKSPACE_IDS,
  isHebyWorkspaceId,
} from "../../src/features/heby-integration/contracts";
import {
  HEBY_FUTURE_DEVICE_BOUNDARY,
  HEBY_FUTURE_TOOL_BOUNDARY,
} from "../../src/features/heby-integration/future-boundaries";
import {
  buildHebyRequest,
  notConnectedResponse,
} from "../../src/features/heby-integration/request-response";
import {
  getHebyWorkspaceProfile,
  resolveHebyWorkspaceContext,
} from "../../src/features/heby-integration/workspace-registry";
import { buildHebyPanelModel, resolveHebyWorkspace } from "../../src/features/heby-integration/panel-model";

/* --- IA preserved: 7 nav workspaces + "decisions" context identity, no 8th nav ------ */
function informationArchitecturePreserved(): void {
  assert.equal(HEBY_NAV_WORKSPACE_IDS.length, 7, "exactly seven navigable workspaces");
  assert.equal(HEBY_NAV_WORKSPACE_IDS.includes("decisions" as never), false, "decisions is not a nav workspace");
  assert.equal(HEBY_WORKSPACE_IDS.length, 8, "eight Heby context identities");
  assert.equal(HEBY_WORKSPACE_IDS.includes("decisions"), true, "decisions is a context identity");
  assert.equal(isHebyWorkspaceId("command"), true);
  assert.equal(isHebyWorkspaceId("nonsense"), false);
}

/* --- Intent vocabulary is small, stable, and maps to REAL Heby Core capabilities ---- */
function intentVocabularyBindsToRealCapabilities(): void {
  assert.equal(HEBY_PRODUCT_INTENTS.length, 8, "a small, stable intent vocabulary");
  for (const intent of HEBY_PRODUCT_INTENTS) {
    const capability = HEBY_INTENT_CAPABILITY[intent];
    assert.equal(isHebyCapability(capability), true, `${intent} maps to a real Heby capability`);
    assert.equal(HEBY_INTENT_DESCRIPTORS[intent].capability, capability, "descriptor matches mapping");
  }
  // Only preparation intents may prepare-for-human; they never resolve a decision.
  assert.equal(HEBY_INTENT_DESCRIPTORS.PREPARE_RECOMMENDATION.prepares, true);
  assert.equal(HEBY_INTENT_DESCRIPTORS.PREPARE_REVIEW.prepares, true);
  assert.equal(HEBY_INTENT_DESCRIPTORS.EXPLAIN.prepares, false);
}

/* --- Capability states: four honest states, only "available" is usable -------------- */
function capabilityStatesAreHonest(): void {
  assert.equal(HEBY_CAPABILITY_STATES.length, 4);
  assert.equal(HEBY_CAPABILITY_STATE_DESCRIPTORS.available.usable, true);
  for (const state of HEBY_CAPABILITY_STATES) {
    if (state === "available") continue;
    assert.equal(HEBY_CAPABILITY_STATE_DESCRIPTORS[state].usable, false, `${state} is not usable`);
  }
  assert.equal(HEBY_CAPABILITY_FAMILIES.length, 10);
}

/* --- Source status is multi-dimensional; a defined-but-unconnected source is honest -- */
function sourceStatusNotCollapsed(): void {
  assert.equal(HEBY_SOURCE_CLASSES.length, 8);
  const context = resolveHebyWorkspaceContext({ workspace: "knowledge" });
  for (const source of context.sources) {
    assert.equal(source.unavailable, true, "no source is connected to Heby in Phase 15");
  }
}

/* --- Uncertainty is ordinal/semantic, never a fabricated percentage ----------------- */
function uncertaintyIsOrdinal(): void {
  assert.equal(HEBY_UNCERTAINTY_STATES.length, 5);
  const orders = HEBY_UNCERTAINTY_STATES.map((s) => HEBY_UNCERTAINTY_DESCRIPTORS[s].order);
  assert.deepEqual(orders, [0, 1, 2, 3, 4], "strongest → weakest ordinal");
}

/* --- Authority: Heby may NEVER act itself, in any mode ------------------------------- */
function hebyNeverActs(): void {
  assert.equal(HEBY_AUTHORITY_MODES.length, 5);
  for (const mode of HEBY_AUTHORITY_MODES) {
    assert.equal(HEBY_AUTHORITY_DESCRIPTORS[mode].hebyMayAct, false, `${mode}: Heby may not act`);
  }
}

/* --- Registry covers all identities; nothing is usable in Phase 15 ------------------- */
function registryCoversAllWorkspacesHonestly(): void {
  for (const workspace of HEBY_WORKSPACE_IDS) {
    const profile = getHebyWorkspaceProfile(workspace);
    assert.ok(profile.label.length > 0, `${workspace} has a label`);
    const context = resolveHebyWorkspaceContext({ workspace });
    for (const capability of context.capabilities) {
      const descriptor = HEBY_CAPABILITY_STATE_DESCRIPTORS[
        capability.state as keyof typeof HEBY_CAPABILITY_STATE_DESCRIPTORS
      ];
      assert.equal(descriptor.usable, false, `${workspace}/${capability.family} is not usable in Phase 15`);
    }
  }
  // Decisions is bounded to human review; Heby prepares, never resolves.
  assert.equal(resolveHebyWorkspaceContext({ workspace: "decisions" }).authority, "human-review-required");
}

/* --- Route → Heby workspace mapping: /approvals is the decisions surface ------------- */
function routeMappingIsDeterministic(): void {
  assert.equal(resolveHebyWorkspace("/approvals"), "decisions");
  assert.equal(resolveHebyWorkspace("/approvals/anything"), "decisions");
  assert.equal(resolveHebyWorkspace("/operations"), "operations");
  assert.equal(resolveHebyWorkspace("/governance"), "governance");
}

/* --- Request/response: no persisted id abuse; response is honest not-connected ------- */
function responseIsNotConnected(): void {
  const context = resolveHebyWorkspaceContext({ workspace: "operations" });
  const request = buildHebyRequest({ intent: "EXPLAIN", workspaceContext: context });
  assert.equal(request.provenanceRequirements, HEBY_REQUIRED_PROVENANCE_FACETS);
  assert.equal(request.authorityContext, "advisory-only");
  const response = notConnectedResponse(request);
  assert.equal(response.connectionState, "not-connected");
  assert.equal(response.summary, undefined, "no fabricated summary");
  assert.equal(response.evidence.length, 0, "no fabricated evidence");
  assert.equal(response.recommendations.length, 0, "no fabricated recommendation");
  assert.equal(response.uncertainty, "unavailable");
  assert.equal(response.prepared, false);
}

/* --- Panel model is honest and exposes no answer ------------------------------------ */
function panelModelIsHonest(): void {
  const model = buildHebyPanelModel({
    pathname: "/approvals",
    region: { key: "decision-state-strip", label: "Decision state" },
    intent: "ASSESS_UNCERTAINTY",
  });
  assert.equal(model.workspaceLabel, "Decisions");
  assert.equal(model.regionLabel, "Decision state");
  assert.equal(model.connectionState, "not-connected");
  assert.ok(model.responseLimitations.length > 0, "the not-connected state is stated");
  assert.ok(model.mayExplain.length > 0, "structural 'may explain' copy is present");
  for (const capability of model.capabilities) {
    assert.equal(capability.usable, false, "no capability is usable in the panel");
  }
}

/* --- Future boundaries are declared but NOT implemented ------------------------------ */
function futureBoundariesUnimplemented(): void {
  assert.equal(HEBY_FUTURE_TOOL_BOUNDARY.implemented, false, "no tool runtime");
  assert.equal(HEBY_FUTURE_DEVICE_BOUNDARY.implemented, false, "no device runtime");
  assert.equal(HEBY_FUTURE_DEVICE_BOUNDARY.ownedBy, "platform", "device runtime is Platform-owned");
}

/* --- No model/provider/tool/execution coupling anywhere in the feature -------------- */
function noModelOrProviderCoupling(): void {
  const dir = "src/features/heby-integration";
  const forbidden = [
    "openai",
    "anthropic",
    "@google/generative",
    "generativeai",
    "mistral",
    "cohere",
    "ollama",
    "provider-routing",
    "fetch(",
    "child_process",
    "execSync",
  ];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(dir, file), "utf8").toLowerCase();
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference "${token}"`);
    }
  }
}

informationArchitecturePreserved();
intentVocabularyBindsToRealCapabilities();
capabilityStatesAreHonest();
sourceStatusNotCollapsed();
uncertaintyIsOrdinal();
hebyNeverActs();
registryCoversAllWorkspacesHonestly();
routeMappingIsDeterministic();
responseIsNotConnected();
panelModelIsHonest();
futureBoundariesUnimplemented();
noModelOrProviderCoupling();

console.log("heby-integration contract checks passed");
