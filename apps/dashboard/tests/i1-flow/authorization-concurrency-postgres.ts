/*
 * I1 — the duplicate-authorization invariant under REAL concurrency.
 *
 * WHY THIS FILE EXISTS. `authorizeMembership` reads "is there already a live authorization for this
 * human?" before it writes. That read is a courtesy, not a defense: two simultaneous requests both
 * see "no" and both proceed. `membership_authorizations_one_active_per_email_uq` is the actual
 * invariant, and an invariant only the application enforces is not an invariant.
 *
 * This proves the database refuses the second writer, that the loser is told the TRUTH
 * (`already-authorized`, not a generic outage), and that exactly one artifact and one Governance
 * decision survive — a Governance approval permits ONE onboarding, even when two humans click at
 * the same instant.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-12T09:30:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";
const TARGET = "contested@acme.test";

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_concurrency");
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
    /* An eligible role, created explicitly — not assumed to exist. */
    const role = await setup.query<{ id: string }>(
      `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
      [A.tenantId],
    );
    const memberRoleId = role.rows[0]!.id;

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

    const ctx: TenantContext = asHumanTenantContext({
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
      requestId: "i1-concurrency",
      authenticatedAt: NOW.toISOString(),
    });

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
      authorizeMembership(
        ctx,
        { targetEmail: TARGET, intendedRoleId: memberRoleId, justification: REASON },
        deps,
      ),
      authorizeMembership(
        ctx,
        { targetEmail: TARGET, intendedRoleId: memberRoleId, justification: REASON },
        deps,
      ),
    ]);

    const authorized = attempts.filter((a) => a.status === "authorized");
    const refusals = attempts.filter((a) => a.status === "refused");
    assert.equal(authorized.length, 1, "exactly one attempt may win");
    assert.equal(refusals.length, 1, "exactly one attempt must be refused");
    assert.equal(
      refusals[0]!.status === "refused" ? refusals[0]!.reason : "",
      "already-authorized",
      "the loser must be told the truth, not that persistence failed",
    );

    /* ── Exactly one artifact, and exactly one decision behind it ──────────── */
    {
      const rows = await setup.query(
        `select id, governance_decision_id, status from membership_authorizations
          where tenant_id = $1 and normalized_email = $2`,
        [A.tenantId, TARGET],
      );
      assert.equal(rows.rows.length, 1, "one live authorization, never two");
      assert.equal(rows.rows[0]!.status, "authorized");
      assert.equal(
        rows.rows[0]!.id,
        authorized[0]!.status === "authorized" ? authorized[0]!.authorizationId : "",
      );

      /*
       * THE ROLLBACK PROOF. The losing attempt wrote its session and decision inside the same
       * transaction as its artifact, so losing the index race must have taken them with it. A
       * committed `approve` decision with no authorization behind it would be exactly the orphan
       * this design forbids.
       */
      const decisions = await setup.query(
        `select id from decision_records
          where tenant_id = $1 and decision_type = 'approve' and subject_type = 'membership_authorization'`,
        [A.tenantId],
      );
      assert.equal(decisions.rows.length, 1, "the loser's decision must roll back with its artifact");
      assert.equal(decisions.rows[0]!.id, rows.rows[0]!.governance_decision_id);

      const sessions = await setup.query(
        `select count(*) from governance_sessions
          where tenant_id = $1 and governance_domain = 'membership-authorization'`,
        [A.tenantId],
      );
      assert.equal(Number(sessions.rows[0]!.count), 1, "no orphan governance session may survive");

      const audit = await setup.query(
        `select count(*) from audit_log where action = 'governance.membership.authorized'`,
      );
      assert.equal(Number(audit.rows[0]!.count), 1, "history must not claim two authorizations");
    }

    /* Nothing downstream was created by either attempt. */
    {
      const after = await setup.query(
        `select (select count(*) from invitations) as invitations,
                (select count(*) from memberships) as memberships`,
      );
      assert.equal(Number(after.rows[0]!.invitations), 0, "no invitation created");
      assert.equal(Number(after.rows[0]!.memberships), 1, "only the seeded membership exists");
    }

    console.log("PASS i1 authorization concurrency (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
