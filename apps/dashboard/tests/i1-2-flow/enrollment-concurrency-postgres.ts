/*
 * I1.2 — the enrollment invariants under REAL concurrency.
 *
 * WHY THIS FILE EXISTS. Every act in the ceremony reads before it writes, and every one of those
 * reads is a courtesy rather than a defense: two simultaneous callers both see "not started yet",
 * "still pending", "still approved" and both proceed. The database is what actually refuses the
 * second writer, and an invariant only the application enforces is not an invariant.
 *
 * Proven here, each against a real PostgreSQL instance:
 *
 *   1. two simultaneous Act 1 submissions against one capability  → one ceremony
 *   2. two simultaneous approvals                                 → one winner, one honest refusal
 *   3. approval racing rejection                                  → exactly one authoritative outcome
 *   4. two simultaneous completions                               → one human, one identity, one credential
 *   5. the losing transaction leaves NOTHING behind — no orphan decision, no orphan session,
 *      no orphan user, no orphan credential
 *
 * Uses a disposable local database, dropped on exit through the handle that created it.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { digestInvitationToken } from "../../src/features/identity-enrollment/enrollment-digest.server";
import { IDENTITY_ENROLLMENT_DOMAIN } from "../../src/features/identity-enrollment/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AuthenticationDigestKey } from "../../src/features/auth/environment/auth-environment.server";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-12T14:00:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";
const REFUSAL = "This submission does not match the handover I performed, so I am refusing it.";
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "i1-2-concurrency-secret" });
const PASSWORD = "a-correct-horse-battery-7Qx";

async function issueCapability(
  client: Client,
  tenantId: string,
  roleId: string,
  inviterId: string,
  email: string,
): Promise<{ readonly token: string; readonly invitationId: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(NOW.getTime() + 48 * 3600_000);
  const issuedAt = new Date(expiresAt.getTime() - 3600_000);
  const row = await client.query<{ id: string }>(
    `insert into invitations
       (tenant_id, normalized_email, intended_role_id, inviter_type, inviter_id,
        token_hash, token_version, status, issued_at, expires_at)
     values ($1,$2,$3,'human',$4,$5,1,'pending',$6,$7) returning id`,
    [
      tenantId, email, roleId, inviterId, digestInvitationToken(token, KEY),
      issuedAt.toISOString(), expiresAt.toISOString(),
    ],
  );
  return { token, invitationId: row.rows[0]!.id };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_2_concurrency");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const govDeps = { getDb: () => handle.db, now: () => NOW } as never;
  const deps = { getDb: () => handle.db, now: () => NOW, digestKey: KEY };

  try {
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "root@acme.test",
      password: "a-correct-password-7Qx",
    });
    const memberRole = await setup.query<{ id: string }>(
      `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
      [A.tenantId],
    );
    const memberRoleId = memberRole.rows[0]!.id;

    const session = await setup.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1,$2,1,$3,$4,$5,1,'aal1',false, now(), now(), now(),
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
      requestId: "i1-2-concurrency",
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
      (await establishGovernanceAuthority(ctx, { justification: REASON }, govDeps)).status,
      "established",
    );

    /* ── 1. TWO SIMULTANEOUS ACT 1 SUBMISSIONS ──────────────────────────────── */
    const cap = await issueCapability(setup, A.tenantId, memberRoleId, A.userId, "race@acme.test");
    {
      const attempts = await Promise.all([
        startIdentityEnrollment({ capability: cap.token }, deps),
        startIdentityEnrollment({ capability: cap.token }, deps),
      ]);
      const started = attempts.filter((a) => a.status === "started");
      const refused = attempts.filter((a) => a.status === "refused");
      assert.equal(started.length, 1, "exactly one submission may win");
      assert.equal(refused.length, 1, "exactly one submission must be refused");
      assert.equal(
        refused[0]!.status === "refused" ? refused[0]!.reason : "",
        "enrollment-already-started",
        "the loser must be told the truth, not that persistence failed",
      );

      const rows = await setup.query(
        `select count(*) from identity_enrollment_requests where invitation_id = $1`,
        [cap.invitationId],
      );
      assert.equal(Number(rows.rows[0]!.count), 1, "one ceremony per capability, never two");

      /* Neither attempt created anything global. */
      const global = await setup.query(
        `select (select count(*) from users where lower(email)='race@acme.test') as u,
                (select count(*) from auth_identities where subject='local:race@acme.test') as i`,
      );
      assert.equal(Number(global.rows[0]!.u), 0, "Act 1 creates no user");
      assert.equal(Number(global.rows[0]!.i), 0, "Act 1 creates no identity");
    }

    const first = await startIdentityEnrollment({ capability: cap.token }, deps);
    assert.equal(first.status, "refused", "the ceremony is already live");

    const live = await setup.query<{ id: string }>(
      `select id from identity_enrollment_requests where invitation_id=$1`, [cap.invitationId],
    );
    const enrollmentId = live.rows[0]!.id;

    /* ── 2. APPROVAL RACING REJECTION — exactly one authoritative outcome ───── */
    {
      const attempts = await Promise.all([
        decideIdentityEnrollment(
          ctx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
        ),
        decideIdentityEnrollment(
          ctx, { enrollmentId, decision: "reject", justification: REFUSAL }, govDeps,
        ),
      ]);
      const decided = attempts.filter((a) => a.status === "approved" || a.status === "rejected");
      const refused = attempts.filter((a) => a.status === "refused");
      assert.equal(decided.length, 1, "exactly one decision may stand");
      assert.equal(refused.length, 1, "the other must be refused");
      assert.equal(
        refused[0]!.status === "refused" ? refused[0]!.reason : "",
        "already-decided",
      );

      /*
       * THE ROLLBACK PROOF. The loser wrote its governance session, its decision and its audit row
       * inside the same transaction as the status transition, so losing the conditional update must
       * have taken all three with it. A committed decision with no corresponding ceremony state
       * would be exactly the orphan this design forbids.
       */
      const decisions = await setup.query(
        `select count(*) from decision_records
          where tenant_id=$1 and subject_type='identity_enrollment_request' and subject_id=$2`,
        [A.tenantId, enrollmentId],
      );
      assert.equal(Number(decisions.rows[0]!.count), 1, "the loser's decision must roll back");

      const sessions = await setup.query(
        `select count(*) from governance_sessions where tenant_id=$1 and governance_domain=$2`,
        [A.tenantId, IDENTITY_ENROLLMENT_DOMAIN],
      );
      assert.equal(Number(sessions.rows[0]!.count), 1, "no orphan governance session may survive");

      const audit = await setup.query(
        `select count(*) from audit_log
          where action in ('governance.identity.enrollment.approved',
                           'governance.identity.enrollment.rejected')`,
      );
      assert.equal(Number(audit.rows[0]!.count), 1, "history must not claim two decisions");
    }

    /* ── 3. TWO SIMULTANEOUS APPROVALS of a fresh, still-pending ceremony ───── */
    const second = await issueCapability(
      setup, A.tenantId, memberRoleId, A.userId, "twice@acme.test",
    );
    const secondStart = await startIdentityEnrollment({ capability: second.token }, deps);
    assert.equal(secondStart.status, "started");
    if (secondStart.status !== "started") throw new Error("unreachable");
    {
      const attempts = await Promise.all([
        decideIdentityEnrollment(
          ctx,
          { enrollmentId: secondStart.enrollmentId, decision: "approve", justification: REASON },
          govDeps,
        ),
        decideIdentityEnrollment(
          ctx,
          { enrollmentId: secondStart.enrollmentId, decision: "approve", justification: REASON },
          govDeps,
        ),
      ]);
      assert.equal(attempts.filter((a) => a.status === "approved").length, 1);
      assert.equal(attempts.filter((a) => a.status === "refused").length, 1);

      const row = await setup.query<{ status: string; approval_decision_id: string }>(
        `select status, approval_decision_id from identity_enrollment_requests where id=$1`,
        [secondStart.enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "approved");
      const approved = attempts.find((a) => a.status === "approved")!;
      assert.equal(
        row.rows[0]!.approval_decision_id,
        approved.status === "approved" ? approved.decisionId : "",
        "the surviving decision is the one the row names",
      );
    }

    /* ── 4. TWO SIMULTANEOUS COMPLETIONS ────────────────────────────────────── */
    {
      const attempts = await Promise.all([
        completeIdentityEnrollment(
          {
            capability: second.token,
            continuationReference: secondStart.continuationReference,
            password: PASSWORD,
          },
          deps,
        ),
        completeIdentityEnrollment(
          {
            capability: second.token,
            continuationReference: secondStart.continuationReference,
            password: PASSWORD,
          },
          deps,
        ),
      ]);
      const completed = attempts.filter((a) => a.status === "completed");
      const refused = attempts.filter((a) => a.status === "refused");
      assert.equal(completed.length, 1, "exactly one completion may win");
      assert.equal(refused.length, 1, "the other must be refused");
      assert.ok(
        ["enrollment-not-approved", "already-enrolled"].includes(
          refused[0]!.status === "refused" ? refused[0]!.reason : "",
        ),
        "the loser is refused for a real reason, never a generic outage",
      );

      /*
       * EXACTLY ONE HUMAN. Both the conditional completion and the two global unique indexes are
       * candidates for stopping the second writer; whichever fires, the outcome must be one user,
       * one identity and one active credential — never a duplicate, and never a half-built human.
       */
      const rows = await setup.query<{ u: string; i: string; c: string }>(
        `select (select count(*) from users where lower(email)='twice@acme.test')                 as u,
                (select count(*) from auth_identities where subject='local:twice@acme.test')      as i,
                (select count(*) from auth_credentials c
                   join auth_identities ai on ai.id = c.auth_identity_id
                  where ai.subject='local:twice@acme.test' and c.status='active')                 as c`,
      );
      assert.equal(Number(rows.rows[0]!.u), 1, "exactly one human");
      assert.equal(Number(rows.rows[0]!.i), 1, "exactly one identity");
      assert.equal(Number(rows.rows[0]!.c), 1, "exactly one active credential");

      /* The losing transaction left no half-built human behind. */
      const orphanIdentity = await setup.query(
        `select count(*) from auth_identities ai
          where ai.subject='local:twice@acme.test'
            and not exists (select 1 from auth_credentials c where c.auth_identity_id = ai.id)`,
      );
      assert.equal(
        Number(orphanIdentity.rows[0]!.count), 0,
        "an identity with no credential would claim onboarding succeeded when it did not",
      );

      const row = await setup.query<{ status: string; enrolled_auth_identity_id: string }>(
        `select status, enrolled_auth_identity_id from identity_enrollment_requests where id=$1`,
        [secondStart.enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "completed");
      assert.equal(
        row.rows[0]!.enrolled_auth_identity_id,
        completed[0]!.status === "completed" ? completed[0]!.authIdentityId : "",
      );
    }

    /* ── 5. Nothing downstream was created by any of it ─────────────────────── */
    {
      const after = await setup.query<{ m: string; s: string }>(
        `select (select count(*) from memberships) as m,
                (select count(*) from user_session_contexts) as s`,
      );
      assert.equal(Number(after.rows[0]!.m), 1, "only the seeded membership exists");
      assert.equal(Number(after.rows[0]!.s), 1, "only the seeded session exists");
    }

    console.log("PASS i1.2 enrollment concurrency (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
