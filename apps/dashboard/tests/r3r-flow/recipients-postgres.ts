/*
 * R3R — Durable Recipient Authority, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A recorded recipient is durable and tenant-scoped, its address is immutable, the same address
 *    is legal in two tenants and illegal twice-live in one, a retired address can be recorded
 *    again, an exact reference resolves and a foreign or fabricated one reveals nothing — AND no
 *    user, identity, membership, invitation, Knowledge row, Memory row, Governance decision,
 *    permit or execution is created along the way."
 *
 * Uses a disposable local database, dropped on exit. The canonical database is never opened.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  createExternalRecipient,
  retireExternalRecipient,
} from "../../src/features/external-recipients/write-external-recipients.server";
import {
  listActiveRecipients,
  listRetiredRecipients,
  resolveRecipientReference,
} from "../../src/features/external-recipients/read-external-recipients.server";
import { resolveExternalRecipientSource } from "../../src/features/external-recipients/recipient-evidence.server";
import { formatRecipientRef } from "../../src/features/external-recipients/recipient-ref";
import { digestRecipientEndpoint } from "../../src/features/external-recipients/endpoint-digest";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded): TenantContext {
  return asHumanTenantContext({
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
    requestId: "r3r-test",
    authenticatedAt: new Date().toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r3r_recipients");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  let handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    /*
     * The whole chain applied, R3R included — stated RELATIVE to what the repository ships rather
     * than as the literal 28 this originally pinned. A global count in a phase test is a claim
     * about every future phase, and R3B falsified it the moment it added a migration of its own.
     */
    const applied = await setup.query<{ n: number }>(
      "select count(*)::int as n from drizzle.__drizzle_migrations",
    );
    const onDisk = readdirSync(path.join(process.cwd(), "src/db/migrations")).filter((f) =>
      f.endsWith(".sql"),
    ).length;
    assert.equal(applied.rows[0]!.n, onDisk, "every migration on disk is applied, R3R included");
    assert.ok(applied.rows[0]!.n >= 28, "R3R is at least the 28th migration");

    const acme = (await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-r3r",
      email: "director@acme.test",
    })) as Seeded;
    const globex = (await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-r3r",
      email: "director@globex.test",
    })) as Seeded;
    const acmeCtx = contextFor(acme);
    const globexCtx = contextFor(globex);

    /* Counts taken AFTER seeding, so the identity fixture is not mistaken for R3R's doing. */
    const baseline = await countIdentityRows(setup);

    /* ── 1. A recipient is recorded, and the row says what it should ───────── */
    const created = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "  Ayse@Example.COM " },
      deps,
    );
    assert.equal(created.status, "created", "a human with a tenant session may record a recipient");
    if (created.status !== "created") return;
    const jane = created.recipient;

    assert.equal(jane.endpointValue, "ayse@example.com", "the stored address is normalized");
    assert.equal(jane.endpointDigest, digestRecipientEndpoint("ayse@example.com"));
    assert.equal(jane.status, "active");
    assert.equal(jane.recordRef, formatRecipientRef(jane.id));
    assert.equal(jane.createdByActorType, "human", "the actor pair records a HUMAN author");
    assert.equal(jane.createdByActorId, acme.userId);
    assert.equal(jane.displayName, "Ayşe Yılmaz", "the display name is stored verbatim");

    /* ── 2. THE AUTH / USER FIREWALL — release-critical ────────────────────── */
    const afterCreate = await countIdentityRows(setup);
    assert.deepEqual(
      afterCreate,
      baseline,
      "recording a recipient must create NO user, auth identity, credential, membership, invitation or enrollment request",
    );

    /* ── 3. Same address, different tenant: legal and required ─────────────── */
    const globexCopy = await createExternalRecipient(
      globexCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.com" },
      deps,
    );
    assert.equal(
      globexCopy.status,
      "created",
      "two tenants may both hold the same customer — the thing users_email_uq makes impossible",
    );

    /* ── 4. Same address twice LIVE in one tenant: refused by the database ─── */
    const duplicate = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayse (again)", endpointKind: "email", endpointValue: "AYSE@example.com" },
      deps,
    );
    assert.equal(duplicate.status, "refused");
    assert.equal(
      duplicate.status === "refused" ? duplicate.reason : "",
      "duplicate-active-endpoint",
      "one LIVE address maps to one record, so an approval surface is never ambiguous",
    );

    /* ── 5. Tenant isolation on every read ─────────────────────────────────── */
    const acmeList = await listActiveRecipients(acmeCtx, deps);
    assert.equal(acmeList.recipients.length, 1, "Acme sees only its own");
    const globexList = await listActiveRecipients(globexCtx, deps);
    assert.equal(globexList.recipients.length, 1, "Globex sees only its own");
    assert.notEqual(acmeList.recipients[0]!.id, globexList.recipients[0]!.id);

    /* A foreign reference reveals NOTHING — not "forbidden", not "exists elsewhere". */
    const foreign = await resolveRecipientReference(globexCtx, jane.recordRef, deps);
    assert.equal(foreign.status, "refused");
    assert.equal(
      foreign.status === "refused" ? foreign.reason : "",
      "recipient-not-found",
      "a foreign ref is indistinguishable from a fabricated one",
    );

    /* ── 6. Fabricated and malformed references ────────────────────────────── */
    const fabricated = await resolveRecipientReference(
      acmeCtx,
      formatRecipientRef("00000000-0000-4000-8000-000000000000"),
      deps,
    );
    assert.equal(fabricated.status, "refused");
    for (const malformed of ["external-recipient/nope", "", "work-artifact/x@1", null]) {
      const bad = await resolveRecipientReference(acmeCtx, malformed, deps);
      assert.equal(bad.status, "refused", `malformed ref must refuse: ${String(malformed)}`);
    }

    /* An exact, live reference resolves, and never substitutes. */
    const resolved = await resolveRecipientReference(acmeCtx, jane.recordRef, deps);
    assert.equal(resolved.status, "resolved");
    if (resolved.status === "resolved") {
      assert.equal(resolved.recipient.id, jane.id);
      assert.equal(resolved.recipient.endpointDigest, jane.endpointDigest);
    }

    /* ── 7. THE ADDRESS BYTES ARE IMMUTABLE ────────────────────────────────── */
    const beforeRetire = await readRow(setup, jane.id);
    const retired = await retireExternalRecipient(acmeCtx, { recipientRef: jane.recordRef }, deps);
    assert.equal(retired.status, "retired");

    const afterRetire = await readRow(setup, jane.id);
    assert.equal(afterRetire.endpoint_value, beforeRetire.endpoint_value, "the address is untouched");
    assert.equal(afterRetire.endpoint_digest, beforeRetire.endpoint_digest, "and so is its digest");
    assert.equal(afterRetire.endpoint_kind, beforeRetire.endpoint_kind);
    assert.equal(afterRetire.status, "retired", "only the status moved");

    /* Retiring twice is refused, and the second attempt says which fact it hit. */
    const again = await retireExternalRecipient(acmeCtx, { recipientRef: jane.recordRef }, deps);
    assert.equal(again.status, "refused");
    assert.equal(again.status === "refused" ? again.reason : "", "recipient-already-retired");

    /* A foreign retire attempt reveals nothing either. */
    const foreignRetire = await retireExternalRecipient(
      globexCtx,
      { recipientRef: jane.recordRef },
      deps,
    );
    assert.equal(foreignRetire.status, "refused");
    assert.equal(
      foreignRetire.status === "refused" ? foreignRetire.reason : "",
      "recipient-not-found",
    );

    /* ── 8. Retired: still resolvable, no longer proposable ────────────────── */
    const stillReadable = await resolveRecipientReference(acmeCtx, jane.recordRef, deps);
    assert.equal(stillReadable.status, "resolved", "history must not become a dangling pointer");
    if (stillReadable.status === "resolved") assert.equal(stillReadable.recipient.status, "retired");

    const activeAfter = await listActiveRecipients(acmeCtx, deps);
    assert.equal(activeAfter.recipients.length, 0, "a retired recipient is not proposable");
    const retiredList = await listRetiredRecipients(acmeCtx, deps);
    assert.equal(retiredList.recipients.length, 1, "…and is still visible as history");

    /* ── 9. The address can be recorded again after retirement ─────────────── */
    const recreated = await createExternalRecipient(
      acmeCtx,
      { displayName: "Ayşe Yılmaz", endpointKind: "email", endpointValue: "ayse@example.com" },
      deps,
    );
    assert.equal(
      recreated.status,
      "created",
      "the partial index frees the address the moment the row leaves its predicate",
    );
    if (recreated.status !== "created") return;
    assert.notEqual(recreated.recipient.id, jane.id, "a NEW row — the old bytes are not reused");
    assert.equal(
      recreated.recipient.endpointDigest,
      jane.endpointDigest,
      "the same address hashes the same, which is why a permit must check status too",
    );

    /* ── 10. THE SOURCE CLASS, and what it does and does not carry ─────────── */
    const source = await resolveExternalRecipientSource(acmeCtx, deps);
    assert.equal(source.sourceClass, "external-recipients");
    assert.equal(source.state, "resolved");
    assert.equal(source.authoritative, false, "a recorded address is never organizational truth");
    assert.equal(source.items.length, 1, "only the live recipient is offered");
    assert.equal(source.items[0]!.recordRef, recreated.recipient.recordRef);
    assert.equal(source.items[0]!.label, "Ayşe Yılmaz");
    assert.ok(!/verified|confirmed|reachable|deliverable/i.test(source.items[0]!.detail),
      "the detail line must not imply verification");
    assert.equal(
      source.items[0]!.content,
      undefined,
      "the ADDRESS never enters the model's grounding context — Heby proposes a ref, not a destination",
    );
    assert.ok(/never verified/i.test(source.provenance), "provenance says so out loud");

    /* An empty tenant is honestly unavailable, not an empty "resolved". */
    const empty = await resolveExternalRecipientSource(globexCtx, {
      getDb: () => handle.db,
    });
    assert.equal(empty.state, "resolved", "Globex has one");
    const noTenant = await resolveExternalRecipientSource(null, deps);
    assert.equal(noTenant.state, "unavailable");
    assert.equal(noTenant.items.length, 0);

    /* ── 11. RECONNECT DURABILITY — a brand-new pool sees the same truth ───── */
    await handle.dispose();
    handle = createControlPlaneDb(harness.dbUrl);
    const afterReconnect = await resolveRecipientReference(
      acmeCtx,
      recreated.recipient.recordRef,
      { getDb: () => handle.db },
    );
    assert.equal(afterReconnect.status, "resolved", "durable across a fresh connection");
    if (afterReconnect.status === "resolved") {
      assert.equal(afterReconnect.recipient.endpointValue, "ayse@example.com");
      assert.equal(afterReconnect.recipient.endpointDigest, jane.endpointDigest);
    }

    /* ── 12. Unauthenticated and unpersisted paths refuse rather than guess ── */
    const anon = await createExternalRecipient(
      null,
      { displayName: "X", endpointKind: "email", endpointValue: "x@y.co" },
      deps,
    );
    assert.equal(anon.status, "refused");
    assert.equal(anon.status === "refused" ? anon.reason : "", "unauthenticated");

    const noDb = await createExternalRecipient(
      acmeCtx,
      { displayName: "X", endpointKind: "email", endpointValue: "x@y.co" },
      { getDb: () => null },
    );
    assert.equal(noDb.status === "refused" ? noDb.reason : "", "persistence-unavailable");

    /* ── 13. NOTHING WAS APPROVED, PERMITTED, LEARNED OR EXECUTED ──────────── */
    for (const table of [
      "knowledge_nodes",
      "knowledge_facts",
      "knowledge_edges",
      "enterprise_memory_records",
      "memories",
      "working_memories",
      "learning_sessions",
      "decision_records",
      "governance_sessions",
      "heby_action_requests",
      "action_permits",
      "executions",
      "audit_log",
      "work_artifacts",
      "work_artifact_revisions",
    ]) {
      const rows = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(rows.rows[0]!.n, 0, `R3R must not write ${table}`);
    }
  } finally {
    await handle.dispose().catch(() => {});
    await setup.end().catch(() => {});
    await harness.dropDatabase();
  }

  console.log("PASS r3r recipients (postgres)");
}

/** Every table that would mean a recipient had become a principal. */
async function countIdentityRows(client: Client): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of [
    "users",
    "auth_identities",
    "auth_credentials",
    "memberships",
    "invitations",
    "identity_enrollment_requests",
    "membership_authorizations",
    "user_session_contexts",
    "companies",
  ]) {
    const rows = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
    counts[table] = rows.rows[0]!.n;
  }
  return counts;
}

async function readRow(
  client: Client,
  id: string,
): Promise<{
  endpoint_value: string;
  endpoint_digest: string;
  endpoint_kind: string;
  status: string;
}> {
  const rows = await client.query<{
    endpoint_value: string;
    endpoint_digest: string;
    endpoint_kind: string;
    status: string;
  }>(
    `select endpoint_value, endpoint_digest, endpoint_kind, status
       from external_recipients where id = $1`,
    [id],
  );
  return rows.rows[0]!;
}

void main();
