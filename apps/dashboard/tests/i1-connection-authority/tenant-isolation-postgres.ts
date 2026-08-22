/*
 * I1 CONNECTION AUTHORITY — TENANT ISOLATION AND STATE HONESTY, AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "One tenant's connections are unreachable, unlistable and unchangeable from another tenant's
 *    session; a connection Hebun creates is a DRAFT and can never become `connected`; and the
 *    predicate that makes the first half true is load-bearing rather than incidental."
 *
 * The last clause is why the bite-proof at the end exists. A tenant test that would still pass
 * with the tenant predicate deleted proves that the ids did not collide, not that isolation works.
 *
 * Disposable database, dropped on exit. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import { Client } from "pg";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { integrations } from "../../src/db/schema/integration";
import { auditLog } from "../../src/db/schema/audit-log";
import {
  createConnection,
  disconnectConnection,
  listConnections,
  readConnection,
} from "../../src/features/integration-authority/integration-repository.server";
import { verifyConnection } from "../../src/features/integration-authority/verify-connection.server";
import { readIntegrationLifecycleHistory } from "../../src/features/governance-audit/integration-lifecycle-audit.server";
import {
  I1_PRODUCIBLE_STATES,
  NO_CREDENTIAL_AUTHORITY,
  type ConnectionDefinition,
  type ProviderCatalog,
} from "../../src/features/integration-authority/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const ACTOR_A = "20000000-0000-4000-8000-00000000a002";
const ACTOR_B = "20000000-0000-4000-8000-00000000b002";
const ABSENT_ID = "40000000-0000-4000-8000-0000000000ff";

const NOW = new Date("2026-08-22T12:00:00.000Z");

/**
 * A TEST-ONLY catalog carrying a `connectable` entry.
 *
 * The RELEASED catalog has none, by design — nothing in this deployment can be connected. Injecting
 * one here is what lets the repository and the state machine be exercised at all, and it is the
 * ONLY place in this repository where `connectable` appears as a value. `catalog-honesty` asserts
 * the released catalog still has zero.
 */
const FIXTURE_CATALOG: ProviderCatalog = Object.freeze([
  Object.freeze({
    providerKey: "test-connectable",
    label: "Test Connectable Provider (test fixture only)",
    authMethod: "api_key",
    accountIdentity: "account",
    connectivity: "connectable",
    minimumScopes: Object.freeze(["test.read"]),
    capabilityScopes: Object.freeze({
      "test.capability": Object.freeze({
        read: Object.freeze(["test.read"]),
        write: Object.freeze(["test.write"]),
      }),
    }),
  }) satisfies ConnectionDefinition,
  Object.freeze({
    providerKey: "test-fixture-only",
    label: "Test Fixture Provider (not connectable)",
    authMethod: "api_key",
    accountIdentity: "account",
    connectivity: "fixture",
    minimumScopes: Object.freeze([]),
    capabilityScopes: Object.freeze({}),
  }) satisfies ConnectionDefinition,
]);

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, requestId: "test-request" } as TenantContext;
}

async function seedTenants(client: Client): Promise<void> {
  await client.query(
    `insert into companies (id, name, slug) values ($1,$2,$3), ($4,$5,$6)`,
    [TENANT_A, "Acme", "acme-i1", TENANT_B, "Globex", "globex-i1"],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_tenant");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const db = handle.db;
  const deps = { getDb: () => db, now: () => NOW, catalog: FIXTURE_CATALOG } as const;

  try {
    await seedTenants(client);

    const a = tenantOf(TENANT_A, ACTOR_A);
    const b = tenantOf(TENANT_B, ACTOR_B);

    /* ── 1. CREATION PRODUCES A DRAFT, AND ONLY A DRAFT ──────────────────────── */
    const created = await createConnection(
      a,
      { providerKey: "test-connectable", name: "Acme connection" },
      deps,
    );
    assert.equal(created.status, "created", "a connectable provider must be recordable");
    assert.ok(created.status === "created");
    const aId = created.connection.integrationId;

    assert.equal(created.connection.connectionState, "draft", "creation produces a DRAFT");
    assert.equal(created.connection.health, "unknown", "nothing has been attempted");
    assert.deepEqual(created.connection.scopes, [], "no scope has ever been observed");
    assert.equal(created.connection.externalAccountId, null, "no account has been resolved");
    assert.equal(created.connection.lastVerifiedAt, null, "nothing has been verified");
    assert.equal(created.connection.revokedAt, null);

    /*
     * THE PHASE BOUNDARY, MEASURED. A view that carried any credential-shaped field would let a
     * consumer believe a secret exists. None of these names is a property of the returned object.
     */
    for (const forbidden of [
      "credential",
      "secret",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
      "ciphertext",
      "writeAuthorized",
      "permit",
    ]) {
      assert.ok(
        !(forbidden in (created.connection as unknown as Record<string, unknown>)),
        `IntegrationView must not carry "${forbidden}"`,
      );
    }

    /* ── 2. THE CATALOG IS THE AUTHORITY, NOT THE DATABASE ───────────────────── */
    {
      const unknown = await createConnection(a, { providerKey: "not-in-catalog", name: "X" }, deps);
      assert.deepEqual(
        unknown,
        { status: "refused", reason: "unknown-provider" },
        "a provider key with no catalog entry is not a provider",
      );

      const fixture = await createConnection(
        a,
        { providerKey: "test-fixture-only", name: "X" },
        deps,
      );
      assert.deepEqual(
        fixture,
        { status: "refused", reason: "provider-not-connectable" },
        "a fixture definition is real and still not connectable — its own reason",
      );

      /*
       * A ROW CANNOT INVENT A PROVIDER. `providers` is written directly here, which is exactly the
       * privilege the frozen catalog exists to neutralise, and the create still refuses.
       */
      await client.query(
        `insert into providers (id, key, name, status) values ($1,$2,$3,'live')`,
        ["50000000-0000-4000-8000-000000000001", "smuggled-provider", "Smuggled"],
      );
      const smuggled = await createConnection(
        a,
        { providerKey: "smuggled-provider", name: "X" },
        deps,
      );
      assert.deepEqual(
        smuggled,
        { status: "refused", reason: "unknown-provider" },
        "inserting a providers row must not make a provider connectable",
      );
    }

    /* ── 3. TENANT B CREATES ITS OWN, WITH THE SAME PROVIDER ─────────────────── */
    const bCreated = await createConnection(
      b,
      { providerKey: "test-connectable", name: "Globex connection" },
      deps,
    );
    assert.ok(bCreated.status === "created");
    const bId = bCreated.connection.integrationId;
    assert.notEqual(aId, bId);

    /* ── 4. TENANT A CANNOT READ, LIST, VERIFY OR DISCONNECT TENANT B'S ROW ──── */
    assert.equal(await readConnection(a, bId, deps), null, "A cannot READ B's connection");
    assert.equal(await readConnection(b, aId, deps), null, "B cannot READ A's connection");
    assert.equal(
      await readConnection(a, ABSENT_ID, deps),
      null,
      "an absent id reads exactly as a foreign one — the difference is never disclosed",
    );

    {
      const listA = await listConnections(a, deps);
      assert.ok(listA.status === "read");
      assert.deepEqual(
        listA.connections.map((c) => c.integrationId),
        [aId],
        "A cannot LIST B's connection",
      );
      const listB = await listConnections(b, deps);
      assert.ok(listB.status === "read");
      assert.deepEqual(listB.connections.map((c) => c.integrationId), [bId]);
    }

    {
      const foreign = await verifyConnection(a, bId, deps);
      assert.deepEqual(
        foreign,
        { ok: false, reason: "not-found" },
        "A cannot VERIFY B's connection, and is told not-found rather than the credential reason",
      );
    }

    {
      const foreign = await disconnectConnection(a, bId, deps);
      assert.deepEqual(
        foreign,
        { status: "refused", reason: "not-found" },
        "A cannot DISCONNECT B's connection",
      );
      /* B's row is byte-identical afterwards — the refusal wrote nothing. */
      const untouched = await readConnection(b, bId, deps);
      assert.deepEqual(untouched, bCreated.connection, "B's row must be unchanged");
    }

    /* ── 5. VERIFICATION REFUSES, HONESTLY, AND WRITES NOTHING ───────────────── */
    {
      const own = await verifyConnection(a, aId, deps);
      assert.deepEqual(
        own,
        { ok: false, reason: NO_CREDENTIAL_AUTHORITY },
        "verification of one's OWN connection refuses with the missing authority",
      );
      const after = await readConnection(a, aId, deps);
      assert.deepEqual(
        after,
        created.connection,
        "a refusal to attempt is not a failed attempt — no state, health or error is written",
      );
    }

    /* ── 6. THE STATE MACHINE: I1 CAN ONLY PRODUCE draft AND disconnected ────── */
    assert.deepEqual(
      [...I1_PRODUCIBLE_STATES].sort(),
      ["disconnected", "draft"],
      "the phase boundary is exactly two states",
    );

    {
      /* NO ROW ANYWHERE reached a state I1 cannot produce. */
      const states = await client.query<{ connection_state: string }>(
        `select distinct connection_state from integrations`,
      );
      assert.deepEqual(
        states.rows.map((r) => r.connection_state).sort(),
        ["draft"],
        "nothing Hebun wrote is anything but draft",
      );
    }

    /* ── 7. DISCONNECT IS THE ONE TRANSITION, AND TERMINAL IS TERMINAL ───────── */
    {
      const gone = await disconnectConnection(a, aId, deps);
      assert.ok(gone.status === "transitioned");
      assert.equal(gone.connection.connectionState, "disconnected");
      assert.equal(gone.connection.revokedAt, NOW.toISOString());
      assert.equal(gone.connection.health, "unknown", "ending a record claims nothing about health");

      const again = await disconnectConnection(a, aId, deps);
      assert.deepEqual(
        again,
        { status: "refused", reason: "illegal-transition" },
        "a terminal row never transitions again",
      );
    }

    /* ── 8. THE PARTIAL UNIQUE INDEX: LIVE DUPLICATES REFUSED, RECONNECT ALLOWED ── */
    {
      /*
       * `external_account_id` is NULL on every row Hebun creates in I1, and PostgreSQL treats NULLs
       * as distinct in a unique index. So the constraint is exercised where it will actually apply:
       * on rows carrying a resolved account. These are written DIRECTLY as FIXTURES — the
       * repository cannot produce them, which is the point of section 6.
       */
      const live = "60000000-0000-4000-8000-000000000001";
      await client.query(
        `insert into integrations (id, tenant_id, name, provider_key, connection_state, external_account_id)
         values ($1,$2,'fixture live','test-connectable','connected','acct-1')`,
        [live, TENANT_A],
      );

      await assert.rejects(
        client.query(
          `insert into integrations (id, tenant_id, name, provider_key, connection_state, external_account_id)
           values ($1,$2,'fixture duplicate','test-connectable','draft','acct-1')`,
          ["60000000-0000-4000-8000-000000000002", TENANT_A],
        ),
        /duplicate key value|unique/i,
        "a second LIVE connection to the same account in the same tenant is refused",
      );

      /* THE SAME EXTERNAL ACCOUNT UNDER A DIFFERENT TENANT IS LEGITIMATE. */
      await client.query(
        `insert into integrations (id, tenant_id, name, provider_key, connection_state, external_account_id)
         values ($1,$2,'fixture other tenant','test-connectable','connected','acct-1')`,
        ["60000000-0000-4000-8000-000000000003", TENANT_B],
      );

      /* A TERMINAL ROW DOES NOT BLOCK A RECONNECT — the index is partial for this reason. */
      await client.query(
        `update integrations set connection_state='disconnected' where id=$1`,
        [live],
      );
      await client.query(
        `insert into integrations (id, tenant_id, name, provider_key, connection_state, external_account_id)
         values ($1,$2,'fixture reconnect','test-connectable','draft','acct-1')`,
        ["60000000-0000-4000-8000-000000000004", TENANT_A],
      );
    }

    /* ── 9. AUDIT: TWO EVENTS, TENANT-SCOPED, AND NO SECRET-SHAPED METADATA ──── */
    {
      const history = await readIntegrationLifecycleHistory(a, { getDb: () => db });
      assert.ok(history.status === "read");
      assert.deepEqual(
        history.records.map((r) => r.action).sort(),
        ["integration.connection.created", "integration.connection.disconnected"],
        "exactly the two events I1 can honestly produce",
      );
      for (const record of history.records) {
        assert.equal(record.actorId, ACTOR_A, "the actor is the acting human, from the session");
      }

      const bHistory = await readIntegrationLifecycleHistory(b, { getDb: () => db });
      assert.ok(bHistory.status === "read");
      assert.deepEqual(
        bHistory.records.map((r) => r.entityId),
        [bId],
        "audit reads are tenant-scoped — A's events are invisible to B",
      );

      /* Nothing an I2 event would claim is present. */
      const rows = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityType, "integration"));
      for (const row of rows) {
        const metadata = row.metadata as Record<string, unknown>;
        assert.equal(metadata.credentialStored, false, "no credential is ever stored in I1");
        assert.equal(metadata.verified, false, "nothing is ever verified in I1");
        assert.equal(row.previousState, null, "no jsonb state blob beside a credential domain");
        assert.equal(row.nextState, null);
        const serialized = JSON.stringify(row);
        for (const forbidden of ["secret", "token", "ciphertext", "apiKey", "password"]) {
          assert.ok(
            !serialized.toLowerCase().includes(forbidden.toLowerCase()),
            `audit row must not contain "${forbidden}"`,
          );
        }
      }

      const actions = await client.query<{ action: string }>(
        `select distinct action from audit_log where entity_type = 'integration'`,
      );
      for (const { action } of actions.rows) {
        assert.ok(
          !/credential|verification|refresh|scopes|revoked/.test(action),
          `I1 must not emit the I2 event "${action}"`,
        );
      }

      /* `event_log` is NOT activated by this phase. */
      const events = await client.query<{ count: string }>(`select count(*) from event_log`);
      assert.equal(events.rows[0]!.count, "0", "event_log stays inactive");
    }

    /* ── 10. THE BITE-PROOF: THE TENANT PREDICATE IS LOAD-BEARING ────────────── */
    {
      /*
       * `readConnection(a, bId)` returned null above. That alone does NOT prove isolation — it
       * would also be true if the row simply were not there. So the SAME query is run twice against
       * the SAME data: once with the tenant clause the repository composes, and once WITHOUT it.
       *
       * With the predicate: 0 rows. Without it: 1 row. The row is reachable, and the predicate is
       * the only thing standing in front of it.
       */
      const withPredicate = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(and(eq(integrations.id, bId), eq(integrations.tenantId, a.tenantId)));
      assert.equal(withPredicate.length, 0, "with the tenant predicate, B's row is unreachable");

      const withoutPredicate = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(eq(integrations.id, bId));
      assert.equal(
        withoutPredicate.length,
        1,
        "WITHOUT the tenant predicate the very same row IS returned — so the predicate is what " +
          "makes the isolation above true, and deleting it would turn this test red",
      );
    }

    console.log("i1-connection-authority/tenant-isolation-postgres: all assertions passed");
  } finally {
    await client.end();
    await handle.dispose();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
