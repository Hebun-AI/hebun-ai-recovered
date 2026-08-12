/*
 * I1.1 — the ordinary-member-role invariant under REAL concurrency.
 *
 * WHY THIS FILE EXISTS. `provisionMemberRole` reads "does a member role exist?" before it writes.
 * That read is a courtesy: two simultaneous ceremonies both see "no" and both proceed.
 * `roles_one_member_per_tenant_uq` is the actual invariant, and an invariant only the application
 * enforces is not an invariant.
 *
 * It proves the database refuses the second writer, that the loser is told the TRUTH
 * (`already-provisioned`, not a generic outage), and — the part that matters most — that the
 * loser's Governance session, decision and audit row ALL roll back with it. A committed `approve`
 * decision claiming a role that does not exist would be exactly the orphan this design forbids.
 *
 * Uses a disposable local database, dropped on exit by its own ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { ORGANIZATIONAL_ROLE_AUDIT_ACTION } from "../../src/features/tenant-role-baseline/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-12T11:30:00.000Z");
const REASON = "Establishing this organization's ordinary member role is a deliberate decision.";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_1_concurrency");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });

    const session = await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
               now() + interval '1 day', now() + interval '1 hour')
       returning id`,
      [A.authIdentityId, "a".repeat(64), A.userId, A.tenantId, A.membershipId],
    );

    const ctx: TenantContext = {
      tenantId: A.tenantId,
      userId: A.userId,
      authIdentityId: A.authIdentityId,
      membershipId: A.membershipId,
      membershipVersion: 1,
      roleId: A.roleId,
      sessionContextId: session.rows[0]!.id,
      provider: "local",
      assuranceLevel: "aal1",
      mfaVerified: false,
      requestId: "i1-1-concurrency",
      authenticatedAt: NOW.toISOString(),
    };

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [A.tenantId, A.authIdentityId, A.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: REASON }, deps)).status,
      "established",
    );

    /* ── The race. Both callers are the same legitimate authority. ─────────── */
    const attempts = await Promise.all([
      provisionMemberRole(ctx, { justification: REASON }, deps),
      provisionMemberRole(ctx, { justification: REASON }, deps),
    ]);

    const provisioned = attempts.filter((a) => a.status === "provisioned");
    const refusals = attempts.filter((a) => a.status === "refused");
    assert.equal(provisioned.length, 1, "exactly one attempt may win");
    assert.equal(refusals.length, 1, "exactly one attempt must be refused");
    assert.equal(
      refusals[0]!.status === "refused" ? refusals[0]!.reason : "",
      "already-provisioned",
      "the loser must be told the truth, not that persistence failed",
    );

    /* ── Exactly one role, one decision, one session, one audit ────────────── */
    {
      const roles = await setup.query<{ id: string }>(
        `select id from roles where tenant_id = $1 and type = 'member'`,
        [A.tenantId],
      );
      assert.equal(roles.rows.length, 1, "one member role, never two");
      assert.equal(
        roles.rows[0]!.id,
        provisioned[0]!.status === "provisioned" ? provisioned[0]!.roleId : "",
      );

      const decisions = await setup.query<{ id: string; subject_id: string }>(
        `select id, subject_id from decision_records
          where tenant_id = $1 and decision_type = 'approve' and subject_type = 'role'`,
        [A.tenantId],
      );
      assert.equal(decisions.rows.length, 1, "the loser's decision must roll back with its role");
      assert.equal(decisions.rows[0]!.subject_id, roles.rows[0]!.id, "no orphan decision survives");

      const sessions = await setup.query<{ count: string }>(
        `select count(*) from governance_sessions
          where tenant_id = $1 and governance_domain = 'organizational-role'`,
        [A.tenantId],
      );
      assert.equal(Number(sessions.rows[0]!.count), 1, "no orphan governance session may survive");

      const audit = await setup.query<{ count: string }>(
        `select count(*) from audit_log where action = $1`,
        [ORGANIZATIONAL_ROLE_AUDIT_ACTION],
      );
      assert.equal(Number(audit.rows[0]!.count), 1, "history must not claim two provisionings");
    }

    /* Nothing downstream was created by either attempt. */
    {
      const after = await setup.query<{ invitations: string; memberships: string }>(
        `select (select count(*) from invitations) as invitations,
                (select count(*) from memberships) as memberships`,
      );
      assert.equal(Number(after.rows[0]!.invitations), 0, "no invitation created");
      assert.equal(Number(after.rows[0]!.memberships), 1, "only the seeded membership exists");
    }

    console.log("PASS i1.1 provisioning concurrency (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
