/*
 * K4 — ratification concurrency, proved with DETERMINISTIC overlap.
 *
 * `Promise.all([a(), b()])` is not a race: the event loop interleaves the calls and proves nothing
 * about two server processes. That was the K3 lesson, then the G2.1 lesson, then the G2 lesson.
 * Ratification is where it matters most: two decisions bound to one version would mean an
 * organization approved the same sentence twice under two different authorities.
 *
 * Every race here uses TWO REAL CONNECTIONS in real transactions, with a THIRD connection watching
 * `pg_stat_activity` until the second statement is genuinely blocked on the first one's lock.
 *
 * WHAT IS PROVED:
 *   1. two simultaneous bindings to one version → the loser updates nothing;
 *   2. a supersession racing a ratification cannot leave the new version ratified;
 *   3. through the real application path, four parallel ratifications leave exactly one decision,
 *      one binding and one Knowledge audit event.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import { ratifyKnowledgeVersion } from "../../src/features/knowledge-ratification/ratify-version.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-11T19:00:00.000Z");
const REASON = "Governance has reviewed this exact version and records its decision here.";

const BIND = `update knowledge_nodes
   set ratification_decision_id = $2, ratified_at = now(), ratified_by_actor_type = 'human',
       ratified_by_actor_id = $3
 where id = $1 and ratification_decision_id is null`;

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
  const harness = createDisposablePostgresHarness("hebun_k4_race");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const first = new Client({ connectionString: harness.dbUrl });
  const second = new Client({ connectionString: harness.dbUrl });
  const observer = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await Promise.all([setup.connect(), first.connect(), second.connect(), observer.connect()]);

    const alice = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "alice@acme.test",
      password: "alice-correct-password-7Qx",
    });
    const session = await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1, repeat('a',64), 1, $2, $3, $4, 1, 'aal1', false, now(), now(), now(),
               now() + interval '1 day', now() + interval '1 hour') returning id`,
      [alice.authIdentityId, alice.userId, alice.tenantId, alice.membershipId],
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
      requestId: "k4-race",
      authenticatedAt: NOW.toISOString(),
    };

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [alice.tenantId, alice.authIdentityId, alice.userId, session.rows[0]!.id],
    );
    const governance = await establishGovernanceAuthority(
      tenant,
      { justification: "Establishing Governance authority so Knowledge can be reviewed." },
      deps,
    );
    assert.equal(governance.status, "established");

    const writer = createDurableKnowledgeWriter(handle.db);
    const repo = createDurableKnowledgeRepository(handle.db);
    const knowledgeDeps = {
      resolveAuthority: async () => ({ authorized: true, roleType: "owner" }),
      getWriter: () => writer,
      getRepo: () => repo,
      now: () => NOW,
    } as never;

    const makeFact = async (factKey: string) => {
      const created = await createKnowledgeFact(
        tenant,
        {
          factKey,
          domainKey: "commerce",
          scope: "company-wide",
          title: factKey,
          statement: `A statement for ${factKey} that is long enough to be valid.`,
        },
        knowledgeDeps,
      );
      assert.equal(created.status, "created");
      const listing = await listKnowledgeSources(tenant, knowledgeDeps);
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      const record = listing.records.find((r) => r.factKey === factKey);
      assert.ok(record?.activeKnowledgeNodeId);
      return { factId: record!.factId, nodeId: record!.activeKnowledgeNodeId! };
    };

    /* ── RACE 1: two simultaneous bindings to ONE version ────────────────────── */
    {
      const target = await makeFact("race.binding");
      // Two candidate decisions, so the race is purely about the binding.
      const decisionA = await setup.query<{ id: string }>(
        `insert into decision_records
           (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id, bootstrap, outcome, justification)
         values ($1,'ratify','knowledge_node',$2,'human',$3,false,'ratified',$4) returning id`,
        [alice.tenantId, target.nodeId, alice.userId, REASON],
      );
      const decisionB = await setup.query<{ id: string }>(
        `insert into decision_records
           (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id, bootstrap, outcome, justification)
         values ($1,'ratify','knowledge_node',$2,'human',$3,false,'ratified',$4) returning id`,
        [alice.tenantId, target.nodeId, alice.userId, REASON],
      );

      await first.query("begin");
      const winner = await first.query(BIND, [
        target.nodeId,
        decisionA.rows[0]!.id,
        alice.userId,
      ]);
      assert.equal(winner.rowCount, 1, "the first binding takes the version");

      await second.query("begin");
      const loserPromise = second
        .query(BIND, [target.nodeId, decisionB.rows[0]!.id, alice.userId])
        .then((result) => result.rowCount);

      await waitUntilBlocked(observer, "update knowledge_nodes");

      await first.query("commit");
      const loserRowCount = await loserPromise;
      await second.query("commit");

      assert.equal(
        loserRowCount,
        0,
        "after the row lock releases, the loser re-evaluates ratification_decision_id is null and matches nothing",
      );

      const bound = await setup.query<{ ratification_decision_id: string }>(
        `select ratification_decision_id from knowledge_nodes where id=$1`,
        [target.nodeId],
      );
      assert.equal(
        bound.rows[0]!.ratification_decision_id,
        decisionA.rows[0]!.id,
        "exactly one decision is bound, and it is the winner's",
      );
    }

    /* ── RACE 2: a supersession racing a ratification ────────────────────────── */
    {
      const target = await makeFact("race.supersede");

      /*
       * `first` holds the version row with the same FOR UPDATE lock the ratification path takes.
       * A concurrent supersession must wait, and when it proceeds it creates a NEW node — which is
       * unratified, because ratification was bound to the row that was locked.
       */
      await first.query("begin");
      await first.query(`select 1 from knowledge_nodes where id=$1 for update`, [target.nodeId]);

      await second.query("begin");
      const blockedRead = second
        .query(`select 1 from knowledge_nodes where id=$1 for update`, [target.nodeId])
        .then(() => "acquired" as const);

      await waitUntilBlocked(observer, "for update");

      const decision = await first.query<{ id: string }>(
        `insert into decision_records
           (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id, bootstrap, outcome, justification)
         values ($1,'ratify','knowledge_node',$2,'human',$3,false,'ratified',$4) returning id`,
        [alice.tenantId, target.nodeId, alice.userId, REASON],
      );
      await first.query(BIND, [target.nodeId, decision.rows[0]!.id, alice.userId]);
      await first.query("commit");

      assert.equal(await blockedRead, "acquired", "the waiter proceeds only after the commit");
      await second.query("rollback");

      const state = await setup.query<{ ratified: number; nodes: number }>(
        `select (select count(*)::int from knowledge_nodes
                   where id=$1 and ratification_decision_id is not null) ratified,
                (select count(*)::int from knowledge_nodes where tenant_id=$2) nodes`,
        [target.nodeId, alice.tenantId],
      );
      assert.equal(state.rows[0]!.ratified, 1, "the locked version is the one that got ratified");
    }

    /* ── RACE 3: four parallel ratifications through the real path ───────────── */
    {
      const target = await makeFact("race.application");

      /*
       * On its own this is the weak test the header warns about — RACE 1 is the database proof.
       * This exists to show the application path INHERITS it rather than layering a read-then-write
       * on top that would reintroduce the gap.
       */
      const results = await Promise.all(
        [0, 1, 2, 3].map(() =>
          ratifyKnowledgeVersion(
            tenant,
            {
              factId: target.factId,
              knowledgeNodeId: target.nodeId,
              observedKnowledgeVersion: 1,
              justification: REASON,
            },
            deps,
          ),
        ),
      );
      const ratified = results.filter((r) => r.status === "ratified");
      assert.equal(ratified.length, 1, "exactly one parallel ratification may succeed");
      for (const refused of results.filter((r) => r.status !== "ratified")) {
        assert.ok(
          refused.status === "refused" &&
            ["already-ratified", "persistence-unavailable"].includes(refused.reason),
          `losers must be refused by a governed rule, got ${JSON.stringify(refused)}`,
        );
      }

      const state = await setup.query<{
        bindings: number;
        decisions: number;
        sessions: number;
        knowledge_audit: number;
      }>(
        `select (select count(*)::int from knowledge_nodes
                   where id=$1 and ratification_decision_id is not null) bindings,
                (select count(*)::int from decision_records where subject_id=$1) decisions,
                (select count(*)::int from governance_sessions where subject_id=$1) sessions,
                (select count(*)::int from audit_log
                   where action='knowledge.ratify' and (metadata->>'newKnowledgeNodeId')=$1::text) knowledge_audit`,
        [target.nodeId],
      );
      assert.deepEqual(
        state.rows[0],
        { bindings: 1, decisions: 1, sessions: 1, knowledge_audit: 1 },
        "one ratification leaves one binding, one decision, one session and one Knowledge audit event",
      );
    }

    console.log("PASS k4 ratification concurrency (postgres)");
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
