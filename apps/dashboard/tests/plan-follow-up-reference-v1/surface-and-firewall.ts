/*
 * PLAN-FOLLOW-UP-REFERENCE-V1 — what the surfaces say, and the boundaries the source keeps.
 *
 * Pure: renders one component and reads source files. No database, no network, no model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RequestCard } from "../../src/components/decision-workspace/action-authorizations";
import { PLAN_FOLLOW_UP_GOALS } from "../../src/features/heby-commands/plan-follow-up";
import type { PendingActionRequestView } from "../../src/features/action-authorization/read-action-authorizations.server";

const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const visible = (m: string) => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* 1 · The proposal names its source work, and says what it is — provenance, not authority. */
function proposalShowsSources(): void {
  const item: PendingActionRequestView = {
    requestId: "req-1",
    actionKind: "record-work",
    toolId: "heby.work.record",
    sideEffect: "CONSEQUENTIAL_MUTATION",
    reversibility: "reversible",
    targetKind: "record",
    targetRef: "organization",
    targetLabel: "Organization",
    expectedEffect: "A work item is recorded.",
    consequences: ["A work item exists."],
    parameters: [],
    locks: [],
    evidence: { status: "attached", items: [] },
    proposedByActorType: "agent",
    proposedByAgentName: "Heby",
    proposedByAgentInService: true,
    payloadDigest: "d",
    proposedAt: "2026-10-20T10:00:00.000Z",
    purposeWorkTitle: null,
    purposeUnresolved: false,
    proposalRationale: null,
  };
  const render = (followUpSources: unknown) =>
    visible(renderToStaticMarkup(createElement(RequestCard as never, { item, waitingFor: null, workOptions: [], instagramPreviews: null, followUpSources } as never)));

  const linked = render({
    "req-1": [
      { workItemId: "w1", title: "Blocked loom repair", inService: true },
      { workItemId: "w2", title: "Retired supplier review", inService: false },
    ],
  });
  assert.ok(linked.includes("Follow-up of 2 work items:"), linked.slice(0, 300));
  assert.ok(linked.includes("Blocked loom repair"));
  assert.ok(linked.includes("Retired supplier review (no longer in service — executing this will be refused)"));
  assert.ok(linked.includes("it is provenance, not an extra authorization"));
  assert.ok(!linked.includes("w1") && !linked.includes("w2"), "no raw work id is rendered");

  for (const none of [null, {}, { "req-1": [] }]) {
    assert.ok(!render(none).includes("Follow-up of"), "no source line without recorded sources");
  }
}

/* 2 · The origination model is still given only the fixed goal sentences. */
function goalsCarryNoWork(): void {
  for (const goal of Object.values(PLAN_FOLLOW_UP_GOALS)) {
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(goal), "a goal carries no id");
  }
  const plan = code("src/features/heby-commands/ai-operational-plan.server.ts");
  assert.ok(plan.includes("goal: PLAN_FOLLOW_UP_GOALS[s.move]"), "the goal is still keyed by the move alone");
  const origination = code("src/features/agent-origination/originate-action.server.ts");
  assert.ok(origination.includes("verifyPlanFollowUpBinding(tenant, input.planBinding"), "the binding is verified against the trusted tenant");
  const sel = origination.indexOf("const selection = await selectAction(");
  const verify = origination.indexOf("verifyPlanFollowUpBinding(");
  assert.ok(verify > 0 && verify < sel, "provenance is established before the model is asked");
  assert.ok(!/selectAction\([^)]*sourceWorkItemIds/.test(origination), "source ids are never handed to the model call");
}

/* 3 · Both executors read provenance from the request's own rows and hand it to the Work authority. */
function bothDoorsRevalidate(): void {
  for (const file of [
    "src/features/governed-internal-action/execute-record-work.server.ts",
    "src/features/governed-machine-execution/execute-record-work-as-machine.server.ts",
  ]) {
    const src = code(file);
    assert.ok(src.includes("readRequestSourceWorkIdsWithin(tx,"), `${file} reads provenance in the spend transaction`);
    assert.ok(src.includes("authorization.actionRequestId"), `${file} keys it by the permit's own request`);
    assert.ok(src.includes("...followsUp"), `${file} hands it to the Work authority`);
  }
  const work = code("src/features/organizational-work/write-work.server.ts");
  assert.ok(work.includes("allFollowUpSourcesInService(tx,"), "the Work authority revalidates inside the transaction");
  assert.ok(work.indexOf("follow-up-source-ineligible") < work.indexOf(".insert(workItems)"), "before anything is written");
}

/* 4 · Nothing on the client reads a binding, and no client module reaches the provenance writers. */
function clientBoundaries(): void {
  for (const file of [
    "src/components/layout/heby/heby-origination-affordance.tsx",
    "src/components/layout/heby/heby-composer.tsx",
    "src/components/decision-workspace/action-authorizations.tsx",
    "src/components/organizational-work/work-register.tsx",
  ]) {
    const src = code(file);
    for (const banned of ["binding.server", "verifyPlanFollowUpBinding", "mintPlanFollowUpBinding", "atob(", "base64url", "JSON.parse(planBinding"]) {
      assert.ok(!src.includes(banned), `${file} must not reach ${banned}`);
    }
  }
  /* The payload builder never sees a source. */
  const inlet = code("src/features/heby-action-inlet/record-work-proposal.server.ts");
  const args = inlet.slice(inlet.indexOf("proposedArguments"), inlet.indexOf("proposedArguments") + 600);
  assert.ok(!args.includes("sourceWorkItemIds"), "sources never enter the proposed (digested) arguments");
}

proposalShowsSources();
goalsCarryNoWork();
bothDoorsRevalidate();
clientBoundaries();
console.log("plan-follow-up-reference-v1/surface-and-firewall: OK");
