/*
 * G4 — THE PRODUCTION-CAPABLE CEREMONY, PROVED AGAINST A REAL PostgreSQL DATABASE.
 *
 * THE CLAIM UNDER TEST. The production posture binds to ONE cluster and ONE database and refuses
 * every other target; the production root is written into the rows the released G1 vocabulary
 * admits; the bootstrap transaction is still closed at three tables; the first human is still
 * refused; and preflight mutates nothing.
 *
 * WHY A DISPOSABLE LOCAL DATABASE PROVES A PRODUCTION BINDING. The binding is
 * `pg_control_system().system_identifier` — a fact of the CLUSTER, not of the network. A disposable
 * database on the local cluster reports a real identifier and a distinct `current_database()`, so
 * every branch of `verifyProductionTarget` is exercised against a real server: bound, wrong
 * identifier, wrong database, incomplete ledger. What is NOT exercised here is the loopback refusal
 * — that is an environment-only decision proved by execution in `possession-and-firewall.ts`, and
 * it is the reason this file never needs a remote database.
 *
 * NOTHING IN THIS FILE TOUCHES THE REAL PRODUCTION DATABASE. The harness is localhost-only by
 * construction and refuses any other admin URL.
 *
 * FIXTURES ARE STATE-RELATIVE: counts are measured before an act and compared after it, so a later
 * phase that adds a table or a migration does not falsify this file.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb } from "../../src/db/client.server";
import {
  CEREMONY_SOURCE_LOCAL,
  CEREMONY_SOURCE_PRODUCTION,
  type ProductionPosture,
  verifyProductionTarget,
} from "../../scripts/lib/production-possession";
import { authoredMigrationCount, preflight } from "../../scripts/lib/ceremony-preflight";
import { provisionTenant, findTenantBySlug } from "../../scripts/lib/provision-tenant";
import {
  nominateGenesisHuman,
  resolveNominationTarget,
} from "../../scripts/lib/nominate-genesis-human";

void createControlPlaneDb;

interface Human {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly email: string;
}

async function seedHuman(client: Client, email: string): Promise<Human> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1, $1) returning id`,
    [email],
  );
  const userId = user.rows[0]!.id;
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1, 'local', 'hebun-local', $2, 'active', true, now()) returning id`,
    [userId, `local:${email}`],
  );
  return { userId, authIdentityId: identity.rows[0]!.id, email };
}

const count = async (client: Client, table: string): Promise<number> => {
  const r = await client.query<{ n: string }>(`select count(*)::text as n from "${table}"`);
  return Number(r.rows[0]!.n);
};

/*
 * SEQUENTIAL on purpose. One `Client` executes one query at a time; `Promise.all` over the same
 * client emits pg's already-executing deprecation and is removed in pg@9. The counts are a snapshot
 * of an idle database, so ordering costs nothing.
 */
const countAll = async (client: Client, tables: readonly string[]): Promise<number[]> => {
  const out: number[] = [];
  for (const table of tables) out.push(await count(client, table));
  return out;
};

const SNAPSHOT = [
  "companies",
  "roles",
  "memberships",
  "genesis_nominations",
  "users",
  "audit_log",
] as const;

const productionPosture = (systemIdentifier: string, database: string): ProductionPosture =>
  ({
    mode: "production",
    source: CEREMONY_SOURCE_PRODUCTION,
    expected: { systemIdentifier, database },
  }) as const;

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g4_production");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();

    const authored = authoredMigrationCount();
    const identity = await client.query<{ sid: string; db: string }>(
      `select system_identifier::text as sid, current_database() as db from pg_control_system()`,
    );
    const REAL_SID = identity.rows[0]!.sid;
    const REAL_DB = identity.rows[0]!.db;

    /* ══════════════════════════════════════════════════════════════════════
     * 1. TARGET BINDING against a real server: one target is accepted.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const bound = await verifyProductionTarget(
        client,
        { systemIdentifier: REAL_SID, database: REAL_DB },
        authored,
      );
      assert.equal(bound.status, "bound", "the pinned target must bind");
      assert.equal(bound.status === "bound" && bound.observed.systemIdentifier, REAL_SID);
      assert.equal(bound.status === "bound" && bound.observed.database, REAL_DB);
      assert.equal(bound.status === "bound" && bound.observed.appliedMigrations, authored);
    }

    /* ── …and every other target is refused. ───────────────────────────── */
    {
      /*
       * A DIFFERENT cluster identifier. This is the whole point of the binding: a valid credential
       * on a reachable, correctly-migrated, structurally identical Hebun database is still refused
       * when it is not the pinned one.
       */
      const wrongCluster = await verifyProductionTarget(
        client,
        { systemIdentifier: "1234567890123456789", database: REAL_DB },
        authored,
      );
      assert.equal(wrongCluster.status, "refused");
      assert.equal(
        wrongCluster.status === "refused" && wrongCluster.reason,
        "system-identifier-mismatch",
      );

      /* The right cluster, the wrong database on it. */
      const wrongDatabase = await verifyProductionTarget(
        client,
        { systemIdentifier: REAL_SID, database: "some_other_database" },
        authored,
      );
      assert.equal(wrongDatabase.status, "refused");
      assert.equal(wrongDatabase.status === "refused" && wrongDatabase.reason, "database-mismatch");

      /* The right target, an out-of-date ledger. */
      const staleLedger = await verifyProductionTarget(
        client,
        { systemIdentifier: REAL_SID, database: REAL_DB },
        authored + 1,
      );
      assert.equal(staleLedger.status, "refused");
      assert.equal(staleLedger.status === "refused" && staleLedger.reason, "ledger-incomplete");
    }

    /*
     * THE MEASUREMENT THAT SHAPED THE DESIGN, re-proved here: this disposable database and the
     * canonical one share a ledger digest, because they share a release. A schema fingerprint
     * cannot distinguish two Hebun deployments — only the cluster identifier can.
     */
    {
      const digest = await client.query<{ d: string; n: string }>(
        `select md5(string_agg(hash, ',' order by created_at, id)) as d, count(*)::text as n
           from drizzle.__drizzle_migrations`,
      );
      assert.equal(Number(digest.rows[0]!.n), authored, "the disposable carries the full ledger");
      assert.equal(
        digest.rows[0]!.d,
        "212559d177d44b3f15aeaa0df78e6799",
        "…and its digest equals the canonical and production one — the ledger is not an identity",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 2. PREFLIGHT MUTATES NOTHING — measured, not asserted from source.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const before = await countAll(client, SNAPSHOT);
      const ready = await preflight(client, productionPosture(REAL_SID, REAL_DB), {
        provenance: "company",
        expectedMigrations: authored,
      });
      assert.equal(ready.status, "ready", "the bound target is ready");
      const readyGenesis = await preflight(client, productionPosture(REAL_SID, REAL_DB), {
        provenance: "genesis",
        expectedMigrations: authored,
      });
      assert.equal(readyGenesis.status, "ready");

      const after = await countAll(client, SNAPSHOT);
      assert.deepEqual(after, before, "preflight wrote nothing");
      /* And a REFUSED preflight writes nothing either. */
      const refused = await preflight(client, productionPosture("999", REAL_DB), {
        provenance: "company",
        expectedMigrations: authored,
      });
      assert.equal(refused.status, "refused");
      assert.deepEqual(
        await countAll(client, SNAPSHOT),
        before,
        "a refused preflight wrote nothing",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 3. THE TARGET'S RELEASED VOCABULARY IS PROBED, NOT ASSUMED.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const admits = await client.query<{ def: string }>(
        `select pg_get_constraintdef(c.oid) as def
           from pg_constraint c join pg_class t on t.oid = c.conrelid
          where t.relname = 'companies' and c.conname = 'companies_provisioning_source_chk'`,
      );
      assert.ok(
        admits.rows[0]!.def.includes(CEREMONY_SOURCE_PRODUCTION),
        "the released CHECK admits the production root",
      );
      assert.ok(admits.rows[0]!.def.includes(CEREMONY_SOURCE_LOCAL));
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 4. THE PRODUCTION ROOT IS WRITTEN, AND ONLY WHERE IT IS ADMITTED.
     * ════════════════════════════════════════════════════════════════════ */
    const human = await seedHuman(client, "operator@example.test");
    {
      const beforeAudit = await count(client, "audit_log");

      const outcome = await provisionTenant(client, {
        slug: "prod-root-tenant",
        displayName: "Production Root Tenant",
        identityEmail: human.email,
        provisioningSource: CEREMONY_SOURCE_PRODUCTION,
      });
      assert.equal(outcome.status, "provisioned");

      const row = await client.query<{
        provisioning_source: string;
        created_by: string | null;
        tenant_status: string;
      }>(`select provisioning_source, created_by, tenant_status from companies where slug = $1`, [
        "prod-root-tenant",
      ]);
      assert.equal(row.rows[0]!.provisioning_source, CEREMONY_SOURCE_PRODUCTION);
      assert.equal(row.rows[0]!.tenant_status, "active", "provisioning is never observable");
      /* Possession is a SOURCE and never an ACTOR — unchanged by posture. */
      assert.equal(row.rows[0]!.created_by, null, "no actor is fabricated in production posture");
      assert.equal(
        await count(client, "audit_log"),
        beforeAudit,
        "no audit row is written in production posture either",
      );

      /* The transaction is still closed at exactly three tables. */
      const tenantId = (await findTenantBySlug(client, "prod-root-tenant"))!.tenantId;
      assert.equal(
        (await client.query(`select 1 from roles where tenant_id = $1`, [tenantId])).rowCount,
        1,
      );
      assert.equal(
        (await client.query(`select 1 from memberships where tenant_id = $1`, [tenantId])).rowCount,
        1,
      );
      assert.equal(
        (await client.query(`select 1 from genesis_nominations where tenant_id = $1`, [tenantId]))
          .rowCount,
        0,
        "provisioning still does not nominate genesis",
      );
      assert.equal(
        (await client.query(`select 1 from invitations where tenant_id = $1`, [tenantId])).rowCount,
        0,
        "provisioning still issues no invitation",
      );
    }

    /* The local root remains the DEFAULT — a caller that says nothing gets local, not production. */
    {
      const outcome = await provisionTenant(client, {
        slug: "local-root-tenant",
        displayName: "Local Root Tenant",
        identityEmail: human.email,
      });
      assert.equal(outcome.status, "provisioned");
      const row = await client.query<{ provisioning_source: string }>(
        `select provisioning_source from companies where slug = $1`,
        ["local-root-tenant"],
      );
      assert.equal(
        row.rows[0]!.provisioning_source,
        CEREMONY_SOURCE_LOCAL,
        "omitting the source must never silently produce a production claim",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 5. GENESIS NOMINATION carries the posture's root, and still only 'pending'.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const target = await resolveNominationTarget(client, "prod-root-tenant", human.email);
      assert.ok(target, "the bootstrap membership resolves a nomination target");
      const outcome = await nominateGenesisHuman(client, target, CEREMONY_SOURCE_PRODUCTION);
      assert.equal(outcome.status, "nominated");

      const row = await client.query<{ nomination_source: string; status: string }>(
        `select nomination_source, status from genesis_nominations where id = $1`,
        [outcome.status === "nominated" ? outcome.nominationId : ""],
      );
      assert.equal(row.rows[0]!.nomination_source, CEREMONY_SOURCE_PRODUCTION);
      assert.equal(row.rows[0]!.status, "pending", "the operator half still cannot accept");

      /* Default stays local here too. */
      const localTarget = await resolveNominationTarget(client, "local-root-tenant", human.email);
      const localOutcome = await nominateGenesisHuman(client, localTarget!);
      assert.equal(localOutcome.status, "nominated");
      const localRow = await client.query<{ nomination_source: string }>(
        `select nomination_source from genesis_nominations where id = $1`,
        [localOutcome.status === "nominated" ? localOutcome.nominationId : ""],
      );
      assert.equal(localRow.rows[0]!.nomination_source, CEREMONY_SOURCE_LOCAL);
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 6. THE FIRST HUMAN IS STILL REFUSED, IN PRODUCTION POSTURE TOO.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const usersBefore = await count(client, "users");
      const companiesBefore = await count(client, "companies");
      const outcome = await provisionTenant(client, {
        slug: "no-such-human",
        displayName: "No Such Human",
        identityEmail: "nobody@example.test",
        provisioningSource: CEREMONY_SOURCE_PRODUCTION,
      });
      assert.equal(outcome.status, "refused");
      assert.equal(
        outcome.status === "refused" && outcome.reason,
        "identity-not-found",
        "production posture does not smuggle in first-human creation",
      );
      assert.equal(await count(client, "users"), usersBefore, "no user was created");
      assert.equal(await count(client, "companies"), companiesBefore, "no tenant was created");
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 7. ROLLBACK: a failed production ceremony leaves nothing partial.
     * ════════════════════════════════════════════════════════════════════ */
    {
      const before = {
        companies: await count(client, "companies"),
        roles: await count(client, "roles"),
        memberships: await count(client, "memberships"),
      };
      /* The slug is taken, so the whole transaction is refused after the courtesy read. */
      const outcome = await provisionTenant(client, {
        slug: "prod-root-tenant",
        displayName: "Duplicate",
        identityEmail: human.email,
        provisioningSource: CEREMONY_SOURCE_PRODUCTION,
      });
      assert.equal(outcome.status, "refused");
      assert.equal(outcome.status === "refused" && outcome.reason, "slug-already-taken");
      assert.deepEqual(
        {
          companies: await count(client, "companies"),
          roles: await count(client, "roles"),
          memberships: await count(client, "memberships"),
        },
        before,
        "no orphan role, no orphan membership, no stranded tenant",
      );

      /*
       * ── A FAILURE *INSIDE* THE TRANSACTION, AFTER TWO ROWS ARE ALREADY WRITTEN ──
       *
       * The refusal above never reaches the transaction's catch: a taken slug is decided by the
       * courtesy read, which rolls back explicitly, and an unknown human is refused before `begin`.
       * A bite-proof that replaced the catch's `rollback` with `commit` therefore SURVIVED both —
       * the rollback path was never executed by this file. That is why the failure below is
       * provoked at the third insert, which is the only place an orphan company and an orphan role
       * can exist.
       *
       * A trigger is used because it fails deterministically at exactly the right statement. It is
       * created and dropped inside this disposable database and touches nothing else.
       */
      await client.query(`
        create function g4_reject_membership() returns trigger language plpgsql as $$
        begin raise exception 'g4 bite-proof: membership insert rejected'; end $$`);
      await client.query(`
        create trigger g4_reject_membership_trg before insert on memberships
        for each row execute function g4_reject_membership()`);

      let threw = false;
      try {
        await provisionTenant(client, {
          slug: "midflight-tenant",
          displayName: "Midflight Tenant",
          identityEmail: human.email,
          provisioningSource: CEREMONY_SOURCE_PRODUCTION,
        });
      } catch {
        /* The ceremony rolls back and rethrows anything that is not a unique violation. */
        threw = true;
      }
      await client.query(`drop trigger g4_reject_membership_trg on memberships`);
      await client.query(`drop function g4_reject_membership()`);

      assert.ok(threw, "a mid-transaction failure surfaces rather than being swallowed");
      assert.deepEqual(
        {
          companies: await count(client, "companies"),
          roles: await count(client, "roles"),
          memberships: await count(client, "memberships"),
        },
        before,
        "the company and role written before the failing membership were rolled back",
      );
      assert.equal(
        (await client.query(`select 1 from companies where slug = $1`, ["midflight-tenant"]))
          .rowCount,
        0,
        "no orphan tenant survives a mid-transaction failure",
      );

      /*
       * ── WHICH STATEMENT ACTUALLY GUARANTEES THIS, MEASURED ────────────────
       *
       * Two mutations were run against this file. Replacing the catch's `rollback` with `commit`
       * left it GREEN; removing the `begin` turned it RED. Both results are correct and neither is
       * a gap: once a statement raises, PostgreSQL puts the transaction in an aborted state where
       * `COMMIT` performs an implicit rollback, so the explicit `rollback` is connection hygiene
       * rather than the atomicity guarantee. `begin` is the load-bearing statement.
       *
       * Recorded rather than papered over, because a reader who assumes the rollback call is what
       * protects the bootstrap would draw the wrong conclusion about what is safe to change.
       */
      const provisionSource = readFileSync(
        path.join(process.cwd(), "scripts/lib/provision-tenant.ts"),
        "utf8",
      );
      assert.match(
        provisionSource,
        /await client\.query\("begin"\)/,
        "the bootstrap opens an explicit transaction — this is what makes it atomic",
      );
    }

    /* ══════════════════════════════════════════════════════════════════════
     * 8. THE PROVIDER IS UNTOUCHED BY EVERY ACT ABOVE.
     * ════════════════════════════════════════════════════════════════════ */
    {
      assert.equal(
        await count(client, "provider_connectivity_controls"),
        0,
        "no ceremony in this file created a provider control row",
      );
      assert.equal(await count(client, "providers"), 0);
      assert.equal(await count(client, "audit_log"), 0, "and no possession act wrote an audit row");
    }

    console.log("G4 production ceremony (PostgreSQL): all assertions passed.");
  } finally {
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
