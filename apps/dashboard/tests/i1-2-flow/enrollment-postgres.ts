/*
 * I1.2 — the TWO-KEY identity enrollment ceremony against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A brand-new human holding a live invitation capability can become a verified local Hebun
 *    identity with a first password credential — but ONLY after a human currently holding that
 *    tenant's Governance authority approved that specific submission. Invitation possession alone
 *    creates no user, no identity and no credential; and completion creates no membership, no
 *    session, no role and no authority of any kind."
 *
 * Plus the Director's attack matrix, each case marked below.
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
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { digestInvitationToken } from "../../src/features/identity-enrollment/enrollment-digest.server";
import {
  IDENTITY_ENROLLMENT_APPROVED_ACTION,
  IDENTITY_ENROLLMENT_COMPLETED_ACTION,
  IDENTITY_ENROLLMENT_DOMAIN,
  IDENTITY_ENROLLMENT_REJECTED_ACTION,
  IDENTITY_ENROLLMENT_SUBJECT_TYPE,
  MIN_ENROLLMENT_PASSWORD_LENGTH,
} from "../../src/features/identity-enrollment/contracts";
import { verifyPasswordCredential } from "../../src/features/auth-runtime/credential-repository.server";
import { findActiveLocalIdentityByEmail } from "../../src/features/auth-runtime/identity-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { AuthenticationDigestKey } from "../../src/features/auth/environment/auth-environment.server";

const NOW = new Date("2026-08-12T13:00:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";
const REFUSAL = "This submission does not match the handover I performed, so I am refusing it.";
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "i1-2-test-digest-secret" });
const GOOD_PASSWORD = "a-correct-horse-battery-7Qx";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, tag: string): TenantContext {
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
    requestId: tag,
    authenticatedAt: NOW.toISOString(),
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
  const role = await client.query<{ id: string }>(
    `insert into roles (tenant_id, name, type) values ($1, $2, 'operator') returning id`,
    [tenantId, `Role ${email}`],
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

/**
 * Issue an invitation directly. I2 does not exist, so the capability is minted here in test
 * infrastructure — the same way `r1-identity-seed` mints a credential for D1's tests. The digest is
 * computed by the PRODUCTION module, so the fixture is a real capability rather than a shortcut.
 */
async function issueCapability(
  client: Client,
  tenantId: string,
  roleId: string,
  inviterId: string,
  email: string,
  options: { readonly expiresInHours?: number } = {},
): Promise<{ readonly token: string; readonly invitationId: string }> {
  const token = randomBytes(32).toString("base64url");
  const hash = digestInvitationToken(token, KEY);
  /*
   * Timestamps are anchored to the test's own clock, never to `now()`. `invitations_expiry_chk`
   * requires `expires_at > issued_at`, so an ALREADY-LAPSED capability is expressed by moving BOTH
   * into the past rather than by inverting them — the constraint is a real one and the fixture
   * respects it instead of routing around it.
   */
  const hours = options.expiresInHours ?? 48;
  const expiresAt = new Date(NOW.getTime() + hours * 3600_000);
  const issuedAt = new Date(expiresAt.getTime() - 3600_000);
  const row = await client.query<{ id: string }>(
    `insert into invitations
       (tenant_id, normalized_email, intended_role_id, inviter_type, inviter_id,
        token_hash, token_version, status, issued_at, expires_at)
     values ($1, $2, $3, 'human', $4, $5, 1, 'pending', $6, $7)
     returning id`,
    [tenantId, email, roleId, inviterId, hash, issuedAt.toISOString(), expiresAt.toISOString()],
  );
  return { token, invitationId: row.rows[0]!.id };
}

async function counts(client: Client): Promise<Record<string, number>> {
  const row = await client.query<Record<string, string>>(`
    select (select count(*) from users)                        as users,
           (select count(*) from auth_identities)              as identities,
           (select count(*) from auth_credentials)             as credentials,
           (select count(*) from memberships)                  as memberships,
           (select count(*) from roles)                        as roles,
           (select count(*) from user_session_contexts)        as sessions,
           (select count(*) from identity_enrollment_requests) as enrollments,
           (select count(*) from knowledge_nodes)              as knowledge,
           (select count(*) from executions)                   as executions,
           (select count(*) from provider_connectivity_controls) as providers
  `);
  return Object.fromEntries(
    Object.entries(row.rows[0]!).map(([k, v]) => [k, Number(v)]),
  ) as Record<string, number>;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_2_enrollment");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const govDeps = { getDb: () => handle.db, now: () => NOW } as never;
  const deps = { getDb: () => handle.db, now: () => NOW, digestKey: KEY };

  try {
    /* ── 0. The migration applies to a real database ────────────────────────── */
    harness.migrateDatabase();
    await setup.connect();

    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "root@acme.test",
      password: "a-correct-password-7Qx",
    });
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "root@globex.test",
      password: "another-correct-password-8Rz",
    });

    const memberRole = await setup.query<{ id: string }>(
      `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
      [A.tenantId],
    );
    const memberRoleId = memberRole.rows[0]!.id;

    const aSession = await sessionRowFor(setup, A, "i1-2-a");
    const bSession = await sessionRowFor(setup, B, "i1-2-b");
    const rootCtx = contextFor(A, aSession, "i1-2-root");
    const foreignCtx = contextFor(B, bSession, "i1-2-foreign");

    /* Governance exists in both tenants. */
    for (const [seed, ctx] of [
      [A, rootCtx],
      [B, foreignCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seed.tenantId, seed.authIdentityId, seed.userId, ctx.sessionContextId],
      );
      assert.equal(
        (await establishGovernanceAuthority(ctx, { justification: REASON }, govDeps)).status,
        "established",
      );
    }

    const before = await counts(setup);

    /* ── ATTACK 1: an unrecognized capability cannot start a ceremony ───────── */
    {
      const r = await startIdentityEnrollment({ capability: "not-a-real-token" }, deps);
      assert.equal(r.status, "refused");
      assert.equal(r.status === "refused" && r.reason, "capability-unrecognized");
      assert.equal((await counts(setup)).enrollments, 0, "nothing was recorded");
    }

    /* ── ATTACK 2: an EXPIRED capability cannot start a ceremony ────────────── */
    {
      const expired = await issueCapability(
        setup, A.tenantId, memberRoleId, A.userId, "expired@acme.test", { expiresInHours: -1 },
      );
      const r = await startIdentityEnrollment({ capability: expired.token }, deps);
      assert.equal(r.status === "refused" && r.reason, "capability-not-usable");
    }

    /* ── ATTACK 3: a REVOKED capability cannot start a ceremony ─────────────── */
    {
      const cap = await issueCapability(
        setup, A.tenantId, memberRoleId, A.userId, "revoked@acme.test",
      );
      await setup.query(
        `update invitations set status='revoked', revoked_at=now(),
                                revocation_reason='withdrawn by the authority' where id=$1`,
        [cap.invitationId],
      );
      const r = await startIdentityEnrollment({ capability: cap.token }, deps);
      assert.equal(r.status === "refused" && r.reason, "capability-not-usable");
    }

    /* ── The legitimate ceremony begins. ────────────────────────────────────── */
    const NEW_EMAIL = "newcomer@acme.test";
    const cap = await issueCapability(setup, A.tenantId, memberRoleId, A.userId, NEW_EMAIL);
    const started = await startIdentityEnrollment({ capability: cap.token }, deps);
    assert.equal(started.status, "started");
    if (started.status !== "started") throw new Error("unreachable");
    const enrollmentId = started.enrollmentId;
    const continuation = started.continuationReference;

    /* ── ATTACKS 4/5/6/7: KEY 1 ALONE CREATES NOTHING GLOBAL ────────────────── */
    {
      const after = await counts(setup);
      assert.equal(after.users, before.users, "token alone must not create a user");
      assert.equal(after.identities, before.identities, "token alone must not create an identity");
      assert.equal(after.credentials, before.credentials, "token alone must not create a credential");
      assert.equal(after.memberships, before.memberships, "token alone must not create a membership");
      assert.equal(after.sessions, before.sessions, "token alone must not issue a session");
      assert.equal(after.enrollments, 1, "exactly one ceremony was recorded");

      const row = await setup.query<{ status: string; tenant_id: string; approval_decision_id: string | null }>(
        `select status, tenant_id, approval_decision_id from identity_enrollment_requests where id=$1`,
        [enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "pending");
      assert.equal(row.rows[0]!.tenant_id, A.tenantId, "the tenant came from the invitation");
      assert.equal(row.rows[0]!.approval_decision_id, null, "nothing has been approved");
    }

    /* ── ATTACK 26: the raw secret is nowhere, because none was supplied yet ── */
    {
      const leak = await setup.query(
        `select count(*) from identity_enrollment_requests
          where continuation_hash = $1`,
        [continuation],
      );
      assert.equal(Number(leak.rows[0]!.count), 0, "the raw continuation reference is never stored");
    }

    /* ── ATTACK 8: a PENDING ceremony cannot be completed ───────────────────── */
    {
      const r = await completeIdentityEnrollment(
        { capability: cap.token, continuationReference: continuation, password: GOOD_PASSWORD },
        deps,
      );
      assert.equal(r.status === "refused" && r.reason, "enrollment-not-approved");
      const after = await counts(setup);
      assert.equal(after.users, before.users, "a pending ceremony creates no user");
      assert.equal(after.credentials, before.credentials, "a pending ceremony creates no credential");
    }

    /* ── ATTACK 11: an ordinary member cannot approve ───────────────────────── */
    {
      const ordinary = await addMember(setup, A.tenantId, "ordinary@acme.test");
      const ctx = contextFor(ordinary, await sessionRowFor(setup, ordinary, "i1-2-ord"), "i1-2-ord");
      const r = await decideIdentityEnrollment(
        ctx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
      );
      assert.equal(r.status === "refused" && r.reason, "not-the-governance-authority");
    }

    /* ── ATTACK 12: an OWNER-band human without Governance authority cannot ─── */
    {
      const ownerBand = await seedLocalIdentity(setup, {
        companyName: "Acme Owner Band", companySlug: "acme-owner-band",
        email: "ownerband@acme.test", roleType: "owner",
      });
      /* Give them an owner-band membership INSIDE tenant A, so only Governance separates them. */
      const ownerRole = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, 'Owner B', 'owner') returning id`,
        [A.tenantId],
      );
      const m = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status)
         values ($1,$2,$3,'active') returning id`,
        [A.tenantId, ownerBand.userId, ownerRole.rows[0]!.id],
      );
      const seeded: Seeded = {
        tenantId: A.tenantId,
        userId: ownerBand.userId,
        authIdentityId: ownerBand.authIdentityId,
        membershipId: m.rows[0]!.id,
        roleId: ownerRole.rows[0]!.id,
      };
      const ctx = contextFor(seeded, await sessionRowFor(setup, seeded, "i1-2-own"), "i1-2-own");
      const r = await decideIdentityEnrollment(
        ctx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
      );
      assert.equal(
        r.status === "refused" && r.reason,
        "not-the-governance-authority",
        "an owner role is not Governance authority",
      );
    }

    /* ── ATTACK 14: a cross-tenant Governance authority cannot approve ──────── */
    {
      const r = await decideIdentityEnrollment(
        foreignCtx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
      );
      assert.equal(
        r.status === "refused" && r.reason,
        "enrollment-unresolvable",
        "another tenant's ceremony is indistinguishable from one that never existed",
      );
    }

    /* ── ATTACK 13: a REVOKED delegate cannot approve ───────────────────────── */
    {
      const delegate = await addMember(setup, A.tenantId, "delegate@acme.test");
      const delegated = await delegateGovernanceAuthority(
        rootCtx, { toUserId: delegate.userId, justification: REASON }, govDeps,
      );
      assert.equal(delegated.status, "delegated");
      const delCtx = contextFor(delegate, await sessionRowFor(setup, delegate, "i1-2-del"), "i1-2-del");

      /* While active, the delegate IS a legitimate second key — proven before revoking. */
      const rejectedEnrollment = await issueCapability(
        setup, A.tenantId, memberRoleId, A.userId, "refused@acme.test",
      );
      const toRefuse = await startIdentityEnrollment({ capability: rejectedEnrollment.token }, deps);
      assert.equal(toRefuse.status, "started");
      if (toRefuse.status !== "started") throw new Error("unreachable");

      const refusal = await decideIdentityEnrollment(
        delCtx, { enrollmentId: toRefuse.enrollmentId, decision: "reject", justification: REFUSAL },
        govDeps,
      );
      assert.equal(refusal.status, "rejected", "an active delegate may turn the second key");

      /* ── ATTACKS 9/10/29: a REJECTED ceremony creates nothing, and burns no slot ── */
      {
        const after = await counts(setup);
        assert.equal(after.users, before.users + 3, "only the three seeded members exist");
        assert.equal(after.credentials, before.credentials, "a refusal creates no credential");

        const claimed = await setup.query(
          `select count(*) from users where lower(email) = 'refused@acme.test'`,
        );
        assert.equal(
          Number(claimed.rows[0]!.count), 0,
          "a refused ceremony must not occupy the intended human's email slot",
        );
        const subject = await setup.query(
          `select count(*) from auth_identities where subject = 'local:refused@acme.test'`,
        );
        assert.equal(
          Number(subject.rows[0]!.count), 0,
          "a refused ceremony must not occupy the local identity subject slot",
        );

        const row = await setup.query<{ status: string; rejection_reason: string; approval_decision_id: string | null }>(
          `select status, rejection_reason, approval_decision_id
             from identity_enrollment_requests where id=$1`,
          [toRefuse.enrollmentId],
        );
        assert.equal(row.rows[0]!.status, "rejected");
        assert.ok(row.rows[0]!.rejection_reason.length > 0, "a refusal must say why");
        assert.equal(
          row.rows[0]!.approval_decision_id, null,
          "a refusal stores no approval decision — the CHECK pair forbids it",
        );

        /* The refusal's Governance decision is found the way every decision is: by subject. */
        const decision = await setup.query<{ decision_type: string; outcome: string }>(
          `select decision_type, outcome from decision_records
            where subject_type = $1 and subject_id = $2`,
          [IDENTITY_ENROLLMENT_SUBJECT_TYPE, toRefuse.enrollmentId],
        );
        assert.equal(decision.rows.length, 1);
        assert.equal(decision.rows[0]!.decision_type, "reject");
        assert.equal(decision.rows[0]!.outcome, "identity-enrollment-rejected");

        /* A rejected ceremony is terminal: the completion path refuses it too. */
        const late = await completeIdentityEnrollment(
          {
            capability: rejectedEnrollment.token,
            continuationReference: toRefuse.continuationReference,
            password: GOOD_PASSWORD,
          },
          deps,
        );
        assert.equal(late.status === "refused" && late.reason, "enrollment-not-approved");
      }

      /* Now revoke, and the same human loses the second key. */
      const revoked = await revokeGovernanceAuthority(
        rootCtx,
        {
          delegationDecisionId: delegated.status === "delegated" ? delegated.decisionId : "",
          justification: REASON,
        },
        govDeps,
      );
      assert.equal(revoked.status, "revoked");

      const after = await decideIdentityEnrollment(
        delCtx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
      );
      assert.equal(
        after.status === "refused" && after.reason,
        "not-the-governance-authority",
        "a revoked delegate is refused exactly like someone never delegated",
      );
    }

    /* ── KEY 2, turned legitimately by the bootstrap authority ──────────────── */
    const approved = await decideIdentityEnrollment(
      rootCtx, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
    );
    assert.equal(approved.status, "approved");
    if (approved.status !== "approved") throw new Error("unreachable");

    /* Approval alone still creates nothing global. */
    {
      const after = await counts(setup);
      assert.equal(after.credentials, before.credentials, "approval creates no credential");
      const claimed = await setup.query(
        `select count(*) from users where lower(email) = $1`, [NEW_EMAIL],
      );
      assert.equal(Number(claimed.rows[0]!.count), 0, "approval creates no user");

      const row = await setup.query<{ status: string; approved_by_actor_type: string; approved_by_actor_id: string }>(
        `select status, approved_by_actor_type, approved_by_actor_id
           from identity_enrollment_requests where id=$1`,
        [enrollmentId],
      );
      assert.equal(row.rows[0]!.status, "approved");
      assert.equal(row.rows[0]!.approved_by_actor_type, "human");
      assert.equal(row.rows[0]!.approved_by_actor_id, A.userId);

      const session = await setup.query<{ governance_domain: string }>(
        `select governance_domain from governance_sessions where id=$1`, [approved.sessionId],
      );
      assert.equal(session.rows[0]!.governance_domain, IDENTITY_ENROLLMENT_DOMAIN);

      const audit = await setup.query<{ action: string; result: string; metadata: Record<string, unknown> }>(
        `select action, result, metadata from audit_log where entity_id=$1`, [approved.decisionId],
      );
      assert.equal(audit.rows[0]!.action, IDENTITY_ENROLLMENT_APPROVED_ACTION);
      assert.equal(audit.rows[0]!.result, "committed");
      assert.equal(
        JSON.stringify(audit.rows[0]!.metadata).includes(NEW_EMAIL), false,
        "the invited address is never duplicated into audit",
      );
    }

    /* ── ATTACK 23 (part): a decided ceremony cannot be decided again ───────── */
    {
      /*
       * NARROWED, DELIBERATELY, AND THE REASON MATTERS.
       *
       * This used to assert that REJECTING an approved ceremony returns `already-decided`. That is
       * no longer true, and it was not a safety property — it was the bug. Approval is only
       * PERMISSION for Act 3, and a bearer who loses the browser binding can never spend it; the row
       * was then invisible to the read seam, unrejectable, and permanently held
       * `identity_enrollment_requests_one_live_per_invitation_uq` against a fresh submission. A real
       * ceremony stranded that way in production. Rejecting an approved-but-uncompleted ceremony is
       * now the documented recovery, proved end to end in `tests/stranded-enrollment-flow/`.
       *
       * What this block was really protecting — approval is a once-only transition out of `pending`
       * — is unchanged and is what it now asserts. The rejection is not performed here because the
       * rest of this file completes this same ceremony.
       */
      const second = await decideIdentityEnrollment(
        rootCtx, { enrollmentId, decision: "approve", justification: REFUSAL }, govDeps,
      );
      assert.equal(second.status === "refused" && second.reason, "already-decided");
    }

    /* ── ATTACK 18 (shape): a foreign continuation cannot redirect completion ── */
    {
      const r = await completeIdentityEnrollment(
        { capability: cap.token, continuationReference: "wrong-continuation", password: GOOD_PASSWORD },
        deps,
      );
      assert.equal(r.status === "refused" && r.reason, "continuation-unrecognized");
    }

    /* The right continuation with the WRONG capability is refused too. */
    {
      const other = await issueCapability(setup, A.tenantId, memberRoleId, A.userId, "other@acme.test");
      const r = await completeIdentityEnrollment(
        { capability: other.token, continuationReference: continuation, password: GOOD_PASSWORD },
        deps,
      );
      assert.equal(r.status === "refused" && r.reason, "continuation-unrecognized");
    }

    /* A password below policy is refused, and nothing is created. */
    {
      const r = await completeIdentityEnrollment(
        { capability: cap.token, continuationReference: continuation, password: "short" },
        deps,
      );
      assert.equal(r.status === "refused" && r.reason, "password-unacceptable");
      assert.ok(MIN_ENROLLMENT_PASSWORD_LENGTH >= 12);
      const claimed = await setup.query(
        `select count(*) from users where lower(email) = $1`, [NEW_EMAIL],
      );
      assert.equal(Number(claimed.rows[0]!.count), 0, "a refused password creates no user");
    }

    /* ── ACT 3: the ceremony completes ──────────────────────────────────────── */
    /* Counted immediately before, so the assertions below measure what COMPLETION did — not what
     * the accumulated fixtures did. Absolute totals would drift every time a fixture is added. */
    const beforeCompletion = await counts(setup);
    const completed = await completeIdentityEnrollment(
      { capability: cap.token, continuationReference: continuation, password: GOOD_PASSWORD },
      deps,
    );
    assert.equal(completed.status, "completed");
    if (completed.status !== "completed") throw new Error("unreachable");

    /* ── The human now exists, is verified, and can prove their password ────── */
    {
      const identity = await findActiveLocalIdentityByEmail(handle.db, NEW_EMAIL);
      assert.ok(identity, "the enrolled human resolves through the production identity resolver");
      assert.equal(identity!.userId, completed.userId);
      assert.equal(identity!.authIdentityId, completed.authIdentityId);
      assert.equal(identity!.provider, "local");
      assert.equal(identity!.issuer, "hebun-local");
      assert.equal(identity!.subject, `local:${NEW_EMAIL}`);

      const row = await setup.query<{ status: string; verified_at: string | null; is_primary: boolean }>(
        `select status, verified_at, is_primary from auth_identities where id=$1`,
        [completed.authIdentityId],
      );
      assert.equal(row.rows[0]!.status, "active");
      assert.ok(row.rows[0]!.verified_at !== null, "an active identity must carry a verification time");
      assert.equal(row.rows[0]!.is_primary, true);

      const verification = await verifyPasswordCredential(
        handle.db, completed.authIdentityId, GOOD_PASSWORD, NOW,
      );
      assert.equal(verification.outcome, "verified", "the credential the login path verifies with");

      const wrong = await verifyPasswordCredential(
        handle.db, completed.authIdentityId, "not-the-password-at-all", NOW,
      );
      assert.equal(wrong.outcome, "rejected");
    }

    /* ── ATTACKS 30/31/32/33/34/35: completion grants NOTHING ───────────────── */
    {
      const after = await counts(setup);
      assert.equal(after.memberships, beforeCompletion.memberships, "completion created no membership");
      assert.equal(after.sessions, beforeCompletion.sessions, "completion issued no session");
      assert.equal(after.roles, beforeCompletion.roles, "completion created or changed no role");
      assert.equal(after.knowledge, beforeCompletion.knowledge, "no Knowledge row was touched");
      assert.equal(after.executions, beforeCompletion.executions, "no execution row was touched");
      assert.equal(after.providers, beforeCompletion.providers, "no provider row was touched");
      assert.equal(after.users, beforeCompletion.users + 1, "completion created exactly one human");
      assert.equal(after.identities, beforeCompletion.identities + 1, "and exactly one identity");
      assert.equal(after.credentials, beforeCompletion.credentials + 1, "and exactly one credential");

      const membership = await setup.query(
        `select count(*) from memberships where user_id = $1`, [completed.userId],
      );
      assert.equal(Number(membership.rows[0]!.count), 0, "the enrolled human belongs to no tenant");

      const bootstrap = await setup.query(
        `select count(*) from decision_records where actor_id = $1`, [completed.userId],
      );
      assert.equal(Number(bootstrap.rows[0]!.count), 0, "the enrolled human holds no Governance authority");

      /* The invitation is still UNCONSUMED by a membership — that remains I2's act. */
      const invitation = await setup.query<{ status: string; accepted_by_user_id: string | null }>(
        `select status, accepted_by_user_id from invitations where id=$1`, [cap.invitationId],
      );
      assert.equal(invitation.rows[0]!.status, "pending", "I1.2 does not accept the invitation");
      assert.equal(invitation.rows[0]!.accepted_by_user_id, null);
    }

    /* ── ATTACKS 25/27/28: no secret material anywhere it must not be ───────── */
    {
      const enrollment = await setup.query<Record<string, unknown>>(
        `select * from identity_enrollment_requests where id=$1`, [enrollmentId],
      );
      const serialized = JSON.stringify(enrollment.rows[0]);
      assert.equal(serialized.includes(GOOD_PASSWORD), false, "no password in the enrollment artifact");
      assert.equal(serialized.includes(continuation), false, "no raw continuation reference stored");
      assert.equal(serialized.includes(cap.token), false, "no raw capability stored");

      const decisions = await setup.query<Record<string, unknown>>(
        `select * from decision_records where subject_type=$1`, [IDENTITY_ENROLLMENT_SUBJECT_TYPE],
      );
      const decisionText = JSON.stringify(decisions.rows);
      for (const secret of [GOOD_PASSWORD, continuation, cap.token]) {
        assert.equal(decisionText.includes(secret), false, "no secret material in a decision record");
      }

      const audits = await setup.query<Record<string, unknown>>(`select * from audit_log`);
      const auditText = JSON.stringify(audits.rows);
      for (const secret of [GOOD_PASSWORD, continuation, cap.token]) {
        assert.equal(auditText.includes(secret), false, "no secret material in audit");
      }
      const credentialColumns = await setup.query<{ salt: string; secret_hash: string }>(
        `select salt, secret_hash from auth_credentials where auth_identity_id=$1`,
        [completed.authIdentityId],
      );
      assert.equal(auditText.includes(credentialColumns.rows[0]!.salt), false, "no salt in audit");
      assert.equal(
        auditText.includes(credentialColumns.rows[0]!.secret_hash), false, "no secret hash in audit",
      );

      const completionAudit = await setup.query<{ action: string; actor_id: string }>(
        `select action, actor_id from audit_log where entity_id=$1 and action=$2`,
        [enrollmentId, IDENTITY_ENROLLMENT_COMPLETED_ACTION],
      );
      assert.equal(completionAudit.rows.length, 1, "completion is recorded once");
      assert.equal(
        completionAudit.rows[0]!.actor_id, completed.userId,
        "the actor is the human who just came into existence",
      );
    }

    /* ── ATTACK 24: the same ceremony cannot complete twice ─────────────────── */
    {
      const again = await completeIdentityEnrollment(
        { capability: cap.token, continuationReference: continuation, password: GOOD_PASSWORD },
        deps,
      );
      assert.equal(again.status === "refused" && again.reason, "enrollment-not-approved");
      const users = await setup.query(
        `select count(*) from users where lower(email) = $1`, [NEW_EMAIL],
      );
      assert.equal(Number(users.rows[0]!.count), 1, "exactly one human exists at that address");
    }

    /* ── ATTACK 24 (b): an existing human cannot start a second ceremony ────── */
    {
      /*
       * Issued by a DIFFERENT tenant, which is both the realistic case and the only representable
       * one: `invitations_pending_email_uq` already forbids a second pending invitation for the
       * same human inside one tenant. Tenant B wants the same person; the capability is perfectly
       * usable, so the refusal proves the EMAIL check and nothing else.
       */
      const bRole = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
        [B.tenantId],
      );
      const repeat = await issueCapability(
        setup, B.tenantId, bRole.rows[0]!.id, B.userId, NEW_EMAIL,
      );
      const r = await startIdentityEnrollment({ capability: repeat.token }, deps);
      assert.equal(
        r.status === "refused" && r.reason,
        "already-enrolled",
        "I1.2 bootstraps new humans only; an existing human is I2's path",
      );
    }

    /* ── ATTACK 15/16/17/19/20/21: the client supplies no authority-bearing value ── */
    {
      /*
       * Structural rather than behavioural: the input shapes carry no tenant, actor, user,
       * identity, role, membership or status field, so a forged one has nowhere to arrive. The
       * boundaries test asserts this against the source; here we prove the runtime consequence —
       * the tenant on the artifact came from the invitation row, and the approver from the session.
       */
      const row = await setup.query<{ tenant_id: string; approved_by_actor_id: string }>(
        `select tenant_id, approved_by_actor_id from identity_enrollment_requests where id=$1`,
        [enrollmentId],
      );
      assert.equal(row.rows[0]!.tenant_id, A.tenantId);
      assert.equal(row.rows[0]!.approved_by_actor_id, A.userId);
    }

    /* ── STEP 11: SELF-APPROVAL IS STRUCTURALLY IMPOSSIBLE ──────────────────── */
    {
      /*
       * The enrolled human now has an identity and a credential. They still have NO membership, so
       * `issueLocalSession` refuses them, so no TenantContext exists, so `resolveGovernanceAuthority`
       * can never be reached with them as the actor. Proven by the absence that causes it.
       */
      const membership = await setup.query(
        `select count(*) from memberships where user_id=$1`, [completed.userId],
      );
      assert.equal(Number(membership.rows[0]!.count), 0);

      /* And if a caller fabricated a context anyway, Governance still refuses them. */
      const fabricated: TenantContext = {
        ...rootCtx,
        userId: completed.userId,
        authIdentityId: completed.authIdentityId,
      };
      const r = await decideIdentityEnrollment(
        fabricated, { enrollmentId, decision: "approve", justification: REASON }, govDeps,
      );
      assert.equal(
        r.status === "refused" && r.reason,
        "not-the-governance-authority",
        "even a fabricated context does not make the enrolled human an authority",
      );
    }

    /* ── STEP 14: THE I2 HANDOFF STATE ──────────────────────────────────────── */
    {
      const state = await setup.query<{
        users: string; identities: string; credentials: string; memberships: string; invitation_status: string;
      }>(
        `select (select count(*) from users where id=$1)                                as users,
                (select count(*) from auth_identities where user_id=$1 and status='active') as identities,
                (select count(*) from auth_credentials c join auth_identities i on i.id=c.auth_identity_id
                  where i.user_id=$1 and c.status='active')                             as credentials,
                (select count(*) from memberships where user_id=$1)                     as memberships,
                (select status from invitations where id=$2)                            as invitation_status`,
        [completed.userId, cap.invitationId],
      );
      const row = state.rows[0]!;
      assert.equal(Number(row.users), 1, "a real user exists");
      assert.equal(Number(row.identities), 1, "a verified local identity exists");
      assert.equal(Number(row.credentials), 1, "an active credential exists");
      assert.equal(Number(row.memberships), 0, "membership remains I2's responsibility");
      assert.equal(row.invitation_status, "pending", "the invitation is unconsumed by a membership");
    }

    console.log("PASS i1.2 enrollment (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
