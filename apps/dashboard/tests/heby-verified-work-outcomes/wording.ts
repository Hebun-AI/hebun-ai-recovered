/*
 * HEBY-VERIFIED-WORK-OUTCOMES — the sentences, for every lifecycle the authorities can state.
 *
 * Pure: the lifecycle view is what the read returns, and these are the words a person sees in
 * "Check what happened" and "Your requests". A work item is named only when the read named it.
 */
import assert from "node:assert/strict";
import { describeRequestLifecycle } from "../../src/components/layout/heby/heby-origination-affordance";
import type { ActionRequestLifecycleView } from "../../src/features/action-authorization/read-action-authorizations.server";

const T = "2026-10-12T10:00:00.000Z";
const WORK = "bb56f9dc-c833-4bbe-892e-6456bec3d8c3";
const executed: ActionRequestLifecycleView = {
  requestId: "00000000-0000-4000-8000-000000000001",
  actionKind: "record-work",
  label: "Verify the Heby request lifecycle release in production",
  proposedByActorType: "agent",
  proposedAt: T,
  decision: { status: "approved", at: T, standing: false },
  permit: { state: "consumed", expiresAt: T, consumedAt: T, revokedAt: null },
  execution: null,
  workOutcome: {
    status: "recorded",
    workItemId: WORK,
    title: "Verify the Heby request lifecycle release in production",
    scope: { kind: "domain", name: "Engineering" },
  },
};
const say = (v: Partial<ActionRequestLifecycleView>) => describeRequestLifecycle({ ...executed, ...v }).join(" ");

/* Work item recorded — title, domain and the real id, all from the read. */
assert.match(
  say({}),
  new RegExp(`Executed .*the change is recorded\\. Work item recorded: Verify the Heby request lifecycle release in production\\. Work domain: Engineering · work item ${WORK}\\.$`),
);
assert.match(say({ workOutcome: { status: "recorded", workItemId: WORK, title: "X", scope: { kind: "organization" } } }), /Organization-level work · work item /);
assert.match(say({ workOutcome: { status: "recorded", workItemId: WORK, title: "X", scope: null } }), /Work scope not recorded · work item /);

/* Outcome unavailable — said plainly; the request's own title is never offered as the work item. */
const unavailable = say({ workOutcome: { status: "reference-unavailable" } });
assert.match(unavailable, /Execution recorded\. Work item reference unavailable\.$/);
assert.doesNotMatch(unavailable, /Work item recorded|work item [0-9a-f]{8}-/);

/* Every earlier state claims no work: waiting, authorized, expired, revoked, rejected. */
const none = { workOutcome: null };
const cases: readonly [Partial<ActionRequestLifecycleView>, RegExp][] = [
  [{ ...none, decision: { status: "pending" }, permit: null }, /Waiting for a human decision in Approvals\. Nothing is authorized or executed yet\.$/],
  [{ ...none, permit: { state: "active", expiresAt: T, consumedAt: null, revokedAt: null } }, /Authorized and not yet executed\. The authorization expires/],
  [{ ...none, permit: { state: "expired", expiresAt: T, consumedAt: null, revokedAt: null } }, /expired .* without being used\. Nothing was executed\.$/],
  [{ ...none, permit: { state: "revoked", expiresAt: T, consumedAt: null, revokedAt: T } }, /revoked .*Nothing was executed under it\.$/],
  [{ ...none, decision: { status: "rejected", at: T }, permit: null }, /Rejected .*Nothing will be executed\./],
];
for (const [view, re] of cases) {
  const text = say(view);
  assert.match(text, re);
  assert.doesNotMatch(text, /Work item recorded|Work item reference/);
}
/* A stale outcome on a non-spent row is never rendered: the permit state decides first. */
assert.doesNotMatch(say({ permit: { state: "active", expiresAt: T, consumedAt: null, revokedAt: null } }), /Work item recorded/);

/* An external send never speaks about work items. */
assert.doesNotMatch(
  say({ actionKind: "send-external-communication", workOutcome: null, execution: { status: "failed", providerAccepted: false } }),
  /Work item/,
);

console.log("PASS heby-verified-work-outcomes wording");
