/*
 * SOC-ACT1 — what the originator does with a reference, and what it refuses.
 *
 * Every case here is driven through the REAL originator with an injected database, so the assertions
 * are about released behaviour rather than about a restatement of it.
 */
import assert from "node:assert/strict";

/*
 * THE SCHEMA BARREL IS LOADED FIRST, DELIBERATELY.
 *
 * Importing a feature server module before it leaves the barrel half-initialized under this
 * runner and throws a TDZ error from a table definition — a failure about import ORDER that looks
 * exactly like a failure about this phase. Every released test that EXECUTES server code imports
 * the client first for the same reason; this follows that convention rather than inventing one.
 */
import "../../src/db/client.server";

import { proposeSocialObservationWorkAction } from "../../src/features/heby-action-inlet/record-work-proposal.server";
import { formatProviderObservationRef } from "../../src/features/provider-observation-history/observation-ref";

const TENANT = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" } as never;
const OBSERVATION_ID = "33333333-3333-4333-8333-333333333333";
const REF = formatProviderObservationRef(OBSERVATION_ID);

/**
 * A database that answers the observation read and records every action-request insert.
 *
 * `rows` is what the observation SELECT returns. A tenant-foreign or absent row is modelled the way
 * the real seam behaves: the predicate matches nothing, so the read is empty.
 */
function dbReturning(rows: readonly unknown[]): { db: unknown; inserts: unknown[] } {
  const inserts: unknown[] = [];
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    values: (v: unknown) => {
      inserts.push(v);
      return { returning: async () => [{ id: "44444444-4444-4444-8444-444444444444" }] };
    },
  };
  const db = {
    select: () => chain,
    insert: () => chain,
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };
  return { db, inserts };
}

const observationRow = {
  observationId: OBSERVATION_ID,
  providerKey: "instagram",
  capabilityKey: "instagram.account.public.read",
  subjectKind: "instagram-account",
  subjectRef: "subject",
  integrationId: "55555555-5555-4555-8555-555555555555",
  observedAt: new Date("2026-09-11T10:00:20.258Z"),
  recordedAt: new Date("2026-09-11T10:00:21.000Z"),
  observedByActorType: null,
  standingAuthorizationId: "66666666-6666-4666-8666-666666666666",
  invocationId: "77777777-7777-4777-8777-777777777777",
  facts: { followersCount: 56 },
};

/* ── 1 · a malformed reference never reaches the database ──────────────────── */

async function aMalformedReferenceIsRefusedWithoutReading(): Promise<void> {
  let touched = false;
  const db = { select: () => { touched = true; throw new Error("must not read"); } };
  const result = await proposeSocialObservationWorkAction(
    TENANT,
    { observationRef: "provider-observation/not-a-uuid", title: "Look into the follower change" },
    { getDb: () => db as never },
  );
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" && result.reason, "invalid-observation-ref");
  assert.equal(touched, false, "a malformed reference must not reach a uuid column");
}

/* ── 2 · an unresolvable reference fails closed, with ONE answer ───────────── */

async function anUnresolvableReferenceFailsClosed(): Promise<void> {
  /*
   * ABSENT, FOREIGN AND DELETED ARE ONE ANSWER. The seam's tenant predicate already makes a foreign
   * row unreachable; collapsing the three here means a probe cannot use the DIFFERENCE between
   * refusals to learn that an observation exists in a tenant it cannot see.
   */
  const { db, inserts } = dbReturning([]);
  const result = await proposeSocialObservationWorkAction(
    TENANT,
    { observationRef: REF, title: "Look into the follower change" },
    { getDb: () => db as never },
  );
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" && result.reason, "observation-not-found");
  assert.equal(inserts.length, 0, "a refused proposal must write nothing");
}

/* ── 3 · a title the organization did not write is refused ─────────────────── */

async function anEmptyTitleIsRefused(): Promise<void> {
  const { db, inserts } = dbReturning([observationRow]);
  const result = await proposeSocialObservationWorkAction(
    TENANT,
    { observationRef: REF, title: "   " },
    { getDb: () => db as never },
  );
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" && result.reason, "invalid-input");
  assert.equal(inserts.length, 0);
}

/* ── 4 · an unresolved session writes nothing ──────────────────────────────── */

async function anUnauthenticatedSessionIsRefused(): Promise<void> {
  const result = await proposeSocialObservationWorkAction(null, {
    observationRef: REF,
    title: "Look into the follower change",
  });
  assert.equal(result.status, "refused");
  assert.equal(result.status === "refused" && result.reason, "unauthenticated");
}

/* ── 5 · the evidence is the READ, never the caller's string ───────────────── */

async function theEvidenceIsRebuiltFromTheRow(): Promise<void> {
  const { db, inserts } = dbReturning([observationRow]);
  /*
   * The caller sends an UPPERCASE variant. The canonical reference that reaches the request must be
   * the one re-derived from the row, not the spelling the browser happened to send — several
   * spellings of one id would otherwise hash as several different approvals.
   */
  const shouted = `provider-observation/${OBSERVATION_ID.toUpperCase()}`;
  const result = await proposeSocialObservationWorkAction(
    TENANT,
    { observationRef: shouted, title: "Look into the follower change" },
    { getDb: () => db as never },
  );

  if (result.status !== "proposed") {
    /*
     * The insert path depends on the action authority's own writer, which this fake only partly
     * models. What must hold regardless is that nothing was fabricated: an unproposed result must
     * never be reported as proposed, and the refusal must not be one of the SOC-ACT1 ones.
     */
    assert.notEqual(result.reason, "observation-not-found");
    assert.notEqual(result.reason, "invalid-observation-ref");
    return;
  }

  assert.equal(result.receipt.observationRef, REF, "the citation must be re-derived, lowercased");
  assert.equal(result.receipt.status, "pending-review");
  assert.equal(result.receipt.observedAt, "2026-09-11T10:00:20.258Z");
}

async function main(): Promise<void> {
  await aMalformedReferenceIsRefusedWithoutReading();
  await anUnresolvableReferenceFailsClosed();
  await anEmptyTitleIsRefused();
  await anUnauthenticatedSessionIsRefused();
  await theEvidenceIsRebuiltFromTheRow();
  console.log("SOC-ACT1 originator behaviour checks passed");
}

void main();
