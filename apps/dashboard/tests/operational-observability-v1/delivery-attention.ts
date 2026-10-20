/*
 * OPERATIONAL-OBSERVABILITY-V1 — scheduled machine delivery timing on /approvals.
 *
 * Proves, without a database or network:
 *   1. Four states, and `null` for every permit that is not active and machine-deliverable —
 *      consumed, expired, revoked, human-proposed and non-record-work permits get no timing line.
 *   2. The attention window is two intervals of the delivery cron in `vercel.json`.
 *   3. Wording claims no failure, no attempt and no run, and offers no retry.
 *   4. The rendered permit row shows the line only when the caller passes the read instant, and adds
 *      no control.
 *   5. The UI graph reaches no cross-tenant runtime reader and no execution machinery.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  MACHINE_DELIVERY_ATTENTION_WINDOW_MS,
  MACHINE_DELIVERY_ATTENTION_WORDING,
  MACHINE_DELIVERY_SCAN_INTERVAL_MINUTES,
  deriveMachineDeliveryAttention,
  derivePermitDeliveryBand,
  type DeliverablePermitState,
} from "../../src/features/action-authorization/delivery-legibility";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import { PermitRow } from "../../src/components/decision-workspace/action-authorizations";
import type { ActionPermitView } from "../../src/features/action-authorization/read-action-authorizations.server";

const read = (p: string): string => readFileSync(path.join(process.cwd(), p), "utf8");
const visible = (m: string): string => m.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const ISSUED = "2026-10-20T10:00:00.000Z";
const at = (ms: number): string => new Date(Date.parse(ISSUED) + ms).toISOString();
const band = (state: DeliverablePermitState, actionKind: string = RECORD_WORK_ACTION_KIND, proposedByActorType = "agent") =>
  derivePermitDeliveryBand({ actionKind, proposedByActorType, state });

/* 1. Classification. */
function classification(): void {
  const active = band("active");
  const W = MACHINE_DELIVERY_ATTENTION_WINDOW_MS;
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", ISSUED, at(0)), "awaiting-scheduled-delivery");
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", ISSUED, at(W)), "awaiting-scheduled-delivery", "exactly at the window");
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", ISSUED, at(W + 1)), "attention-required");
  assert.equal(deriveMachineDeliveryAttention(active, "not-enabled", ISSUED, at(10 * W)), "delivery-not-enabled", "disarmed is never overdue");
  assert.equal(deriveMachineDeliveryAttention(active, "unknown", ISSUED, at(10 * W)), "insufficient-evidence", "unknown arming is never overdue");
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", ISSUED, null), "insufficient-evidence");
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", "not-a-date", at(10 * W)), "insufficient-evidence");
  assert.equal(deriveMachineDeliveryAttention(active, "enabled", ISSUED, at(-60_000)), "insufficient-evidence", "a read before issue proves nothing");

  for (const state of ["consumed", "expired", "revoked", "none"] as const) {
    for (const md of ["enabled", "not-enabled", "unknown"] as const) {
      assert.equal(deriveMachineDeliveryAttention(band(state), md, ISSUED, at(10 * W)), null, `${state}/${md}: no timing line`);
    }
  }
  assert.equal(deriveMachineDeliveryAttention(band("active", RECORD_WORK_ACTION_KIND, "human"), "enabled", ISSUED, at(10 * W)), null, "human-proposed is not machine-deliverable");
  assert.equal(deriveMachineDeliveryAttention(band("active", "send-external-communication"), "enabled", ISSUED, at(10 * W)), null, "an external send is not machine-deliverable");
}

/* 2. The window is two intervals of the delivery cron. */
function windowIsTheSchedule(): void {
  const config = JSON.parse(read("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const delivery = config.crons.find((c) => c.path === "/api/machine-delivery/scan");
  assert.ok(delivery, "the delivery cron exists");
  assert.equal(delivery.schedule, "0 * * * *", "hourly at minute 0");
  assert.equal(MACHINE_DELIVERY_SCAN_INTERVAL_MINUTES, 60, "the interval is the cron's");
  assert.equal(MACHINE_DELIVERY_ATTENTION_WINDOW_MS, 2 * 60 * 60_000, "two scheduled chances");
}

/* 3. Wording. */
function wording(): void {
  const all = Object.values(MACHINE_DELIVERY_ATTENTION_WORDING).map((w) => `${w.label} ${w.sentence}`).join(" ").toLowerCase();
  for (const forbidden of ["delivery failed", "could not be delivered", "attempt failed", "the scan ran", "retry", "try again", "stuck"]) {
    assert.ok(!all.includes(forbidden), `timing wording must not say "${forbidden}"`);
  }
  const attention = MACHINE_DELIVERY_ATTENTION_WORDING["attention-required"].sentence;
  assert.ok(attention.includes("not evidence that a delivery was attempted or that one failed"), "attention denies a failure claim");
}

/* 4. Render. */
const permit = (over: Partial<ActionPermitView> = {}): ActionPermitView => ({
  permitId: "permit-1",
  requestId: "request-1",
  actionKind: RECORD_WORK_ACTION_KIND,
  toolId: "tool-1",
  targetLabel: null,
  state: "active",
  issuedAt: ISSUED,
  expiresAt: at(24 * 3_600_000),
  consumedAt: null,
  revokedAt: null,
  revocationReason: null,
  boundPayloadDigest: "digest",
  executionStatus: null,
  providerAccepted: false,
  providerMessageId: null,
  proposedByActorType: "agent",
  standingAuthorizationId: null,
  ...over,
} as ActionPermitView);

function rendering(): void {
  const row = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(PermitRow, props as never));

  const before = row({ item: permit(), machineDelivery: "enabled" });
  assert.ok(!visible(before).includes("Attention required"), "without a read instant the row is unchanged");
  assert.ok(!visible(before).includes("Awaiting scheduled delivery"));

  const late = row({ item: permit(), machineDelivery: "enabled", evaluatedAt: at(3 * 3_600_000) });
  assert.ok(visible(late).includes("Attention required."), "a late permit says so");
  assert.ok(visible(late).includes("not evidence that a delivery was attempted or that one failed"));

  const fresh = visible(row({ item: permit(), machineDelivery: "enabled", evaluatedAt: at(10 * 60_000) }));
  assert.ok(fresh.includes("Awaiting scheduled delivery."));

  const off = visible(row({ item: permit(), machineDelivery: "not-enabled", evaluatedAt: at(3 * 3_600_000) }));
  assert.ok(off.includes("Automatic delivery not enabled.") && !off.includes("Attention required"));

  const spent = visible(row({ item: permit({ state: "consumed", consumedAt: at(60_000) }), machineDelivery: "enabled", evaluatedAt: at(3 * 3_600_000) }));
  assert.ok(!spent.includes("Attention required") && !spent.includes("Awaiting scheduled delivery"), "a consumed permit gets no timing line");

  /* The timing line adds no control: the same number of buttons with and without it. */
  const buttons = (m: string): number => (m.match(/<button/g) ?? []).length;
  assert.equal(buttons(late), buttons(before), "no new control");
}

/* 5. Firewall over the UI graph. */
function firewall(): void {
  const ui = [
    "src/features/action-authorization/delivery-legibility.ts",
    "src/components/decision-workspace/action-authorizations.tsx",
    "src/components/approvals-dashboard/approvals-dashboard.tsx",
    "src/app/(dashboard)/approvals/page.tsx",
  ];
  for (const file of ui) {
    const src = read(file);
    for (const banned of [
      "ForRuntime",
      "read-machine-deliverable-permits",
      "read-standing-issuable-requests",
      "machine-delivery-trigger",
      "execute-record-work-as-machine",
      "cron-scan-warning",
    ]) {
      assert.ok(!src.includes(banned), `${file} must not reach ${banned}`);
    }
  }
  const helper = read("src/features/cron-scan-warning/warn-unsuccessful-scan.ts");
  const imports = [...helper.matchAll(/^import\s+(type\s+)?[^;]*from\s+"([^"]+)"/gm)];
  assert.equal(imports.length, 3);
  assert.ok(imports.every((m) => m[1]), "the warning helper imports types only");
  for (const banned of ["insert(", "update(", "delete(", "db.", "fetch(", "setTimeout", "setInterval"]) {
    assert.ok(!helper.includes(banned), `the warning helper contains no ${banned}`);
  }
}

classification();
windowIsTheSchedule();
wording();
rendering();
firewall();
console.log("operational-observability-v1/delivery-attention: OK");
