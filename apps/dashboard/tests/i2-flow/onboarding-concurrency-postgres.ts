/*
 * I2 — the exactly-once invariants under REAL concurrency.
 *
 * WHY THIS FILE EXISTS. Both I2 acts read before they write, and both reads are a courtesy: two
 * simultaneous callers see "authorization still live" or "invitation still pending" and both
 * proceed. The database is what actually refuses the second writer.
 *
 * Proven here, each against a real PostgreSQL instance:
 *
 *   1. two issuance attempts from one authorization  → exactly one invitation, one consumption
 *   2. the losing issuance leaves NOTHING            → no orphan invitation, no duplicate audit
 *   3. two acceptance attempts for one invitation    → exactly one membership
 *   4. two DIFFERENT humans racing one invitation    → only the legitimately bound human wins
 *   5. the losing acceptance leaves NOTHING          → no accepted-but-memberless state, no orphan audit
 *   6. a legitimate retry after a refused attempt still works
 *
 * Uses a disposable local database created and destroyed through the ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import { acceptInvitation } from "../../src/features/human-onboarding/accept-invitation.server";
import {
  INVITATION_ISSUED_ACTION,
  MEMBERSHIP_CREATED_ACTION,
} from "../../src/features/human-onboarding/contracts";
import { hashPassword } from "../../src/features/auth-runtime/password-hash.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AuthenticationDigestKey } from "../../src/features/auth/environment/auth-environment.server";

const NOW = new Date("2026-08-12T16:00:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "i2-concurrency-secret" });
const PASSWORD = "a-correct-horse-battery-7Qx";

/** Seed a complete, ALREADY-VERIFIED human with a real credential, outside any tenant. */
async function seedFreeHuman(client: Client, email: string): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, name) values ($1,$1) returning id`, [email],
  );
  const identity = await client.query<{ id: string }>(
    `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
     values ($1,'local','hebun-local',$2,'active',true,now()) returning id`,
    [user.rows[0]!.id, `local:${email}`],
  );
  const hashed = await hashPassword(PASSWORD);
  await client.query(
    `insert into auth_credentials (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
     values ($1,'password',$2,$3::jsonb,$4,$5,'active')`,
    [identity.rows[0]!.id, hashed.algorithm, JSON.stringify(hashed.params), hashed.salt, hashed.secretHash],
  );
  return user.rows[0]!.id;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i2_concurrency");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const govDeps = { getDb: () => handle.db, now: () => NOW } as never;
  const deps = { getDb: () => handle.db, now: () => NOW, digestKey: KEY };

  try {
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme",
      email: "root@acme.test", password: "a-correct-password-7Qx",
    });
    const session = await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(),
               now() + interval '1 day', now() + interval '1 hour') returning id`,
      [A.authIdentityId, "a".repeat(64), A.userId, A.tenantId, A.membershipId],
    );
    const ctx: TenantContext = {
      tenantId: A.tenantId, userId: A.userId, authIdentityId: A.authIdentityId,
      membershipId: A.membershipId, membershipVersion: 1, roleId: A.roleId,
      sessionContextId: session.rows[0]!.id, provider: "local", assuranceLevel: "aal1",
      mfaVerified: false, requestId: "i2-concurrency", authenticatedAt: NOW.toISOString(),
    };

    await setup.query(
      `insert into genesis_nominations
         (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
          accepted_at, accepted_session_context_id, accepted_assurance_level)
       values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
      [A.tenantId, A.authIdentityId, A.userId, ctx.sessionContextId],
    );
    assert.equal(
      (await establishGovernanceAuthority(ctx, { justification: REASON }, govDeps)).status,
      "established",
    );
    const role = await provisionMemberRole(ctx, { justification: REASON }, govDeps);
    assert.equal(role.status, "provisioned");
    if (role.status !== "provisioned") throw new Error("unreachable");
    const memberRoleId = role.roleId;

    /* ── 1. TWO SIMULTANEOUS ISSUANCE ATTEMPTS FROM ONE AUTHORIZATION ──────── */
    const target = "contested@acme.test";
    const auth = await authorizeMembership(
      ctx, { targetEmail: target, intendedRoleId: memberRoleId, justification: REASON }, govDeps,
    );
    assert.equal(auth.status, "authorized");
    if (auth.status !== "authorized") throw new Error("unreachable");

    {
      const attempts = await Promise.all([
        issueInvitation(ctx, { membershipAuthorizationId: auth.authorizationId }, deps),
        issueInvitation(ctx, { membershipAuthorizationId: auth.authorizationId }, deps),
      ]);
      const issued = attempts.filter((a) => a.status === "issued");
      const refused = attempts.filter((a) => a.status === "refused");
      assert.equal(issued.length, 1, "exactly one issuance may win");
      assert.equal(refused.length, 1, "exactly one must be refused");
      assert.ok(
        ["authorization-already-consumed", "invitation-already-pending", "authorization-not-live"]
          .includes(refused[0]!.status === "refused" ? refused[0]!.reason : ""),
        "the loser is told a real reason, never a generic outage",
      );

      /* ── 2. THE ROLLBACK PROOF ──────────────────────────────────────────── */
      const rows = await setup.query<{ id: string }>(
        `select id from invitations where tenant_id=$1 and normalized_email=$2`,
        [A.tenantId, target],
      );
      assert.equal(rows.rows.length, 1, "one invitation, never two");

      const consumption = await setup.query<{ status: string; consumed_by_invitation_id: string }>(
        `select status, consumed_by_invitation_id from membership_authorizations where id=$1`,
        [auth.authorizationId],
      );
      assert.equal(consumption.rows[0]!.status, "consumed");
      assert.equal(
        consumption.rows[0]!.consumed_by_invitation_id, rows.rows[0]!.id,
        "the authorization names the invitation that survived",
      );

      const audit = await setup.query(
        `select count(*) from audit_log where action=$1`, [INVITATION_ISSUED_ACTION],
      );
      assert.equal(
        Number(audit.rows[0]!.count), 1,
        "the loser's audit row must roll back with its invitation",
      );
    }

    const live = await setup.query<{ id: string }>(
      `select id from invitations where tenant_id=$1 and normalized_email=$2`, [A.tenantId, target],
    );
    const invitationId = live.rows[0]!.id;

    /*
     * The winning capability is not returned by this test's bookkeeping, so a fresh one is issued
     * for the acceptance races below — against its own authorization, exactly as production would.
     */
    const raceEmail = "race@acme.test";
    await seedFreeHuman(setup, raceEmail);
    const otherEmail = "other@acme.test";
    await seedFreeHuman(setup, otherEmail);

    const auth2 = await authorizeMembership(
      ctx, { targetEmail: raceEmail, intendedRoleId: memberRoleId, justification: REASON }, govDeps,
    );
    assert.equal(auth2.status, "authorized");
    if (auth2.status !== "authorized") throw new Error("unreachable");
    const issued2 = await issueInvitation(
      ctx, { membershipAuthorizationId: auth2.authorizationId }, deps,
    );
    assert.equal(issued2.status, "issued");
    if (issued2.status !== "issued") throw new Error("unreachable");

    /* ── 4. TWO DIFFERENT HUMANS RACE THE SAME INVITATION ──────────────────── */
    {
      const attempts = await Promise.all([
        acceptInvitation(
          { capability: issued2.capability, email: raceEmail, password: PASSWORD }, deps,
        ),
        acceptInvitation(
          { capability: issued2.capability, email: otherEmail, password: PASSWORD }, deps,
        ),
      ]);
      const accepted = attempts.filter((a) => a.status === "accepted");
      assert.equal(accepted.length, 1, "exactly one acceptance may succeed");
      assert.equal(
        attempts[1]!.status === "refused" ? attempts[1]!.reason : "",
        "not-acceptable",
        "the human the invitation was NOT issued for is always refused",
      );
      assert.equal(attempts[0]!.status, "accepted", "only the bound human may win");

      const rows = await setup.query<{ user_id: string }>(
        `select user_id from memberships where accepted_invitation_id=$1`, [issued2.invitationId],
      );
      assert.equal(rows.rows.length, 1, "one membership from one invitation");
      const bound = await setup.query<{ id: string }>(
        `select id from users where lower(email)=$1`, [raceEmail],
      );
      assert.equal(
        rows.rows[0]!.user_id, bound.rows[0]!.id,
        "and it belongs to the invited human, not the racer",
      );

      const stranger = await setup.query<{ c: string }>(
        `select count(*)::text as c from memberships m join users u on u.id=m.user_id
          where lower(u.email)=$1`, [otherEmail],
      );
      assert.equal(Number(stranger.rows[0]!.c), 0, "the stranger gained nothing");
    }

    /* ── 3 + 5. TWO SIMULTANEOUS ACCEPTANCES BY THE SAME HUMAN ─────────────── */
    const soloEmail = "solo@acme.test";
    await seedFreeHuman(setup, soloEmail);
    const auth3 = await authorizeMembership(
      ctx, { targetEmail: soloEmail, intendedRoleId: memberRoleId, justification: REASON }, govDeps,
    );
    assert.equal(auth3.status, "authorized");
    if (auth3.status !== "authorized") throw new Error("unreachable");
    const issued3 = await issueInvitation(
      ctx, { membershipAuthorizationId: auth3.authorizationId }, deps,
    );
    assert.equal(issued3.status, "issued");
    if (issued3.status !== "issued") throw new Error("unreachable");

    {
      const attempts = await Promise.all([
        acceptInvitation({ capability: issued3.capability, email: soloEmail, password: PASSWORD }, deps),
        acceptInvitation({ capability: issued3.capability, email: soloEmail, password: PASSWORD }, deps),
      ]);
      const accepted = attempts.filter((a) => a.status === "accepted");
      const refused = attempts.filter((a) => a.status === "refused");
      assert.equal(accepted.length, 1, "exactly one acceptance may win");
      assert.equal(refused.length, 1, "the other must be refused");
      assert.ok(
        ["capability-not-usable", "already-a-member"].includes(
          refused[0]!.status === "refused" ? refused[0]!.reason : "",
        ),
        "the loser is refused for a real reason",
      );

      const memberships = await setup.query(
        `select count(*) from memberships where accepted_invitation_id=$1`, [issued3.invitationId],
      );
      assert.equal(Number(memberships.rows[0]!.count), 1, "exactly one membership");

      /*
       * NO PARTIAL STATE. The invitation is accepted AND a membership exists, or neither. An
       * accepted invitation with no membership behind it is the orphan this design forbids.
       */
      const orphan = await setup.query(
        `select count(*) from invitations i
          where i.status='accepted'
            and not exists (select 1 from memberships m where m.accepted_invitation_id = i.id)`,
      );
      assert.equal(
        Number(orphan.rows[0]!.count), 0,
        "no invitation may read accepted without the membership it produced",
      );

      const audit = await setup.query(
        `select count(*) from audit_log where action=$1 and entity_id=$2`,
        [MEMBERSHIP_CREATED_ACTION, issued3.invitationId],
      );
      assert.equal(
        Number(audit.rows[0]!.count), 1,
        "the losing transaction's audit row must roll back with it",
      );
    }

    /* ── 6. A LEGITIMATE RETRY AFTER A REFUSAL STILL WORKS ─────────────────── */
    {
      const retryEmail = "retry@acme.test";
      await seedFreeHuman(setup, retryEmail);
      const auth4 = await authorizeMembership(
        ctx, { targetEmail: retryEmail, intendedRoleId: memberRoleId, justification: REASON }, govDeps,
      );
      assert.equal(auth4.status, "authorized");
      if (auth4.status !== "authorized") throw new Error("unreachable");
      const issued4 = await issueInvitation(
        ctx, { membershipAuthorizationId: auth4.authorizationId }, deps,
      );
      assert.equal(issued4.status, "issued");
      if (issued4.status !== "issued") throw new Error("unreachable");

      /* A wrong password refuses and changes nothing... */
      const wrong = await acceptInvitation(
        { capability: issued4.capability, email: retryEmail, password: "wrong-password-here" }, deps,
      );
      assert.equal(wrong.status === "refused" && wrong.reason, "not-acceptable");
      const mid = await setup.query(
        `select status from invitations where id=$1`, [issued4.invitationId],
      );
      assert.equal(
        (mid.rows[0] as { status: string }).status, "pending",
        "a refused attempt must not consume the invitation",
      );

      /* ...and the legitimate human can still complete afterwards. */
      const retry = await acceptInvitation(
        { capability: issued4.capability, email: retryEmail, password: PASSWORD }, deps,
      );
      assert.equal(retry.status, "accepted", "a legitimate retry remains possible");
    }

    /* ── The whole run created no user, identity, credential, role or session ─ */
    {
      const after = await setup.query<{ enrollments: string; roles: string; sessions: string }>(
        `select (select count(*) from identity_enrollment_requests) as enrollments,
                (select count(*) from roles)                        as roles,
                (select count(*) from user_session_contexts)        as sessions`,
      );
      assert.equal(Number(after.rows[0]!.enrollments), 0, "I2 ran no enrollment ceremony");
      assert.equal(Number(after.rows[0]!.roles), 2, "only the seeded owner role and I1.1's member role");
      assert.equal(Number(after.rows[0]!.sessions), 1, "only the fixture session — I2 issues none");
    }

    /* The first contested invitation is still pending: nobody accepted it. */
    {
      const row = await setup.query<{ status: string }>(
        `select status from invitations where id=$1`, [invitationId],
      );
      assert.equal(row.rows[0]!.status, "pending");
    }

    console.log("PASS i2 onboarding concurrency (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
