/*
 * ENTERPRISE-OPERATIONS-1 — the completion pass: permit states and the Heby lifecycle's next steps.
 *
 *   PERMIT-EXPIRED-STATUS-1: an expired or revoked authorization is never worded like one that
 *      can still run, and the permit's lifecycle is only read, never re-derived or written.
 *
 * (WORK-UPDATE-LOGIN-QUERY-LOSS-1 was stopped at the D1 login-form pin; see the phase report.)
 * Plus the Heby lifecycle's next-step links. No database, no session, no provider.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { permitOutcomeSentence } from "../../src/components/decision-workspace/action-authorizations";
import { buildQueue } from "../../src/features/approvals-dashboard/model";
import type { ActionPermitView } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { ApprovalsDashboardRead } from "../../src/features/approvals-dashboard/read-dashboard.server";
import { lifecycleNextStep } from "../../src/components/layout/heby/heby-origination-affordance";
import { HebyWorkStateSelection } from "../../src/components/layout/heby/heby-work-state-selection";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const permit = (over: Partial<ActionPermitView>): ActionPermitView => ({
  permitId: "p", requestId: "r", actionKind: "record-work", toolId: "t", targetLabel: "Work", state: "active",
  issuedAt: "2026-10-25T08:00:00.000Z", expiresAt: "2026-10-26T08:00:00.000Z", consumedAt: null, revokedAt: null,
  revocationReason: null, boundPayloadDigest: "d", executionStatus: null, providerAccepted: false, providerMessageId: null,
  proposedByActorType: "human", standingAuthorizationId: null, ...over,
});

function expiredIsNeverExecutable(): void {
  const sentence = (state: ActionPermitView["state"]) => permitOutcomeSentence({ actionKind: "record-work", state, consumedAt: null });
  assert.match(sentence("active"), /not executed/);
  assert.match(sentence("expired"), /now expired — it can no longer be executed/);
  assert.match(sentence("revoked"), /revoked before it was executed — it can no longer be executed/);
  assert.match(sentence("expired"), /never executed/i, "GIA-1's pin still holds");

  const data = { content: [], purposes: { status: "unavailable" } } as unknown as ApprovalsDashboardRead;
  const status = (state: ActionPermitView["state"], over: Partial<ActionPermitView> = {}) =>
    buildQueue(data, [], [permit({ state, ...over })])[0]!.status;
  assert.equal(status("active"), "Authorized · not yet executed");
  assert.equal(status("expired"), "Authorization expired · cannot be executed");
  assert.equal(status("revoked"), "Authorization revoked · cannot be executed");
  assert.equal(status("consumed", { consumedAt: "2026-10-25T09:00:00.000Z" }), "Executed · authorization spent");
  assert.equal(status("none"), "Permit state unknown", "no state is invented when the reader had none");
  for (const s of ["expired", "revoked", "consumed", "none"] as const) {
    assert.doesNotMatch(status(s), /not yet executed|can be executed$/, `${s} is not worded as executable`);
  }
  /* Execute exists only for an active permit, and the state is the reader's, not re-derived here. */
  const row = read("src/components/decision-workspace/action-authorizations.tsx");
  assert.match(row, /\{item\.state === "active" \? \(\s*<div className="flex flex-col gap-2">/);
  assert.doesNotMatch(read("src/features/approvals-dashboard/model.ts"), /expiresAt|Date\.now|new Date\(/, "the queue does not re-derive expiry");
}

function lifecycleNamesTheNextPlace(): void {
  type View = Parameters<typeof lifecycleNextStep>[0];
  const view = (over: Partial<View>): View => ({
    requestId: "r", actionKind: "record-work", proposedAt: "2026-10-25T08:00:00.000Z", proposedByActorType: "agent",
    decision: { status: "approved", at: "2026-10-25T08:01:00.000Z", standing: false },
    permit: { state: "active", expiresAt: "2026-10-26T08:00:00.000Z", consumedAt: null, revokedAt: null },
    execution: null, workOutcome: null, ...over,
  } as View);
  assert.deepEqual(lifecycleNextStep(view({ decision: { status: "pending" } } as Partial<View>)), { href: "/approvals", label: "Open Approvals" });
  assert.equal(lifecycleNextStep(view({}))!.href, "/approvals", "a live authorization is executed in Approvals");
  assert.equal(lifecycleNextStep(view({ permit: { state: "consumed", consumedAt: "x" } } as Partial<View>))!.href, "/director/work");
  assert.equal(lifecycleNextStep(view({ actionKind: "send-external-communication", permit: { state: "consumed" } } as Partial<View>)), null);
  assert.equal(lifecycleNextStep(view({ permit: { state: "expired" } } as Partial<View>)), null, "an expired one has no next place");
  assert.equal(lifecycleNextStep(view({ decision: { status: "rejected" } } as Partial<View>)), null);
  for (const file of ["src/components/layout/heby/heby-origination-affordance.tsx", "src/components/layout/heby/heby-my-requests.tsx"]) {
    assert.match(read(file), /<LifecycleNextStepLink view=\{/, `${file} renders the next step`);
  }
  /* The work item brought to Heby links back to the register, whatever was resolved. */
  for (const selection of [{ status: "unresolved" as const }, { status: "unavailable" as const }]) {
    assert.match(renderToStaticMarkup(createElement(HebyWorkStateSelection, { selection })), /href="\/director\/work"/);
  }
  assert.match(read("src/app/(dashboard)/heby/page.tsx"), /<HebyWorkStateSelection selection=\{selection\} \/>/);
}

async function main(): Promise<void> {
  expiredIsNeverExecutable();
  lifecycleNamesTheNextPlace();
  console.log("PASS enterprise-operations-1: expired never executable, next steps linked");
}
void main();
