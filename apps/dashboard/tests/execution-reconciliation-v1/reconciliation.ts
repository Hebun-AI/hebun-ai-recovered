/*
 * EXECUTION-RECONCILIATION-V1 — the "Needs Reconciliation" lens: why each candidate is listed.
 *
 * Proves, without a database or network:
 *   1. The reason is non-null exactly for the state-only attention predicate — age never adds or
 *      removes a candidate, and never turns any status into success or failure.
 *   2. The in-flight window is the `/approvals` route's `maxDuration`, the only invocation that can
 *      settle an attempt. If either moves alone, this fails.
 *   3. The ledger read issues SELECTs only — no insert, update, delete, transaction or raw execute —
 *      and carries the read instant it measured ages from.
 *   4. No authorized tenant context means no read at all.
 *
 * Tenant isolation of the underlying SQL is proven against real Postgres by
 * `tests/r3b-flow/execution-postgres.ts`; this phase adds no statement of its own.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  EXECUTION_IN_FLIGHT_WINDOW_MS,
  EXECUTION_RETRY_POLICY,
  RECONCILIATION_WORDING,
  attemptRequiresAttention,
  reconciliationReasonFor,
  type ExecutionAttemptStatus,
} from "../../src/features/action-execution/contracts";
import { readExecutionLedger } from "../../src/features/action-execution/execution-ledger-projection.server";
import type { ExecutionAttemptRow } from "../../src/features/action-execution/attempt-view";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const STATUSES: readonly ExecutionAttemptStatus[] = ["pending", "accepted", "refused", "failed", "unknown"];
const NOW = 1_700_000_000_000;
const at = (ms: number): string => new Date(ms).toISOString();

/* 1. Reason ⇔ attention, for every status at every age. */
function reasonFollowsStateOnly(): void {
  const ages = [0, 1, EXECUTION_IN_FLIGHT_WINDOW_MS, EXECUTION_IN_FLIGHT_WINDOW_MS + 1, 365 * 86_400_000];
  for (const status of STATUSES) {
    for (const age of ages) {
      const reason = reconciliationReasonFor(status, at(NOW - age), NOW);
      assert.equal(reason !== null, attemptRequiresAttention(status), `${status} @${age}ms`);
    }
    assert.equal(
      reconciliationReasonFor(status, "not-a-date", NOW) !== null,
      attemptRequiresAttention(status),
      `${status} with an unreadable start`,
    );
  }

  assert.equal(reconciliationReasonFor("unknown", at(NOW), NOW), "outcome-unknown", "unknown at once");
  assert.equal(reconciliationReasonFor("unknown", at(0), NOW), "outcome-unknown", "unknown stays unknown");
  assert.equal(
    reconciliationReasonFor("pending", at(NOW - EXECUTION_IN_FLIGHT_WINDOW_MS), NOW),
    "pending-may-be-in-flight",
    "exactly at the window a pending may still be running",
  );
  assert.equal(
    reconciliationReasonFor("pending", at(NOW - EXECUTION_IN_FLIGHT_WINDOW_MS - 1), NOW),
    "pending-past-execution-window",
  );
  assert.equal(
    reconciliationReasonFor("pending", at(NOW + 5_000), NOW),
    "pending-may-be-in-flight",
    "a start after the read instant is never called stale",
  );
  assert.equal(
    reconciliationReasonFor("pending", "not-a-date", NOW),
    "pending-may-be-in-flight",
    "an unreadable start never earns the stronger claim",
  );

  /* Wording: verification, never failure, success or an offer to act again. */
  const all = [...Object.values(RECONCILIATION_WORDING.reasons), RECONCILIATION_WORDING.doNotRepeat].join(" ");
  for (const forbidden of ["failed", "succeeded", "successful", "delivered", "safe to", "retry", "try again"]) {
    assert.ok(!all.toLowerCase().includes(forbidden), `reconciliation wording must not say "${forbidden}"`);
  }
  assert.equal(EXECUTION_RETRY_POLICY.automaticRetries, 0, "automatic retries stay disabled");
}

/* 2. The window is the route's execution bound — one number, two places, pinned together. */
function windowIsTheRouteBound(): void {
  const page = readFileSync(path.join("src", "app", "(dashboard)", "approvals", "page.tsx"), "utf8");
  const match = /export const maxDuration = (\d+);/.exec(page);
  assert.ok(match, "/approvals declares an explicit maxDuration");
  assert.equal(
    EXECUTION_IN_FLIGHT_WINDOW_MS,
    Number(match[1]) * 1000,
    "the in-flight window must equal the route that runs the execution",
  );
}

const tenant = asHumanTenantContext({
  tenantId: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  authIdentityId: "33333333-3333-4333-8333-333333333333",
  membershipId: "44444444-4444-4444-8444-444444444444",
  membershipVersion: 1,
  roleId: "55555555-5555-4555-8555-555555555555",
  sessionContextId: "66666666-6666-4666-8666-666666666666",
  provider: "local",
  assuranceLevel: "aal1",
  mfaVerified: false,
  requestId: "exec-reconciliation-v1",
  authenticatedAt: new Date(0).toISOString(),
});

const row = (status: ExecutionAttemptStatus, startedAt: Date): ExecutionAttemptRow => ({
  id: `attempt-${status}`,
  permitId: "permit-1",
  handoffId: "handoff-secret",
  actionRequestId: "request-1",
  actionKind: "send-external-communication",
  adapterId: "resend-email-v1",
  status,
  providerResponseClass: status === "unknown" ? "ambiguous" : null,
  providerMessageId: null,
  failureClass: null,
  recipientId: null,
  startedAt,
  completedAt: status === "pending" ? null : startedAt,
});

/* 3 + 4. A read is a read: SELECT only, the read instant carried, no tenant ⇒ nothing read. */
async function theLedgerReadMutatesNothing(): Promise<void> {
  const writes: string[] = [];
  let selects = 0;
  const rows = [row("unknown", new Date(0)), row("pending", new Date(0))];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  const forbid = (name: string) => () => {
    writes.push(name);
    throw new Error(`${name} must not be called by a read`);
  };
  const db = {
    select: () => {
      selects += 1;
      return chain;
    },
    insert: forbid("insert"),
    update: forbid("update"),
    delete: forbid("delete"),
    transaction: forbid("transaction"),
    execute: forbid("execute"),
  };

  const before = Date.now();
  const read = await readExecutionLedger(tenant, { getDb: () => db as never });
  assert.equal(read.status, "read");
  if (read.status !== "read") return;
  assert.deepEqual(writes, [], "the ledger read issued no write of any kind");
  assert.equal(selects, 2, "exactly the two existing SELECTs, nothing added");
  assert.ok(Date.parse(read.readAt) >= before - 1 && Date.parse(read.readAt) <= Date.now(), "readAt is the read instant");
  assert.deepEqual(
    read.needsAttention.map((e) => reconciliationReasonFor(e.status, e.startedAt, Date.parse(read.readAt))),
    ["outcome-unknown", "pending-past-execution-window"],
  );
  assert.ok(!JSON.stringify(read).includes("handoff-secret"), "the handoff key still does not cross");

  let touched = false;
  const none = await readExecutionLedger(null, {
    getDb: () => {
      touched = true;
      return db as never;
    },
  });
  assert.equal(none.status, "unavailable", "no authorized tenant context, no ledger");
  assert.equal(touched, false, "and the store is not even resolved");
}

async function main(): Promise<void> {
  reasonFollowsStateOnly();
  windowIsTheRouteBound();
  await theLedgerReadMutatesNothing();
  console.log("execution-reconciliation-v1/reconciliation: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
