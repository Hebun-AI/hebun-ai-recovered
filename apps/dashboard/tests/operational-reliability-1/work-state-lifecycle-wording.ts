/*
 * OPERATIONAL-RELIABILITY-1 — EO1-WORKSTATE-LIFECYCLE-WORDING-1, pure.
 *
 * Heby's internal kinds are pinned to the registry's `internal-authority` postures, so a released
 * internal act can no longer fall through to external-delivery wording. A spent state change says it
 * was applied only with the Work Authority's record; without it, it says it cannot confirm.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EXECUTABLE_ACTION_POSTURES } from "../../src/features/heby-actions/action-registry";
import { GOVERNED_INTERNAL_ACTION_KINDS } from "../../src/features/heby-action-inlet/contracts";
import {
  describeRequestLifecycle,
  lifecycleNextStep,
  LifecycleNextStepLink,
} from "../../src/components/layout/heby/heby-origination-affordance";
import type { ActionRequestLifecycleView } from "../../src/features/action-authorization/read-action-authorizations.server";

/* ── 1. THE CLIENT-SAFE LIST IS THE REGISTRY'S INTERNAL POSTURES, EXACTLY ── */
assert.deepEqual(
  [...GOVERNED_INTERNAL_ACTION_KINDS].sort(),
  EXECUTABLE_ACTION_POSTURES.filter((p) => p.execution === "internal-authority").map((p) => p.actionKind).sort(),
  "every internal-authority act is an internal kind for Heby's lifecycle, and nothing else is",
);

const T = "2026-10-25T10:00:00.000Z";
const base: ActionRequestLifecycleView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  actionKind: "set-work-declared-state",
  label: "Change the state",
  proposedByActorType: "agent",
  proposedAt: T,
  decision: { status: "approved", at: T, standing: false },
  permit: { permitId: "permit-1", state: "consumed", expiresAt: T, consumedAt: T, revokedAt: null },
  execution: null,
  workOutcome: null,
};
const view = (v: Partial<ActionRequestLifecycleView>) => ({ ...base, ...v });
const say = (v: Partial<ActionRequestLifecycleView>) => describeRequestLifecycle(view(v)).join(" ");
const recorded = {
  status: "recorded" as const,
  workItemId: "11111111-1111-4111-8111-111111111111",
  title: "Quarterly stock count",
  scope: { kind: "organization" as const },
};

/* ── 2. APPLIED — only with the Work Authority's record ── */
assert.match(
  say({ workOutcome: { ...recorded, stateChange: { fromState: "planned", toState: "active" } } }),
  /Executed Sun, 25 Oct 2026 10:00:00 GMT\. The work register recorded the change: Quarterly stock count moved from planned to active\. Work item 11111111-1111-4111-8111-111111111111\./,
);
assert.match(say({ workOutcome: recorded }), /The work register recorded a change of state for Quarterly stock count\./, "a link without a readable payload claims no states");
assert.deepEqual(lifecycleNextStep(view({ workOutcome: recorded })), { href: "/director/work", label: "Open the work register" });

/* ── 3. EXECUTED, NOT CONFIRMED — the permit alone proves no effect ── */
for (const workOutcome of [null, { status: "reference-unavailable" as const }]) {
  const text = say({ workOutcome });
  assert.match(text, /Executed .*Hebun could not confirm the work register's record of this change, so no effect is claimed here\./);
  assert.doesNotMatch(text, /recorded the change|moved from|one transaction|delivery attempt|provider/);
  assert.deepEqual(lifecycleNextStep(view({ workOutcome })), { href: "/director/work", label: "Check the work register" });
}
assert.match(renderToStaticMarkup(createElement(LifecycleNextStepLink, { view: view({}) })), /href="\/director\/work"[^>]*>Check the work register</);

/* ── 4. NO INTERNAL ACT IS EVER WORDED AS AN EXTERNAL DELIVERY ── */
for (const actionKind of GOVERNED_INTERNAL_ACTION_KINDS) {
  assert.doesNotMatch(say({ actionKind }), /no delivery attempt is recorded/, `${actionKind} is internal`);
  assert.equal(lifecycleNextStep(view({ actionKind }))?.href, "/director/work", `${actionKind} leads to the register`);
}
assert.match(say({ actionKind: "send-external-communication" }), /no delivery attempt is recorded, so no effect can be claimed/, "external wording unchanged");

/* ── 5. THE EARLIER STATES ARE UNCHANGED FOR A STATE CHANGE ── */
assert.match(say({ decision: { status: "pending" }, permit: null }), /Waiting for a human decision in Approvals/);
assert.match(say({ permit: { permitId: "permit-1", state: "active", expiresAt: T, consumedAt: null, revokedAt: null } }), /Authorized and not yet executed/);
assert.match(say({ permit: { permitId: "permit-1", state: "expired", expiresAt: T, consumedAt: null, revokedAt: null } }), /expired .*without being used\. Nothing was executed\./);
assert.match(say({ permit: { permitId: "permit-1", state: "revoked", expiresAt: T, consumedAt: null, revokedAt: T } }), /revoked .*Nothing was executed under it\./);
assert.match(say({ decision: { status: "rejected", at: T } }), /Rejected .*Nothing will be executed\./);
for (const state of ["active", "expired", "revoked"] as const) {
  assert.doesNotMatch(say({ permit: { permitId: "permit-1", state, expiresAt: T, consumedAt: null, revokedAt: null }, workOutcome: recorded }), /recorded the change/, `${state}: no effect claimed`);
}

console.log("operational-reliability-1 work-state lifecycle wording: ok");
