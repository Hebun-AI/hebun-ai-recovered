/*
 * Stranded approved enrollment recovery against a REAL PostgreSQL database.
 *
 * THE INCIDENT THIS CLOSES, IN THE ORDER IT HAPPENED:
 *
 *   A bearer submitted a capability, Governance approved it, and then the bearer's browser lost the
 *   continuation binding. Approval is only PERMISSION for Act 3, so the ceremony could never be
 *   completed. And it could not be undone either: the read seam listed only `pending`, the decision
 *   runtime refused anything not `pending`, and
 *   `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <> 'rejected'` —
 *   so an approved-but-uncompleted row was invisible, unrejectable, and blocked every fresh
 *   submission for that invitation forever. The product had already promised the bearer that "a
 *   Governance authority rejects the stranded ceremony, which frees the invitation for a fresh
 *   submission with the same capability". That sentence was not executable.
 *
 * This file proves the whole recovery, end to end, with the SAME capability and NO new C2 or C3.
 *
 * Uses disposable local databases, dropped on exit by their own ownership handle.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import { acceptInvitation } from "../../src/features/human-onboarding/accept-invitation.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { readPendingEnrollments } from "../../src/features/identity-enrollment/read-pending-enrollments.server";
import { generateContinuationReference } from "../../src/features/identity-enrollment/enrollment-digest.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-14T18:00:00.000Z");
const REASON = "The bearer lost the browser that started this ceremony and must begin again.";
const DIGEST_KEY = { version: 1, secret: "stranded-enrollment-recovery-test-secret" };
const NEWCOMER = "stranded@newcomer.test";
const NEWCOMER_PASSWORD = "a-brand-new-password-9Zk";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string): TenantContext {
  return {
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
    requestId: "stranded-recovery-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType: string,
): Promise<Seeded> {
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
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, $3) returning id`,
    [tenantId, `Role ${email}`, roleType],
  );
  const roleId = role.rows[0]!.id;
  const membership = await client.query<{ id: string }>(
    `insert into memberships (tenant_id, user_id, role_id, status)
     values ($1, $2, $3, 'active') returning id`,
    [tenantId, userId, roleId],
  );
  return {
    tenantId,
    userId,
    authIdentityId: identity.rows[0]!.id,
    membershipId: membership.rows[0]!.id,
    roleId,
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_stranded_recovery");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const bearerDeps = { getDb: () => handle.db, now: () => NOW, digestKey: DIGEST_KEY } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    const X = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "x@globex.test",
      password: "x-correct-password-4Lm",
    });
    const OWNER = await addMember(setup, A.tenantId, "owner@acme.test", "owner");
    const DELEGATE = await addMember(setup, A.tenantId, "delegate@acme.test", "auditor");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "bbbb"));
    const ctxOwner = contextFor(OWNER, await sessionRowFor(setup, OWNER, "cccc"));
    const ctxDelegate = contextFor(DELEGATE, await sessionRowFor(setup, DELEGATE, "dddd"));

    const establish = async (seeded: Seeded, ctx: TenantContext) => {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: REASON }, deps)).status,
        "established",
      );
    };
    await establish(A, ctxA);
    await establish(X, ctxX);

    const memberRoleOf = async (ctx: TenantContext): Promise<string> => {
      const role = await provisionMemberRole(ctx, { justification: REASON }, deps);
      if (role.status === "provisioned") return role.roleId;
      const existing = await setup.query<{ id: string }>(
        `select id from roles where tenant_id=$1 and type='member' limit 1`,
        [ctx.tenantId],
      );
      return existing.rows[0]!.id;
    };

    const counts = async () => {
      const row = await setup.query<Record<string, string>>(`
        select (select count(*) from users) users,
               (select count(*) from auth_identities) identities,
               (select count(*) from auth_credentials) credentials,
               (select count(*) from memberships) memberships,
               (select count(*) from audit_log) audit,
               (select count(*) from decision_records) decisions,
               (select count(*) from identity_enrollment_requests) enrollments
      `);
      return Object.fromEntries(
        Object.entries(row.rows[0]!).map(([k, v]) => [k, Number(v)]),
      ) as Record<string, number>;
    };

    /* ══ C2 → C3, ONCE. Everything below reuses this invitation and capability. ══ */
    const roleId = await memberRoleOf(ctxA);
    const authorized = await authorizeMembership(
      ctxA,
      { targetEmail: NEWCOMER, intendedRoleId: roleId, justification: REASON },
      deps,
    );
    assert.equal(authorized.status, "authorized");
    if (authorized.status !== "authorized") throw new Error("unreachable");

    const issued = await issueInvitation(
      ctxA,
      { membershipAuthorizationId: authorized.authorizationId },
      bearerDeps,
    );
    assert.equal(issued.status, "issued");
    if (issued.status !== "issued") throw new Error("unreachable");
    const CAPABILITY = issued.capability;
    const INVITATION = issued.invitationId;

    /* ══ ACT 1 — the bearer submits ═════════════════════════════════════════ */
    const first = await startIdentityEnrollment({ capability: CAPABILITY }, bearerDeps);
    assert.equal(first.status, "started");
    if (first.status !== "started") throw new Error("unreachable");

    /* ══ GOVERNANCE APPROVES ════════════════════════════════════════════════ */
    const approved = await decideIdentityEnrollment(
      ctxA,
      { enrollmentId: first.enrollmentId, decision: "approve", justification: REASON },
      deps,
    );
    assert.equal(approved.status, "approved");
    if (approved.status !== "approved") throw new Error("unreachable");
    const APPROVAL_DECISION = approved.decisionId;

    /* ══ THE BROWSER BINDING IS LOST ════════════════════════════════════════ */
    {
      /*
       * Simulated exactly as it happens in production: the bearer presents the right capability with
       * a continuation reference that is not the one Act 1 minted. Nothing is written.
       */
      const lost = await completeIdentityEnrollment(
        {
          capability: CAPABILITY,
          continuationReference: generateContinuationReference(),
          password: NEWCOMER_PASSWORD,
        },
        bearerDeps,
      );
      assert.equal(
        lost.status === "refused" && lost.reason,
        "continuation-unrecognized",
        "a foreign continuation cannot complete somebody else's ceremony",
      );
      const row = await setup.query<{ status: string; completed_at: string | null }>(
        `select status, completed_at from identity_enrollment_requests where id=$1`,
        [first.enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "approved", "the row is approved");
      assert.equal(row.rows[0]!.completed_at, null, "and uncompleted — STRANDED");
    }

    /* ══ THE OLD DEAD END: the same capability cannot start again ═══════════ */
    {
      const blocked = await startIdentityEnrollment({ capability: CAPABILITY }, bearerDeps);
      assert.equal(
        blocked.status === "refused" && blocked.reason,
        "enrollment-already-started",
        "the approved row blocks a fresh submission — this is what stranded the ceremony",
      );
    }

    /* ══ THE STRANDED ROW IS NOW VISIBLE TO GOVERNANCE ══════════════════════ */
    {
      const view = await readPendingEnrollments(ctxA, deps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      const row = view.view.pending.find((entry) => entry.enrollmentId === first.enrollmentId);
      assert.ok(row, "the stranded ceremony is listed — before this phase it was invisible");
      assert.equal(row!.strandedAfterApproval, true, "and labelled as approved, not as waiting");
      assert.ok(row!.approvedAt, "with the approval timestamp the approver can recognise");
      /* Still no address, still no secret. */
      const text = JSON.stringify(view.view);
      assert.equal(text.includes(NEWCOMER), false, "no address is duplicated");
      assert.equal(text.includes(CAPABILITY), false, "no capability, ever");
    }

    /* ══ IT STILL CANNOT BE APPROVED AGAIN ══════════════════════════════════ */
    {
      const again = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: first.enrollmentId, decision: "approve", justification: REASON },
        deps,
      );
      assert.equal(
        again.status === "refused" && again.reason,
        "already-decided",
        "approval remains a once-only transition out of pending",
      );
    }

    /* ══ AUTHORITY IS STILL REQUIRED TO RECOVER IT ══════════════════════════ */
    {
      for (const [label, ctx] of [
        ["unauthenticated", null],
        ["foreign tenant", ctxX],
        ["owner band without Governance", ctxOwner],
      ] as const) {
        const r = await decideIdentityEnrollment(
          ctx,
          { enrollmentId: first.enrollmentId, decision: "reject", justification: REASON },
          deps,
        );
        assert.equal(r.status, "refused", `${label} must be refused`);
      }
      /* A live delegate MAY, and a revoked one may not. */
      const delegated = await delegateGovernanceAuthority(
        ctxA,
        { toUserId: DELEGATE.userId, justification: REASON },
        deps,
      );
      assert.equal(delegated.status, "delegated");
      if (delegated.status !== "delegated") throw new Error("unreachable");
      await revokeGovernanceAuthority(
        ctxA,
        { delegationDecisionId: delegated.decisionId, justification: REASON },
        deps,
      );
      const revokedDelegate = await decideIdentityEnrollment(
        ctxDelegate,
        { enrollmentId: first.enrollmentId, decision: "reject", justification: REASON },
        deps,
      );
      assert.equal(
        revokedDelegate.status === "refused" && revokedDelegate.reason,
        "not-the-governance-authority",
        "a revoked delegate is refused exactly like a stranger",
      );
      /* A reason is still mandatory. */
      const noReason = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: first.enrollmentId, decision: "reject", justification: "too short" },
        deps,
      );
      assert.equal(noReason.status === "refused" && noReason.reason, "rejection-reason-required");
    }

    /* ══ THE RECOVERY ITSELF ════════════════════════════════════════════════ */
    const beforeRecovery = await counts();
    const recovered = await decideIdentityEnrollment(
      ctxA,
      { enrollmentId: first.enrollmentId, decision: "reject", justification: REASON },
      deps,
    );
    assert.equal(recovered.status, "rejected", "a stranded approved ceremony can now be released");

    /* ══ WHAT THE RECOVERY DID, AND DID NOT ═════════════════════════════════ */
    {
      const row = await setup.query<{
        status: string;
        rejected_at: string | null;
        rejection_reason: string | null;
        approved_at: string | null;
        approval_decision_id: string | null;
        approved_by_actor_id: string | null;
        completed_at: string | null;
      }>(
        `select status, rejected_at, rejection_reason, approved_at, approval_decision_id,
                approved_by_actor_id, completed_at
           from identity_enrollment_requests where id=$1`,
        [first.enrollmentId],
      );
      const r = row.rows[0]!;
      assert.equal(r.status, "rejected");
      assert.ok(r.rejected_at, "rejected_at is set");
      assert.equal(r.rejection_reason, REASON.slice(0, 128));
      assert.equal(r.completed_at, null);
      /*
       * The approval columns are cleared because `identity_enrollment_requests_approved_chk` welds
       * them to the approved/completed statuses in both directions. The APPROVAL ITSELF is not lost:
       * it is a Governance decision and lives in `decision_records`, which is asserted next.
       */
      assert.equal(r.approved_at, null);
      assert.equal(r.approval_decision_id, null);
      assert.equal(r.approved_by_actor_id, null);

      const approvalStillInLedger = await setup.query<{ count: string }>(
        `select count(*) from decision_records where id=$1 and subject_id=$2`,
        [APPROVAL_DECISION, first.enrollmentId],
      );
      assert.equal(
        Number(approvalStillInLedger.rows[0]!.count),
        1,
        "the original approval remains durable history in the Governance ledger",
      );

      /* The invitation is untouched — not revoked, not accepted, still usable. */
      const inv = await setup.query<{ status: string; revoked_at: string | null; accepted_at: string | null }>(
        `select status, revoked_at, accepted_at from invitations where id=$1`,
        [INVITATION],
      );
      assert.equal(inv.rows[0]!.status, "pending", "the invitation is NOT revoked");
      assert.equal(inv.rows[0]!.revoked_at, null);
      assert.equal(inv.rows[0]!.accepted_at, null);

      /* No account artifact was created or destroyed. */
      const after = await counts();
      assert.equal(after.users, beforeRecovery.users, "no user");
      assert.equal(after.identities, beforeRecovery.identities, "no identity");
      assert.equal(after.credentials, beforeRecovery.credentials, "no credential");
      assert.equal(after.memberships, beforeRecovery.memberships, "no membership");
      assert.equal(after.decisions, beforeRecovery.decisions + 1, "exactly one new decision");
      assert.equal(after.audit, beforeRecovery.audit + 1, "exactly one new audit row");
      assert.equal(after.enrollments, beforeRecovery.enrollments, "no new enrollment row");
    }

    /* ══ REPLAY: rejecting again refuses and writes nothing ═════════════════ */
    {
      const before = await counts();
      const again = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: first.enrollmentId, decision: "reject", justification: REASON },
        deps,
      );
      assert.equal(again.status === "refused" && again.reason, "already-decided");
      const after = await counts();
      assert.equal(after.audit, before.audit, "a refused replay writes no audit row");
      assert.equal(after.decisions, before.decisions, "and no decision");
    }

    /* ══ THE SAME CAPABILITY STARTS AGAIN — NO NEW C2, NO NEW C3 ════════════ */
    const second = await startIdentityEnrollment({ capability: CAPABILITY }, bearerDeps);
    assert.equal(
      second.status,
      "started",
      "the freed slot accepts a fresh submission with the SAME capability",
    );
    if (second.status !== "started") throw new Error("unreachable");
    assert.notEqual(second.enrollmentId, first.enrollmentId, "it is a new ceremony");

    /* The rejected ceremony remains, as history. */
    {
      const rows = await setup.query<{ count: string }>(
        `select count(*) from identity_enrollment_requests where invitation_id=$1`,
        [INVITATION],
      );
      assert.equal(Number(rows.rows[0]!.count), 2, "the rejected row and its successor coexist");
    }

    /* ══ SECOND APPROVAL, THEN COMPLETION ═══════════════════════════════════ */
    const approvedAgain = await decideIdentityEnrollment(
      ctxA,
      { enrollmentId: second.enrollmentId, decision: "approve", justification: REASON },
      deps,
    );
    assert.equal(approvedAgain.status, "approved");

    const completed = await completeIdentityEnrollment(
      {
        capability: CAPABILITY,
        continuationReference: second.continuationReference,
        password: NEWCOMER_PASSWORD,
      },
      bearerDeps,
    );
    assert.equal(completed.status, "completed", "the recovered ceremony completes normally");
    if (completed.status !== "completed") throw new Error("unreachable");

    /* ══ THE HUMAN NOW EXISTS, AND CAN JOIN ═════════════════════════════════ */
    {
      const user = await setup.query<{ count: string }>(
        `select count(*) from users where lower(email)=$1`,
        [NEWCOMER],
      );
      assert.equal(Number(user.rows[0]!.count), 1, "user created");
      const identity = await setup.query<{ count: string }>(
        `select count(*) from auth_identities where subject=$1`,
        [`local:${NEWCOMER}`],
      );
      assert.equal(Number(identity.rows[0]!.count), 1, "identity created");
      const credential = await setup.query<{ count: string }>(
        `select count(*) from auth_credentials ac join auth_identities ai on ai.id=ac.auth_identity_id
          where ai.subject=$1`,
        [`local:${NEWCOMER}`],
      );
      assert.equal(Number(credential.rows[0]!.count), 1, "credential created");

      const accepted = await acceptInvitation(
        { capability: CAPABILITY, email: NEWCOMER, password: NEWCOMER_PASSWORD },
        bearerDeps,
      );
      assert.equal(accepted.status, "accepted", "acceptance still creates the membership");
      if (accepted.status !== "accepted") throw new Error("unreachable");
      assert.equal(accepted.invitationId, INVITATION, "the SAME invitation, never reissued");
    }

    /* ══ A COMPLETED CEREMONY CAN NEVER BE REJECTED ════════════════════════ */
    {
      const r = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: second.enrollmentId, decision: "reject", justification: REASON },
        deps,
      );
      assert.equal(
        r.status === "refused" && r.reason,
        "already-decided",
        "a completed ceremony created a real human — rejecting it would claim to undo that",
      );
    }

    /* ══ NO NEW C2 AND NO NEW C3 WERE EVER NEEDED ══════════════════════════ */
    {
      const auths = await setup.query<{ count: string }>(
        `select count(*) from membership_authorizations where normalized_email=$1`,
        [NEWCOMER],
      );
      assert.equal(Number(auths.rows[0]!.count), 1, "exactly one authorization for the whole story");
      const invites = await setup.query<{ count: string }>(
        `select count(*) from invitations where normalized_email=$1`,
        [NEWCOMER],
      );
      assert.equal(Number(invites.rows[0]!.count), 1, "and exactly one invitation");
    }

    /* ══ CONCURRENCY: two stranded rejections, exactly one winner ══════════ */
    {
      const SECOND_TARGET = "raced@newcomer.test";
      const raceRole = await memberRoleOf(ctxA);
      const raceAuth = await authorizeMembership(
        ctxA,
        { targetEmail: SECOND_TARGET, intendedRoleId: raceRole, justification: REASON },
        deps,
      );
      assert.equal(raceAuth.status, "authorized");
      if (raceAuth.status !== "authorized") throw new Error("unreachable");
      const raceInvite = await issueInvitation(
        ctxA,
        { membershipAuthorizationId: raceAuth.authorizationId },
        bearerDeps,
      );
      assert.equal(raceInvite.status, "issued");
      if (raceInvite.status !== "issued") throw new Error("unreachable");

      const raceStart = await startIdentityEnrollment(
        { capability: raceInvite.capability },
        bearerDeps,
      );
      assert.equal(raceStart.status, "started");
      if (raceStart.status !== "started") throw new Error("unreachable");
      const raceApproved = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: raceStart.enrollmentId, decision: "approve", justification: REASON },
        deps,
      );
      assert.equal(raceApproved.status, "approved");

      const before = await counts();
      const [one, two] = await Promise.all([
        decideIdentityEnrollment(
          ctxA,
          { enrollmentId: raceStart.enrollmentId, decision: "reject", justification: REASON },
          deps,
        ),
        decideIdentityEnrollment(
          ctxA,
          { enrollmentId: raceStart.enrollmentId, decision: "reject", justification: REASON },
          deps,
        ),
      ]);
      assert.deepEqual(
        [one.status, two.status].sort(),
        ["refused", "rejected"],
        "exactly one concurrent stranded rejection wins",
      );
      const loser = one.status === "refused" ? one : two;
      assert.ok(
        loser.status === "refused" && loser.reason === "already-decided",
        "the loser gets a stable, honest refusal",
      );
      const after = await counts();
      assert.equal(after.decisions, before.decisions + 1, "exactly one decision, never two");
      assert.equal(after.audit, before.audit + 1, "exactly one audit row, never two");

      const row = await setup.query<{ status: string }>(
        `select status from identity_enrollment_requests where id=$1`,
        [raceStart.enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "rejected", "and exactly one durable transition");
    }

    console.log("PASS stranded enrollment recovery");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main();
