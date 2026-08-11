/*
 * G2 — Governance genesis concurrency, proved with DETERMINISTIC overlap.
 *
 * `Promise.all([a(), b()])` does not create a race: the event loop interleaves the calls, and a
 * passing result says nothing about what two server processes would do. That was the K3 lesson and
 * the G2.1 lesson, and the genesis of a tenant's constitution is the last place to relearn it.
 *
 * Every race here uses TWO REAL CONNECTIONS in real transactions, with a THIRD connection watching
 * `pg_stat_activity` until the second statement is genuinely blocked on the first one's lock. No
 * sleeps, no hoping.
 *
 * WHAT IS PROVED:
 *   1. two simultaneous genesis inserts → the partial unique index refuses the loser;
 *   2. two simultaneous entitlement spends → the predicate refuses the loser;
 *   3. the same through the real application path, which leaves exactly one decision, one session,
 *      one consumption and one committed audit row.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const REASON =
  "Establishing the first Governance authority for this tenant, as the accepted genesis human.";

const INSERT_BOOTSTRAP = `insert into decision_records
   (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id, bootstrap, outcome, justification)
 values ($1, 'certify', 'tenant', $1, 'human', $2, true, 'authority-established', $3)`;

const SPEND_ENTITLEMENT = `update genesis_nominations
   set consumed_at = now(), consumed_by_decision_id = $2
 where tenant_id = $1 and status = 'accepted' and consumed_at is null`;

/** Block until `pattern` appears in pg_stat_activity as a statement WAITING on a lock. */
async function waitUntilBlocked(observer: Client, pattern: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const blocked = await observer.query<{ n: string }>(
      `select count(*) n
         from pg_stat_activity
        where query like $1
          and state = 'active'
          and wait_event_type = 'Lock'
          and pid <> pg_backend_pid()`,
      [`%${pattern}%`],
    );
    if (Number(blocked.rows[0]!.n) > 0) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`timed out waiting for a statement matching "${pattern}" to block on a lock`);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g2_race");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const first = new Client({ connectionString: harness.dbUrl });
  const second = new Client({ connectionString: harness.dbUrl });
  const observer = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await Promise.all([setup.connect(), first.connect(), second.connect(), observer.connect()]);

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const dana = await (async () => {
      const user = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('dana@acme.test','dana@acme.test') returning id`,
      );
      return user.rows[0]!.id;
    })();

    /* ── RACE 1: two simultaneous genesis inserts, same tenant ───────────────── */
    {
      await first.query("begin");
      await first.query(INSERT_BOOTSTRAP, [alice.tenantId, alice.userId, REASON]);
      // `first` now holds the partial unique index entry, uncommitted.

      await second.query("begin");
      const loser = second
        .query(INSERT_BOOTSTRAP, [alice.tenantId, dana, REASON])
        .then(() => "inserted" as const)
        .catch((error: { code?: string }) => error.code ?? "unknown");

      await waitUntilBlocked(observer, "insert into decision_records");

      await first.query("commit");
      const outcome = await loser;
      await second.query("rollback").catch(() => {});

      assert.equal(
        outcome,
        "23505",
        "the loser of a simultaneous genesis must be refused by decision_records_one_bootstrap_per_tenant_uq",
      );

      const rows = await setup.query(
        `select actor_id from decision_records where tenant_id=$1 and bootstrap`,
        [alice.tenantId],
      );
      assert.equal(rows.rows.length, 1, "exactly one genesis survives the race");
      assert.equal(rows.rows[0]!.actor_id, alice.userId, "the first writer won");

      // Reset for the next race: this is the ONLY place any test rewinds a constitution, and it
      // uses raw SQL precisely because no application code path can.
      await setup.query(`delete from decision_records where tenant_id=$1`, [alice.tenantId]);
    }

    /* ── RACE 2: two simultaneous spends of one accepted entitlement ─────────── */
    {
      const session = await setup.query<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
            inactivity_expires_at)
         values ($1, repeat('a',64), 1, $2, $3, $4, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour')
         returning id`,
        [alice.authIdentityId, alice.userId, alice.tenantId, alice.membershipId],
      );
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [alice.tenantId, alice.authIdentityId, alice.userId, session.rows[0]!.id],
      );

      // Two decisions exist to point at, so the race is purely about the entitlement.
      const decisionA = await setup.query<{ id: string }>(
        `insert into decision_records
           (tenant_id, decision_type, subject_type, actor_type, actor_id, bootstrap, outcome, justification)
         values ($1,'certify','tenant','human',$2,false,'probe',$3) returning id`,
        [alice.tenantId, alice.userId, REASON],
      );
      const decisionB = await setup.query<{ id: string }>(
        `insert into decision_records
           (tenant_id, decision_type, subject_type, actor_type, actor_id, bootstrap, outcome, justification)
         values ($1,'certify','tenant','human',$2,false,'probe',$3) returning id`,
        [alice.tenantId, alice.userId, REASON],
      );

      await first.query("begin");
      const winner = await first.query(SPEND_ENTITLEMENT, [alice.tenantId, decisionA.rows[0]!.id]);
      assert.equal(winner.rowCount, 1, "the first spend takes the entitlement");

      await second.query("begin");
      const loserPromise = second
        .query(SPEND_ENTITLEMENT, [alice.tenantId, decisionB.rows[0]!.id])
        .then((result) => result.rowCount);

      await waitUntilBlocked(observer, "update genesis_nominations");

      await first.query("commit");
      const loserRowCount = await loserPromise;
      await second.query("commit");

      assert.equal(
        loserRowCount,
        0,
        "after the row lock releases, the loser re-evaluates consumed_at is null and matches nothing",
      );

      const spent = await setup.query(
        `select consumed_by_decision_id from genesis_nominations where tenant_id=$1`,
        [alice.tenantId],
      );
      assert.equal(spent.rows[0]!.consumed_by_decision_id, decisionA.rows[0]!.id);

      /* Reset for race 3 — consumption FIRST. The FK is ON DELETE RESTRICT, so a spent decision
       * cannot be deleted while a nomination still points at it. That ordering requirement is
       * itself a proof that the consumption reference is real. */
      await setup.query(
        `update genesis_nominations set consumed_at=null, consumed_by_decision_id=null where tenant_id=$1`,
        [alice.tenantId],
      );
      await setup.query(`delete from decision_records where tenant_id=$1`, [alice.tenantId]);
    }

    /* ── RACE 3: the real application path, four parallel attempts ──────────── */
    {
      const session = await setup.query<{ id: string }>(
        `select id from user_session_contexts where user_id=$1 limit 1`,
        [alice.userId],
      );
      const tenant: TenantContext = {
        tenantId: alice.tenantId,
        userId: alice.userId,
        authIdentityId: alice.authIdentityId,
        membershipId: alice.membershipId,
        membershipVersion: 1,
        roleId: alice.roleId,
        sessionContextId: session.rows[0]!.id,
        provider: "local",
        assuranceLevel: "aal1",
        mfaVerified: false,
        requestId: "g2-race",
        authenticatedAt: new Date().toISOString(),
      };

      /*
       * On its own this is the weak test the header warns about — RACES 1 and 2 are the database
       * proof. This exists to show the application path INHERITS them rather than layering a
       * read-then-write on top that would reintroduce the gap.
       */
      const results = await Promise.all(
        [0, 1, 2, 3].map(() =>
          establishGovernanceAuthority(tenant, { justification: REASON }, { getDb: () => handle.db }),
        ),
      );
      const established = results.filter((r) => r.status === "established");
      assert.equal(established.length, 1, "exactly one parallel genesis may succeed");
      for (const refused of results.filter((r) => r.status !== "established")) {
        assert.ok(
          refused.status === "refused" &&
            ["already-bootstrapped", "entitlement-already-consumed"].includes(refused.reason),
          `losers must be refused by a governed rule, got ${JSON.stringify(refused)}`,
        );
      }

      const state = await setup.query(
        `select (select count(*)::int from decision_records where tenant_id=$1 and bootstrap) decisions,
                (select count(*)::int from governance_sessions where tenant_id=$1) sessions,
                (select count(*)::int from genesis_nominations
                   where tenant_id=$1 and consumed_at is not null) consumed,
                (select count(*)::int from audit_log
                   where tenant_id=$1 and result='committed') committed_audit`,
        [alice.tenantId],
      );
      assert.deepEqual(
        state.rows[0],
        { decisions: 1, sessions: 1, consumed: 1, committed_audit: 1 },
        "one genesis leaves exactly one decision, one session, one consumption and one audit row",
      );
    }

    console.log("PASS g2 governance concurrency (postgres)");
  } finally {
    await Promise.all([
      setup.end().catch(() => {}),
      first.end().catch(() => {}),
      second.end().catch(() => {}),
      observer.end().catch(() => {}),
    ]);
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
