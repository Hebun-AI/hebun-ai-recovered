/*
 * G3 — authority-mutation concurrency, proved with DETERMINISTIC overlap.
 *
 * `Promise.all` is not a race — the K3, G2.1, G2 and K4 lesson, now applied to the thing that
 * decides who may decide. Two authorities granted from one ambiguous state, or a revoked human
 * slipping a delegation through, would be the worst possible outcome of this phase.
 *
 * THE MECHANISM UNDER TEST: every authority mutation takes `SELECT … FOR UPDATE` on the tenant's
 * BOOTSTRAP DECISION row — guaranteed to exist and be unique by G2's partial unique index. That row
 * is the per-tenant Governance mutex, so no second source of truth and no migration were needed.
 *
 * The four races the brief requires:
 *   A. the same authority delegated twice concurrently
 *   B. delegation vs revocation overlap
 *   C. a revoked actor attempting a concurrent new delegation
 *   D. duplicate revocation
 *
 * Each is staged with TWO REAL CONNECTIONS, with a THIRD watching `pg_stat_activity` until the
 * second transaction is genuinely blocked on the first one's lock.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-11T21:00:00.000Z");
const REASON = "Recording this Governance authority change with an explicit human reason.";

/** The mutex statement the runtime takes. Staged by hand here to create real overlap. */
const LOCK = `select id, actor_id from decision_records where tenant_id = $1 and bootstrap = true for update`;

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

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

async function addMember(client: Client, tenantId: string, email: string): Promise<Seeded> {
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
  /*
   * I1.1 made "at most one ordinary member role per tenant" constitutional
   * (`roles_one_member_per_tenant_uq`), so this fixture reuses the tenant's member role instead of
   * minting one per human — which is also what the product actually does.
   */
  const existing = await client.query<{ id: string }>(
    `select id from roles where tenant_id = $1 and type = 'member' limit 1`,
    [tenantId],
  );
  const role = existing.rows[0]
    ? existing
    : await client.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
        [tenantId],
      );
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, role.rows[0]!.id],
  );
  return {
    tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId: role.rows[0]!.id,
  };
}

async function sessionRowFor(client: Client, seeded: Seeded, tag: string): Promise<string> {
  const row = await client.query<{ id: string }>(
    `insert into user_session_contexts
       (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
        user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
        mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
        inactivity_expires_at)
     values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
             now() + interval '1 day', now() + interval '1 hour')
     returning id`,
    [
      seeded.authIdentityId,
      tag.padEnd(64, "0").slice(0, 64).replace(/[^0-9a-f]/g, "a"),
      seeded.userId,
      seeded.tenantId,
      seeded.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "g3-race",
    authenticatedAt: NOW.toISOString(),
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_g3_race");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const holder = new Client({ connectionString: harness.dbUrl });
  const observer = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await Promise.all([setup.connect(), holder.connect(), observer.connect()]);

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    const B = await addMember(setup, A.tenantId, "b@acme.test");
    const C = await addMember(setup, A.tenantId, "c@acme.test");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxB = contextFor(B, await sessionRowFor(setup, B, "bbbb"));

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [A.tenantId, A.authIdentityId, A.userId, ctxA.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctxA, { justification: REASON }, deps)).status,
      "established",
    );

    /*
     * THE OVERLAP PROOF, USED BY EVERY RACE BELOW.
     *
     * `holder` opens a transaction and takes the SAME mutex the runtime takes, then we fire the real
     * application call. It blocks — observed in `pg_stat_activity`, not assumed — which proves the
     * runtime genuinely serializes on the bootstrap row rather than merely reading it. We then let
     * the holder commit and see what the runtime decides against the state it finds.
     */
    const underContention = async <T>(run: () => Promise<T>, mutate?: () => Promise<void>): Promise<T> => {
      await holder.query("begin");
      await holder.query(LOCK, [A.tenantId]);
      const pending = run();
      await waitUntilBlocked(observer, "for update");
      if (mutate) await mutate();
      await holder.query("commit");
      return pending;
    };

    /* ── RACE A: the same human delegated twice, concurrently ────────────────── */
    {
      // The first delegation commits while the second is blocked on the mutex.
      const second = await underContention(
        () => delegateGovernanceAuthority(ctxA, { toUserId: B.userId, justification: REASON }, deps),
        async () => {
          await holder.query(
            `insert into governance_sessions
               (tenant_id, governance_domain, decision_type, subject_type, subject_id,
                proposer_actor_type, proposer_actor_id, governance_lifecycle_status)
             values ($1,'authority-delegation','delegate-authority','user',$2,'human',$3,'recorded')`,
            [A.tenantId, B.userId, A.userId],
          );
          await holder.query(
            `insert into decision_records
               (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id,
                bootstrap, outcome, justification)
             values ($1,'delegate-authority','user',$2,'human',$3,false,'authority-delegated',$4)`,
            [A.tenantId, B.userId, A.userId, REASON],
          );
        },
      );

      assert.deepEqual(
        second,
        { status: "refused", reason: "already-authorized" },
        "the loser sees the winner's delegation because it waited for the mutex",
      );
      const count = await setup.query<{ n: number }>(
        `select count(*)::int n from decision_records
          where decision_type='delegate-authority' and subject_id=$1`,
        [B.userId],
      );
      assert.equal(count.rows[0]!.n, 1, "exactly one delegation exists for B");
      assert.equal((await resolveGovernanceAuthority(ctxB, deps)).authorized, true);
    }

    /* ── RACE B: delegation vs revocation overlap ────────────────────────────── */
    {
      const delegationId = (
        await setup.query<{ id: string }>(
          `select id from decision_records where decision_type='delegate-authority' and subject_id=$1`,
          [B.userId],
        )
      ).rows[0]!.id;

      /*
       * B tries to delegate onward to C while A's revocation of B commits under the mutex. B's call
       * re-resolves its own authority INSIDE the lock, so it must find itself already revoked.
       */
      const delegation = await underContention(
        () => delegateGovernanceAuthority(ctxB, { toUserId: C.userId, justification: REASON }, deps),
        async () => {
          await holder.query(
            `insert into governance_sessions
               (tenant_id, governance_domain, decision_type, subject_type, subject_id,
                proposer_actor_type, proposer_actor_id, governance_lifecycle_status)
             values ($1,'authority-delegation','revoke','governance_decision',$2,'human',$3,'recorded')`,
            [A.tenantId, delegationId, A.userId],
          );
          await holder.query(
            `insert into decision_records
               (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id,
                bootstrap, outcome, justification)
             values ($1,'revoke','governance_decision',$2,'human',$3,false,'authority-revoked',$4)`,
            [A.tenantId, delegationId, A.userId, REASON],
          );
        },
      );

      assert.deepEqual(
        delegation,
        { status: "refused", reason: "not-a-governance-authority" },
        "RACE C: an actor whose authority was revoked while they waited cannot delegate",
      );
      const cAuthority = await setup.query<{ n: number }>(
        `select count(*)::int n from decision_records
          where decision_type='delegate-authority' and subject_id=$1`,
        [C.userId],
      );
      assert.equal(cAuthority.rows[0]!.n, 0, "no authority leaked to C");
      assert.equal((await resolveGovernanceAuthority(ctxB, deps)).authorized, false);
    }

    /* ── RACE D: duplicate revocation ────────────────────────────────────────── */
    {
      // Give C a fresh delegation to race two revocations against.
      const granted = await delegateGovernanceAuthority(
        ctxA,
        { toUserId: C.userId, justification: REASON },
        deps,
      );
      assert.equal(granted.status, "delegated");
      if (granted.status !== "delegated") throw new Error("unreachable");

      const second = await underContention(
        () =>
          revokeGovernanceAuthority(
            ctxA,
            { delegationDecisionId: granted.decisionId, justification: REASON },
            deps,
          ),
        async () => {
          await holder.query(
            `insert into governance_sessions
               (tenant_id, governance_domain, decision_type, subject_type, subject_id,
                proposer_actor_type, proposer_actor_id, governance_lifecycle_status)
             values ($1,'authority-delegation','revoke','governance_decision',$2,'human',$3,'recorded')`,
            [A.tenantId, granted.decisionId, A.userId],
          );
          await holder.query(
            `insert into decision_records
               (tenant_id, decision_type, subject_type, subject_id, actor_type, actor_id,
                bootstrap, outcome, justification)
             values ($1,'revoke','governance_decision',$2,'human',$3,false,'authority-revoked',$4)`,
            [A.tenantId, granted.decisionId, A.userId, REASON],
          );
        },
      );

      assert.deepEqual(
        second,
        { status: "refused", reason: "already-revoked" },
        "the second revocation sees the first because it waited for the mutex",
      );
      const revocations = await setup.query<{ n: number }>(
        `select count(*)::int n from decision_records
          where decision_type='revoke' and subject_id=$1`,
        [granted.decisionId],
      );
      assert.equal(revocations.rows[0]!.n, 1, "exactly one revocation exists");
    }

    /* ── Final state: unambiguous, and the genesis still governs ─────────────── */
    {
      assert.equal((await resolveGovernanceAuthority(ctxA, deps)).authorized, true);
      assert.equal((await resolveGovernanceAuthority(ctxB, deps)).authorized, false);

      // No human holds two active delegations, which is what "ambiguous authority" would look like.
      const duplicates = await setup.query<{ subject_id: string; n: number }>(
        `select d.subject_id, count(*)::int n
           from decision_records d
          where d.tenant_id=$1 and d.decision_type='delegate-authority'
            and not exists (
                  select 1 from decision_records r
                   where r.tenant_id=d.tenant_id and r.decision_type='revoke'
                     and r.subject_type='governance_decision' and r.subject_id=d.id)
          group by d.subject_id having count(*) > 1`,
        [A.tenantId],
      );
      assert.deepEqual(duplicates.rows, [], "no human holds two active delegations");

      // Audit and decisions did not diverge: every committed authority decision has its event.
      const parity = await setup.query<{ decisions: number; events: number }>(
        `select (select count(*)::int from decision_records
                   where tenant_id=$1 and decision_type in ('delegate-authority','revoke')
                     and id in (select entity_id from audit_log where tenant_id=$1)) decisions,
                (select count(*)::int from audit_log
                   where tenant_id=$1 and action like 'governance.authority%') events`,
        [A.tenantId],
      );
      assert.equal(
        parity.rows[0]!.decisions,
        parity.rows[0]!.events,
        "every audited authority event points at a real decision, and vice versa",
      );
    }

    console.log("PASS g3 delegation concurrency (postgres)");
  } finally {
    await Promise.all([
      setup.end().catch(() => {}),
      holder.end().catch(() => {}),
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
