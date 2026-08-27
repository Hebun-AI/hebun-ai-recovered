/*
 * R3A.1 — the `/send` proposal inlet, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An explicit `/send` naming an exact draft revision and an exact recorded recipient becomes ONE
 *    durable pending action request bound to both by digest — and a fabricated, foreign, retired or
 *    superseded referent becomes nothing at all, while no permit, decision, audit event, recipient,
 *    artifact or execution is created either way."
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { createWorkArtifact, retireWorkArtifact, reviseWorkArtifact } from "../../src/features/work-artifacts/write-work-artifacts.server";
import { createExternalRecipient, retireExternalRecipient } from "../../src/features/external-recipients/write-external-recipients.server";
import { proposeSendAction } from "../../src/features/heby-action-inlet/send-proposal.server";
import { runHebyProposeCommand } from "../../src/features/heby-action-inlet/propose-commands.server";
import { readPendingActionRequests } from "../../src/features/action-authorization/read-action-authorizations.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded): TenantContext {
  return {
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId: "00000000-0000-4000-8000-000000000000",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "r3a1-test",
    authenticatedAt: new Date().toISOString(),
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3a1_proposal");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  let handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme-r3a1", email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex-r3a1", email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme);
    const globexCtx = contextFor(globex);

    /* ── Substrate: one draft and one recipient, both REAL ─────────────────── */
    const draft = await createWorkArtifact(
      acmeCtx,
      { artifactType: "message-draft", title: "Quarterly summary", content: "Merhaba Ayşe,\nFirst draft." },
      "operations",
      deps,
    );
    assert.equal(draft.status, "created");
    if (draft.status !== "created") return;
    const draftRef = draft.ref;

    const recipient = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.com" },
      deps,
    );
    assert.equal(recipient.status, "created");
    if (recipient.status !== "created") return;
    const recipientRef = recipient.recipient.recordRef;

    /* ── 1. THE HAPPY PATH — one pending request, bound to both halves ─────── */
    const proposed = await proposeSendAction(acmeCtx, { recipientRef, draftRef }, deps);
    assert.equal(proposed.status, "proposed", "an explicit /send with real referents files a proposal");
    if (proposed.status !== "proposed") return;
    assert.equal(proposed.receipt.status, "pending-review");
    assert.equal(proposed.receipt.recipientLabel, "Ayşe Yılmaz");
    assert.equal(proposed.receipt.draftTitle, "Quarterly summary");
    assert.match(proposed.receipt.requestId, /^[0-9a-f-]{36}$/);

    /* The row is real, pending, and carries BOTH digests inside its frozen payload. */
    const row = await setup.query<{
      status: string; action_kind: string; payload_digest: string; canonical_payload: Record<string, unknown>;
    }>(
      `select status, action_kind, payload_digest, canonical_payload from heby_action_requests where id = $1`,
      [proposed.receipt.requestId],
    );
    assert.equal(row.rowCount, 1, "exactly one request row");
    assert.equal(row.rows[0]!.status, "pending");
    assert.equal(row.rows[0]!.action_kind, "send-external-communication");
    const payload = row.rows[0]!.canonical_payload;
    assert.equal(payload.recipientRef, recipientRef);
    assert.equal(payload.draftRef, draftRef);
    assert.equal(
      payload.recipientEndpointDigest,
      recipient.recipient.endpointDigest,
      "the ADDRESS is frozen by the digest the server read, not by anything a caller supplied",
    );
    assert.match(String(payload.draftRevisionDigest), /^[0-9a-f]{64}$/);

    /* ── 2. DEDUP IS R3A's, NOT A SECOND ONE ───────────────────────────────── */
    const again = await proposeSendAction(acmeCtx, { recipientRef, draftRef }, deps);
    assert.equal(again.status, "refused");
    assert.equal(again.status === "refused" ? again.reason : "", "already-pending");
    const count = await setup.query<{ n: number }>(
      "select count(*)::int as n from heby_action_requests",
    );
    assert.equal(count.rows[0]!.n, 1, "the duplicate created nothing");

    /* ── 3. A DIFFERENT DRAFT REVISION IS A DIFFERENT PROPOSAL ─────────────── */
    const revised = await reviseWorkArtifact(
      acmeCtx,
      { artifactId: draft.artifactId, content: "Merhaba Ayşe,\nSecond draft." },
      deps,
    );
    assert.equal(revised.status, "revised");
    const rev2Ref = revised.status === "revised" ? revised.ref : "";
    const secondProposal = await proposeSendAction(acmeCtx, { recipientRef, draftRef: rev2Ref }, deps);
    assert.equal(secondProposal.status, "proposed", "a different revision is a different act");
    const digests = await setup.query<{ payload_digest: string }>(
      "select payload_digest from heby_action_requests order by created_at",
    );
    assert.equal(digests.rowCount, 2);
    assert.notEqual(
      digests.rows[0]!.payload_digest,
      digests.rows[1]!.payload_digest,
      "APPROVAL FOR REVISION 1 IS NOT APPROVAL FOR REVISION 2",
    );

    /* ── 4. THE OLD PROPOSAL STAYS BOUND TO REVISION 1 ─────────────────────── */
    const stillRev1 = await setup.query<{ canonical_payload: Record<string, unknown> }>(
      "select canonical_payload from heby_action_requests where id = $1",
      [proposed.receipt.requestId],
    );
    assert.equal(
      stillRev1.rows[0]!.canonical_payload.draftRef,
      draftRef,
      "revising the artifact does NOT silently upgrade a filed proposal",
    );

    /* ── 5. NOW THE SUPERSEDED REVISION IS NOT PROPOSABLE ──────────────────── */
    const stale = await proposeSendAction(acmeCtx, { recipientRef, draftRef }, deps);
    assert.equal(stale.status, "refused");
    assert.equal(
      stale.status === "refused" ? stale.reason : "",
      "draft-superseded",
      "a NEW proposal must name the current revision; nothing is upgraded for the operator",
    );

    /* ── 6. FABRICATED, MALFORMED AND FOREIGN REFERENTS ────────────────────── */
    const ghostRecipient = "external-recipient/00000000-0000-4000-8000-000000000000";
    const ghostDraft = "work-artifact/00000000-0000-4000-8000-000000000000@1";
    for (const [label, input, expected] of [
      ["fabricated recipient", { recipientRef: ghostRecipient, draftRef: rev2Ref }, "recipient-not-found"],
      ["fabricated draft", { recipientRef, draftRef: ghostDraft }, "draft-not-found"],
      ["malformed recipient", { recipientRef: "nope", draftRef: rev2Ref }, "recipient-not-found"],
      ["malformed draft", { recipientRef, draftRef: "nope" }, "draft-not-found"],
      ["raw address as recipient", { recipientRef: "ayse@example.com", draftRef: rev2Ref }, "recipient-not-found"],
      ["raw text as draft", { recipientRef, draftRef: "Merhaba Ayşe" }, "draft-not-found"],
    ] as const) {
      const outcome = await proposeSendAction(acmeCtx, input, deps);
      assert.equal(outcome.status, "refused", `${label} must be refused`);
      assert.equal(outcome.status === "refused" ? outcome.reason : "", expected, label);
    }

    /* Another tenant's referents are indistinguishable from fabricated ones. */
    const foreign = await proposeSendAction(globexCtx, { recipientRef, draftRef: rev2Ref }, deps);
    assert.equal(foreign.status, "refused");
    assert.equal(foreign.status === "refused" ? foreign.reason : "", "recipient-not-found");

    /* ── 7. RETIRED REFERENTS ──────────────────────────────────────────────── */
    const retiredRecipientResult = await createExternalRecipient(
      acmeCtx, { displayName: "Old Contact", endpointKind: "email", endpointValue: "old@example.com" }, deps,
    );
    assert.equal(retiredRecipientResult.status, "created");
    if (retiredRecipientResult.status !== "created") return;
    await retireExternalRecipient(acmeCtx, { recipientRef: retiredRecipientResult.recipient.recordRef }, deps);
    const toRetired = await proposeSendAction(
      acmeCtx,
      { recipientRef: retiredRecipientResult.recipient.recordRef, draftRef: rev2Ref },
      deps,
    );
    assert.equal(toRetired.status, "refused");
    assert.equal(toRetired.status === "refused" ? toRetired.reason : "", "recipient-retired");

    const retiredDraft = await createWorkArtifact(
      acmeCtx, { artifactType: "message-draft", title: "Abandoned", content: "..." }, "operations", deps,
    );
    assert.equal(retiredDraft.status, "created");
    if (retiredDraft.status !== "created") return;
    await retireWorkArtifact(acmeCtx, { artifactId: retiredDraft.artifactId }, deps);
    const fromRetired = await proposeSendAction(
      acmeCtx,
      { recipientRef, draftRef: retiredDraft.ref },
      deps,
    );
    assert.equal(fromRetired.status, "refused");
    assert.equal(fromRetired.status === "refused" ? fromRetired.reason : "", "draft-retired");

    /* ── 8. UNAUTHENTICATED AND UNPERSISTED ────────────────────────────────── */
    const anon = await proposeSendAction(null, { recipientRef, draftRef: rev2Ref }, deps);
    assert.equal(anon.status === "refused" ? anon.reason : "", "unauthenticated");
    const noDb = await proposeSendAction(acmeCtx, { recipientRef, draftRef: rev2Ref }, { getDb: () => null });
    assert.equal(noDb.status === "refused" ? noDb.reason : "", "persistence-unavailable");

    /* ── 9. THE COMMAND SEAM REFUSES ANYTHING THAT IS NOT `/send` ──────────── */
    const notProposable = await runHebyProposeCommand(
      { commandId: "status", args: [recipientRef, rev2Ref] },
      { ...deps, resolveTenant: async () => acmeCtx },
    );
    assert.equal(notProposable.status, "refused");
    assert.equal(notProposable.status === "refused" ? notProposable.reason : "", "not-proposable");

    const unknown = await runHebyProposeCommand(
      { commandId: "does-not-exist", args: [] },
      { ...deps, resolveTenant: async () => acmeCtx },
    );
    assert.equal(unknown.status === "refused" ? unknown.reason : "", "unknown-command");

    const anonCommand = await runHebyProposeCommand(
      { commandId: "send", args: [recipientRef, rev2Ref] },
      { ...deps, resolveTenant: async () => null },
    );
    assert.equal(anonCommand.status, "unauthorized", "the tenant is resolved server-side, never supplied");

    /* ── 10. /approvals SEES IT — the existing R3A read path, unchanged ─────── */
    const pending = await readPendingActionRequests(acmeCtx, deps);
    assert.equal(pending.status, "read");
    if (pending.status !== "read") return;
    const seen = pending.items.find((r) => r.requestId === proposed.receipt.requestId);
    assert.ok(seen, "the exact filed request appears on the review surface");

    /*
     * THE DIRECTOR CAN SEE THE FROZEN PAYLOAD, digests included. All four scalars are inspectable —
     * a human is not asked to approve a binding they cannot read.
     *
     * APP-2 REPAIRED THIS PIN RATHER THAN WEAKENING IT. It used to require all four to appear in
     * `parameters`, because that is where all four were rendered. APP-2 splits the payload: the two
     * decision facts stay parameters, and the two integrity values become `locks`, shown as what
     * they mean with the raw value one disclosure away. The SHAPE moved; the guarantee did not, so
     * the pin now asserts the guarantee directly — nothing from the canonical payload is dropped —
     * and additionally pins WHICH half each key lands in. That is strictly stronger than what it
     * replaced: the old form would have passed a build that silently discarded a lock.
     */
    const names = seen!.parameters.map((p) => p.name);
    const lockNames = seen!.locks.map((l) => l.name);
    assert.deepEqual(
      [...names, ...lockNames].sort(),
      ["draftRef", "draftRevisionDigest", "recipientEndpointDigest", "recipientRef"],
      "all four bound scalars are still visible for review — none is dropped by the split",
    );
    assert.deepEqual(
      [...lockNames].sort(),
      ["draftRevisionDigest", "recipientEndpointDigest"],
      "and the integrity values are the ones presented as locks",
    );
    /* The raw digest survives the move — a lock is re-presented, never discarded. */
    assert.equal(
      seen!.locks.find((l) => l.name === "recipientEndpointDigest")!.value,
      recipient.recipient.endpointDigest,
      "the lock still carries the exact digest the server froze",
    );
    /* And the proposer is now readable, which is what A1a made truthful and nothing had read. */
    assert.equal(seen!.proposedByActorType, "human", "the review surface shows who proposed it");
    assert.equal(seen!.parameters.find((p) => p.name === "recipientRef")!.value, recipientRef);
    assert.equal(seen!.payloadDigest, digests.rows[0]!.payload_digest);
    assert.equal(seen!.sideEffect, "CONSEQUENTIAL_MUTATION");

    /* Foreign tenant sees none of them. */
    const foreignView = await readPendingActionRequests(globexCtx, deps);
    assert.equal(foreignView.status === "read" ? foreignView.items.length : -1, 0, "tenant isolation on review");

    /* ── 11. RECONNECT DURABILITY ──────────────────────────────────────────── */
    await handle.dispose();
    handle = createControlPlaneDb(harness.dbUrl);
    const afterReconnect = await readPendingActionRequests(acmeCtx, { getDb: () => handle.db });
    assert.ok(
      afterReconnect.status === "read" &&
        afterReconnect.items.some((r) => r.requestId === proposed.receipt.requestId),
      "the proposal is durable across a fresh connection",
    );

    /* ── 12. NOTHING WAS AUTHORIZED, DECIDED, AUDITED OR EXECUTED ──────────── */
    for (const table of [
      "action_permits",
      "decision_records",
      "governance_sessions",
      "audit_log",
      "executions",
    ]) {
      const rows = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(rows.rows[0]!.n, 0, `filing a proposal must not write ${table}`);
    }
    /* And it created no recipient and no artifact of its own. */
    const recipients = await setup.query<{ n: number }>("select count(*)::int as n from external_recipients");
    assert.equal(recipients.rows[0]!.n, 2, "only the two a human created");
    const artifacts = await setup.query<{ n: number }>("select count(*)::int as n from work_artifacts");
    assert.equal(artifacts.rows[0]!.n, 2, "only the two a human created");
  } finally {
    await handle.dispose().catch(() => {});
    await setup.end().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS r3a1 send proposal inlet (postgres)");
}

void main();
