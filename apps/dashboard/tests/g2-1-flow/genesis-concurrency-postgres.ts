/*
 * G2.1 — concurrency, proved against a REAL PostgreSQL database with DETERMINISTIC overlap.
 *
 * WHY THIS FILE EXISTS SEPARATELY. `Promise.all([a(), b()])` does not create a race: the two calls
 * are interleaved by the event loop, not by the database, and a passing result proves nothing about
 * what two server processes would do. That was the K3 lesson, and a constitutional root is exactly
 * the wrong place to relearn it.
 *
 * So every race here is staged with TWO REAL CONNECTIONS and real transactions, and the overlap is
 * OBSERVED rather than assumed: a third connection watches `pg_stat_activity` until the second
 * statement is genuinely blocked on the first one's lock before the first commits. No sleeps, no
 * hoping.
 *
 * WHAT IS PROVED:
 *   1. two simultaneous operator ceremonies cannot create two roots for one tenant — the partial
 *      unique index refuses the loser;
 *   2. two simultaneous acceptances cannot both succeed — the `status = 'pending'` predicate is
 *      re-evaluated after the row lock is released, so the loser updates nothing;
 *   3. the same holds through the real application path.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { acceptGenesisNomination } from "../../src/features/governance-genesis/genesis-acceptance.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const INSERT_NOMINATION = `insert into genesis_nominations
   (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source)
 values ($1, $2, $3, 'pending', 'local-operator-ceremony')`;

const ACCEPT = `update genesis_nominations
   set status = 'accepted', accepted_at = now(), accepted_session_context_id = $2,
       accepted_assurance_level = 'aal1'
 where tenant_id = $1 and status = 'pending'`;

/**
 * Block until `pattern` appears in pg_stat_activity as a statement that is WAITING on a lock.
 *
 * This is what makes the overlap deterministic: the winner does not commit until the loser is
 * provably inside the database, blocked, with its statement already sent.
 */
async function waitUntilBlocked(observer: Client, pattern: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
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
  const harness = createDisposablePostgresHarness("hebun_g21_race");
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
    const dave = await (async () => {
      const user = await setup.query<{ id: string }>(
        `insert into users (email, name) values ($1, $1) returning id`,
        ["dave@acme.test"],
      );
      const userId = user.rows[0]!.id;
      const identity = await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
         values ($1, 'local', 'hebun-local', 'local:dave@acme.test', 'active', true, now()) returning id`,
        [userId],
      );
      const role = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
        [alice.tenantId],
      );
      await setup.query(
        `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active')`,
        [alice.tenantId, userId, role.rows[0]!.id],
      );
      return { userId, authIdentityId: identity.rows[0]!.id };
    })();

    /* ── RACE 1: two operator ceremonies, one tenant, different nominees ─────── */
    {
      await first.query("begin");
      await first.query(INSERT_NOMINATION, [
        alice.tenantId,
        alice.authIdentityId,
        alice.userId,
      ]);
      // `first` now holds the partial unique index entry, uncommitted.

      await second.query("begin");
      const loser = second
        .query(INSERT_NOMINATION, [alice.tenantId, dave.authIdentityId, dave.userId])
        .then(() => "inserted" as const)
        .catch((error: { code?: string }) => error.code ?? "unknown");

      // Observed, not assumed: `second` is genuinely blocked on `first`'s index entry.
      await waitUntilBlocked(observer, "insert into genesis_nominations");

      await first.query("commit");
      const outcome = await loser;
      await second.query("rollback").catch(() => {});

      assert.equal(
        outcome,
        "23505",
        "the loser of a simultaneous ceremony must be refused by the unique index (unique_violation)",
      );

      const rows = await setup.query(
        `select nominated_user_id, status from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(rows.rows.length, 1, "exactly one genesis root survives the race");
      assert.equal(rows.rows[0]!.nominated_user_id, alice.userId, "the first writer won");
      assert.equal(rows.rows[0]!.status, "pending");
    }

    /* ── RACE 2: two simultaneous acceptances of the same nomination ─────────── */
    {
      const session = await setup.query<{ id: string }>(
        `insert into user_session_contexts
           (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
            user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
            mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
            inactivity_expires_at)
         values ($1, repeat('a', 64), 1, $2, $3, $4, 1, 'aal1', false, now(), now(), now(),
                 now() + interval '1 day', now() + interval '1 hour')
         returning id`,
        [alice.authIdentityId, alice.userId, alice.tenantId, alice.membershipId],
      );
      const sessionId = session.rows[0]!.id;

      await first.query("begin");
      const winner = await first.query(ACCEPT, [alice.tenantId, sessionId]);
      assert.equal(winner.rowCount, 1, "the first acceptance updates the pending row");

      await second.query("begin");
      const loserPromise = second
        .query(ACCEPT, [alice.tenantId, sessionId])
        .then((result) => result.rowCount);

      await waitUntilBlocked(observer, "update genesis_nominations");

      await first.query("commit");
      const loserRowCount = await loserPromise;
      await second.query("commit");

      assert.equal(
        loserRowCount,
        0,
        "after the row lock releases, the loser re-evaluates status = 'pending' and matches nothing",
      );

      const rows = await setup.query(
        `select status, accepted_at from genesis_nominations where tenant_id = $1`,
        [alice.tenantId],
      );
      assert.equal(rows.rows.length, 1);
      assert.equal(rows.rows[0]!.status, "accepted");
    }

    /* ── RACE 3: the same, through the real application path ─────────────────── */
    {
      // Reset to pending so the product path faces a real pending nomination. This is the ONLY
      // place any test rewinds the ceremony, and it does so with raw SQL precisely because no
      // application code path can.
      await setup.query(
        `update genesis_nominations
            set status = 'pending', accepted_at = null, accepted_session_context_id = null,
                accepted_assurance_level = null
          where tenant_id = $1`,
        [alice.tenantId],
      );

      const session = await setup.query<{ id: string }>(
        `select id from user_session_contexts where user_id = $1 limit 1`,
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
        requestId: "g2-1-race",
        authenticatedAt: new Date().toISOString(),
      };

      /*
       * Four parallel calls. On its own this is the weak test the header warns about — the DATABASE
       * proof is RACE 2 above. This exists to show the application path inherits it rather than
       * layering a read-then-write on top that would reintroduce the gap.
       */
      const results = await Promise.all(
        [0, 1, 2, 3].map(() => acceptGenesisNomination(tenant, { getDb: () => handle.db })),
      );
      const accepted = results.filter((result) => result.status === "accepted");
      assert.equal(accepted.length, 1, "exactly one parallel acceptance may succeed");
      for (const refused of results.filter((result) => result.status !== "accepted")) {
        assert.equal(
          refused.status === "refused" ? refused.reason : "",
          "already-accepted",
          "the losers must be told the truth: it was already accepted",
        );
      }

      // And exactly one audit event exists — no loser wrote history.
      const audit = await setup.query(
        `select count(*)::int n from audit_log
          where entity_type = 'genesis_nomination'
            and action = 'governance.genesis-nomination.accepted'`,
      );
      assert.equal(audit.rows[0]!.n, 1, "one acceptance, one audit row");
    }

    console.log("PASS g2-1 genesis concurrency (postgres)");
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
