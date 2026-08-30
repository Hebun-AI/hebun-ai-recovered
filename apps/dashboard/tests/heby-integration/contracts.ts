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
  /*
   * Fourteen since E2-6 added `recorded-acts` (thirteen after E2-5's `agents`, twelve after E2-1's
   * `organization`, eleven after INT-5A's
   * `integrations`, ten after R3R's `external-recipients`, nine after R3W's `work-artifacts`). The list is
   * pinned rather than pattern-matched so a new source class cannot appear without somebody
   * stating it here — which is exactly the review this assertion exists to force. The classes
   * themselves are named so the diff says WHICH one arrived, not merely that the number moved.
   *
   * `external-recipients` is the one class where a fabricated item would be a real person's
   * address, so it earns the review more than most.
   */
  assert.deepEqual(
    [...HEBY_SOURCE_CLASSES],
    [
      "knowledge",
      "memory",
      "intelligence",
      "operations",
      "workforce",
      "governance",
      "platform",
      "decision-records",
      "work-artifacts",
      "external-recipients",
      /*
       * INT-5A. It reports what CAN BE READ from a connected system, never what is inside one — a
       * capability state, never a provider record. A fabricated item here would tell a Director a
       * system is usable when it is not, which is why the class earns this review.
       */
      "integrations",
      /*
       * E2-1. The organization this tenant IS — identity, never arrangement.
       *
       * It earns the review for the opposite reason `integrations` does. A fabricated item here
       * would not overstate a system's usability; it would answer "which organization am I in?"
       * with something nobody owns. And the class must stay narrow in a specific direction: it may
       * carry the Organization Authority's own statement that internal structure has no owner, and
       * it may never carry a department, a team, a reporting line or a member roster, because L3
       * measured that no authority for any of them exists.
       *
       *     ORGANIZATION IDENTITY != ORGANIZATION STRUCTURE
       */
      "organization",
      /*
       * E2-5. The durable agents this organization established, and what became of what each
       * proposed — E2-3's Agent Outcome Observation, admitted as evidence.
       *
       * It earns the review for a third reason again. A fabricated item here would not overstate a
       * system's usability and would not misname the organization; it would tell a Director that
       * something in their organization ACTED. So the class must stay narrow in a specific
       * direction: it carries what was filed, decided and attempted, and it may never carry what an
       * agent is for, what it may do, what it was instructed to do, or who is accountable for it —
       * because the observation holds no field for any of them.
       *
       * IT IS NOT `workforce`, and the distinction is the reason this class exists rather than that
       * one being connected. `workforce`'s released profile says "Organizational workforce identity
       * — not a runtime agent"; it is chartered for the humans an organization is made of, and
       * Hebun holds no authority for them.
       *
       *     RUNTIME AGENT != WORKFORCE IDENTITY        OUTCOME != MANDATE
       */
      "agents",
      /*
       * E2-6. What this organization actually DID, as Hebun's own writers recorded it — a bounded,
       * newest-first page of `audit_log` that always states the total it was drawn from.
       *
       * It earns the review for a fourth distinct reason. A fabricated item here would not
       * overstate a system's usability, misname the organization, or claim an agent acted; it would
       * put an event into the organization's HISTORY that never happened — the one kind of false
       * evidence a Director would have no other record to check it against. So the class must stay
       * narrow in a specific direction: it carries the acts Hebun recorded and may never imply it
       * carries all of them, and it exposes no payload, no entity identifier and no actor identity,
       * because the released reader withholds those columns.
       *
       * IT IS NOT `governance`, and that is why it is a separate class. `governance` carries the
       * CONSTITUTION — who holds authority — and every one of its items is complete. This is
       * BOUNDED history. One class asserting both would blur which of the two an answer rests on.
       *
       *     CONSTITUTION != HISTORY        RECORDED ACT != ALL ORGANIZATIONAL ACTIVITY
       */
      "recorded-acts",
    ],
  );
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
