/*
 * Invitation revocation against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION, IN THE WORDS OF THE INCIDENT THAT PRODUCED IT:
 *
 *   A one-time onboarding capability was lost before it was spent. It is unrecoverable by design.
 *   The invitation stayed `pending`, `invitations_pending_email_uq` is keyed on exactly that status,
 *   and nothing ever wrote `expired` or `revoked` — so the tenant/address slot was held forever and
 *   no replacement could be issued. Waiting for expiry did not help, because expiry is a predicate
 *   the runtime evaluates, never a state it records.
 *
 *   This file proves revocation ends that invitation, frees the slot, leaves the consumed
 *   authorization consumed, and makes the lost capability permanently unusable.
 *
 * Plus the full attack matrix: authority, tenant isolation, replay, concurrency, and the states that
 * must refuse.
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
import { revokeInvitation } from "../../src/features/human-onboarding/revoke-invitation.server";
import { readRevocableInvitations } from "../../src/features/human-onboarding/read-revocable-invitations.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { acceptInvitation } from "../../src/features/human-onboarding/accept-invitation.server";
import { INVITATION_REVOKED_ACTION } from "../../src/features/human-onboarding/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-14T12:00:00.000Z");
const REASON = "The one-time capability was lost before use and must not remain spendable.";
const DIGEST_KEY = { version: 1, secret: "invitation-revocation-test-secret-value" };
const NEWCOMER_PASSWORD = "a-brand-new-password-9Zk";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(seeded: Seeded, sessionContextId: string, at: Date = NOW): TenantContext {
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
    requestId: "revocation-request",
    authenticatedAt: at.toISOString(),
  });
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
  const harness = createDisposablePostgresHarness("hebun_invitation_revocation");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const bearerDeps = { getDb: () => handle.db, now: () => NOW, digestKey: DIGEST_KEY } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed two tenants with Governance authority, plus non-authority humans. ── */
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
    /* The strongest PRODUCT band, and no Governance authority. */
    const OWNER = await addMember(setup, A.tenantId, "owner@acme.test", "owner");
    /* An ordinary member. */
    const MEMBER = await addMember(setup, A.tenantId, "member@acme.test", "member");
    /* A human who will receive, then lose, a Governance delegation. */
    const DELEGATE = await addMember(setup, A.tenantId, "delegate@acme.test", "auditor");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "bbbb"));
    const ctxOwner = contextFor(OWNER, await sessionRowFor(setup, OWNER, "cccc"));
    const ctxMember = contextFor(MEMBER, await sessionRowFor(setup, MEMBER, "dddd"));
    const ctxDelegate = contextFor(DELEGATE, await sessionRowFor(setup, DELEGATE, "eeee"));

    const establish = async (seeded: Seeded, ctx: TenantContext) => {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const result = await establishGovernanceAuthority(ctx, { justification: REASON }, deps);
      assert.equal(result.status, "established");
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

    /** Authorize + issue, returning both ids and the plaintext capability. */
    const issueFor = async (
      ctx: TenantContext,
      email: string,
      at: Date = NOW,
    ): Promise<{ authorizationId: string; invitationId: string; capability: string }> => {
      const roleId = await memberRoleOf(ctx);
      const authorized = await authorizeMembership(
        ctx,
        { targetEmail: email, intendedRoleId: roleId, justification: REASON },
        deps,
      );
      assert.equal(authorized.status, "authorized");
      if (authorized.status !== "authorized") throw new Error("unreachable");
      const issued = await issueInvitation(
        ctx,
        { membershipAuthorizationId: authorized.authorizationId },
        { getDb: () => handle.db, now: () => at, digestKey: DIGEST_KEY } as never,
      );
      assert.equal(issued.status, "issued");
      if (issued.status !== "issued") throw new Error("unreachable");
      return {
        authorizationId: authorized.authorizationId,
        invitationId: issued.invitationId,
        capability: issued.capability,
      };
    };

    const auditCount = async (): Promise<number> =>
      Number(
        (await setup.query<{ count: string }>(`select count(*) from audit_log`)).rows[0]!.count,
      );

    /* ══ THE INCIDENT, REPRODUCED: a capability that cannot be spent ═════════ */
    const lost = await issueFor(ctxA, "lost@newcomer.test");

    /* ══ ATTACK 1: unauthenticated ═══════════════════════════════════════════ */
    {
      const r = await revokeInvitation(null, { invitationId: lost.invitationId, reason: REASON }, deps);
      assert.equal(r.status === "refused" && r.reason, "unauthenticated");
    }

    /* ══ ATTACK 2: an ordinary member ════════════════════════════════════════ */
    {
      const r = await revokeInvitation(ctxMember, { invitationId: lost.invitationId, reason: REASON }, deps);
      assert.equal(r.status === "refused" && r.reason, "not-the-governance-authority");
    }

    /* ══ ATTACK 3: the OWNER band, which is not Governance authority ═════════ */
    {
      const r = await revokeInvitation(ctxOwner, { invitationId: lost.invitationId, reason: REASON }, deps);
      assert.equal(
        r.status === "refused" && r.reason,
        "not-the-governance-authority",
        "the strongest product role is still not Governance authority",
      );
    }

    /* ══ ATTACK 4: another tenant's authority ════════════════════════════════ */
    {
      const r = await revokeInvitation(ctxX, { invitationId: lost.invitationId, reason: REASON }, deps);
      assert.equal(
        r.status === "refused" && r.reason,
        "invitation-unresolvable",
        "cross-tenant is indistinguishable from nonexistent",
      );
    }

    /* ══ ATTACK 5: a guessed identifier ══════════════════════════════════════ */
    for (const guess of ["00000000-0000-4000-8000-000000000000", "not-a-uuid", ""]) {
      const r = await revokeInvitation(ctxA, { invitationId: guess, reason: REASON }, deps);
      assert.equal(r.status === "refused" && r.reason, "invitation-unresolvable");
    }

    /* ══ ATTACK 6: a reason that is missing or too short ═════════════════════ */
    for (const bad of ["", "too short", "   ", "x".repeat(2001)]) {
      const r = await revokeInvitation(ctxA, { invitationId: lost.invitationId, reason: bad }, deps);
      assert.equal(r.status === "refused" && r.reason, "reason-required");
    }

    /* Nothing above changed anything. */
    {
      const row = await setup.query<{ status: string; revoked_at: string | null }>(
        `select status, revoked_at from invitations where id=$1`,
        [lost.invitationId],
      );
      assert.equal(row.rows[0]!.status, "pending");
      assert.equal(row.rows[0]!.revoked_at, null);
    }

    /* ══ A REVOKED DELEGATE IS REFUSED LIKE A STRANGER ═══════════════════════ */
    {
      const delegated = await delegateGovernanceAuthority(
        ctxA,
        { toUserId: DELEGATE.userId, justification: REASON },
        deps,
      );
      assert.equal(delegated.status, "delegated");
      if (delegated.status !== "delegated") throw new Error("unreachable");

      /* While delegated, the delegate MAY revoke — proved by a separate invitation below. */
      const delegateTarget = await issueFor(ctxA, "delegate-target@newcomer.test");
      const allowed = await revokeInvitation(
        ctxDelegate,
        { invitationId: delegateTarget.invitationId, reason: REASON },
        deps,
      );
      assert.equal(allowed.status, "revoked", "a live delegation carries revocation authority");

      await revokeGovernanceAuthority(
        ctxA,
        { delegationDecisionId: delegated.decisionId, justification: REASON },
        deps,
      );
      const refusedNow = await revokeInvitation(
        ctxDelegate,
        { invitationId: lost.invitationId, reason: REASON },
        deps,
      );
      assert.equal(
        refusedNow.status === "refused" && refusedNow.reason,
        "not-the-governance-authority",
        "a revoked delegate is refused exactly like someone never delegated",
      );
    }

    /* ══ THE READ SEAM ═══════════════════════════════════════════════════════ */
    {
      const view = await readRevocableInvitations(ctxA, deps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      assert.equal(view.view.viewerIsGovernanceAuthority, true);
      assert.ok(
        view.view.revocable.some((row) => row.invitationId === lost.invitationId),
        "the outstanding invitation is listed",
      );
      const text = JSON.stringify(view.view);
      assert.equal(text.includes("lost@newcomer.test"), false, "no address is duplicated");
      assert.equal(text.includes(lost.capability), false, "no capability, ever");
      assert.equal(/[0-9a-f]{64}/.test(text), false, "no digest is exposed");

      /* Non-authorities see nothing. */
      for (const ctx of [ctxOwner, ctxMember]) {
        const empty = await readRevocableInvitations(ctx, deps);
        assert.equal(empty.status, "read");
        if (empty.status !== "read") throw new Error("unreachable");
        assert.deepEqual(empty.view.revocable, []);
      }
      /* Another tenant sees only its own. */
      const other = await readRevocableInvitations(ctxX, deps);
      if (other.status !== "read") throw new Error("unreachable");
      assert.ok(
        !other.view.revocable.some((row) => row.invitationId === lost.invitationId),
        "cross-tenant invitations are not listed",
      );
    }

    /* ══ THE HAPPY PATH ══════════════════════════════════════════════════════ */
    const beforeRevokeAudit = await auditCount();
    const revoked = await revokeInvitation(
      ctxA,
      { invitationId: lost.invitationId, reason: REASON },
      deps,
    );
    assert.equal(revoked.status, "revoked");
    if (revoked.status !== "revoked") throw new Error("unreachable");
    assert.equal(revoked.wasAlreadyExpiredByClock, false, "this one was still live");

    /* ══ THE DURABLE ROW ═════════════════════════════════════════════════════ */
    {
      const row = await setup.query<{
        status: string;
        revoked_at: string | null;
        revoked_by_type: string | null;
        revoked_by_id: string | null;
        revocation_reason: string | null;
        token_hash: string;
        accepted_at: string | null;
      }>(
        `select status, revoked_at, revoked_by_type, revoked_by_id, revocation_reason, token_hash, accepted_at
           from invitations where id=$1`,
        [lost.invitationId],
      );
      const r = row.rows[0]!;
      assert.equal(r.status, "revoked");
      assert.ok(r.revoked_at, "revoked_at is set");
      assert.equal(r.revoked_by_type, "human");
      assert.equal(r.revoked_by_id, A.userId, "the accountable human, from the session");
      assert.equal(r.revocation_reason, REASON.slice(0, 128));
      assert.ok(r.revocation_reason!.length <= 128, "the column bound is respected");
      assert.equal(r.accepted_at, null, "revoking is not accepting");
      assert.match(r.token_hash, /^[0-9a-f]{64}$/, "the digest is NOT rotated or cleared");
    }

    /* ══ REVOKED IS NOT DELETED ══════════════════════════════════════════════ */
    {
      const still = await setup.query<{ count: string }>(
        `select count(*) from invitations where id=$1`,
        [lost.invitationId],
      );
      assert.equal(Number(still.rows[0]!.count), 1, "the row and its history remain");
    }

    /* ══ THE AUTHORIZATION STAYS CONSUMED — THE CRITICAL INVARIANT ══════════ */
    {
      const auth = await setup.query<{
        status: string;
        consumed_at: string | null;
        consumed_by_invitation_id: string | null;
        revoked_at: string | null;
      }>(
        `select status, consumed_at, consumed_by_invitation_id, revoked_at
           from membership_authorizations where id=$1`,
        [lost.authorizationId],
      );
      const a = auth.rows[0]!;
      assert.equal(a.status, "consumed", "revocation must NOT un-consume the authorization");
      assert.ok(a.consumed_at, "consumed_at survives");
      assert.equal(a.consumed_by_invitation_id, lost.invitationId, "provenance survives");
      assert.equal(a.revoked_at, null, "the authorization itself was not revoked");
    }

    /* ══ EXACTLY ONE AUDIT ROW, AND IT CARRIES NO SECRET ════════════════════ */
    {
      assert.equal(await auditCount(), beforeRevokeAudit + 1, "exactly one new audit row");
      const audit = await setup.query<Record<string, unknown>>(
        `select * from audit_log where action=$1 and entity_id=$2`,
        [INVITATION_REVOKED_ACTION, lost.invitationId],
      );
      assert.equal(audit.rows.length, 1);
      const row = audit.rows[0]!;
      assert.equal(row.actor_type, "human");
      assert.equal(row.actor_id, A.userId);
      assert.equal(row.entity_type, "invitation");
      const text = JSON.stringify(row);
      assert.equal(text.includes(lost.capability), false, "no plaintext capability in audit");
      assert.equal(text.includes("lost@newcomer.test"), false, "the address is not duplicated");
      assert.equal(text.includes(REASON), false, "the reason lives on the row, not in history");
      assert.equal(
        (row.metadata as { authorizationRemainsConsumed?: boolean }).authorizationRemainsConsumed,
        true,
        "history states the authorization was not returned",
      );
    }

    /* ══ THE LOST CAPABILITY IS NOW PERMANENTLY UNUSABLE ════════════════════ */
    {
      const enroll = await startIdentityEnrollment({ capability: lost.capability }, bearerDeps);
      assert.equal(
        enroll.status === "refused" && enroll.reason,
        "capability-not-usable",
        "Act 1 refuses a revoked invitation",
      );
      const accept = await acceptInvitation(
        { capability: lost.capability, email: "lost@newcomer.test", password: NEWCOMER_PASSWORD },
        bearerDeps,
      );
      assert.equal(
        accept.status === "refused" && accept.reason,
        "capability-not-usable",
        "acceptance refuses a revoked invitation",
      );
      const enrollments = await setup.query<{ count: string }>(
        `select count(*) from identity_enrollment_requests`,
      );
      assert.equal(Number(enrollments.rows[0]!.count), 0, "no enrollment, no identity, no membership");
    }

    /* ══ REPLAY: revoking again refuses, and writes nothing ═════════════════ */
    {
      const before = await auditCount();
      const again = await revokeInvitation(
        ctxA,
        { invitationId: lost.invitationId, reason: REASON },
        deps,
      );
      assert.equal(again.status === "refused" && again.reason, "invitation-not-revocable");
      assert.equal(await auditCount(), before, "a refused replay writes no audit row");
    }

    /* ══ RECOVERY A: the slot is free, and the full flow works again ════════ */
    {
      const replacement = await issueFor(ctxA, "lost@newcomer.test");
      assert.notEqual(replacement.invitationId, lost.invitationId);
      assert.notEqual(replacement.authorizationId, lost.authorizationId);
      assert.notEqual(replacement.capability, lost.capability);

      const rows = await setup.query<{ count: string }>(
        `select count(*) from invitations where tenant_id=$1 and normalized_email='lost@newcomer.test'`,
        [A.tenantId],
      );
      assert.equal(Number(rows.rows[0]!.count), 2, "the revoked one and its replacement coexist");

      /* The OLD capability is still dead even though a new invitation now exists. */
      const stale = await startIdentityEnrollment({ capability: lost.capability }, bearerDeps);
      assert.equal(
        stale.status === "refused" && stale.reason,
        "capability-not-usable",
        "a replacement does not resurrect the lost capability",
      );
      /* The NEW one works. */
      const fresh = await startIdentityEnrollment({ capability: replacement.capability }, bearerDeps);
      assert.equal(fresh.status, "started", "the replacement capability is spendable");
    }

    /* ══ RECOVERY B: an invitation lapsed by the clock is still revocable ═══ */
    {
      const LATER = new Date(NOW.getTime() + 100 * 3600_000);
      const stale = await issueFor(ctxA, "stale@newcomer.test");

      const lateDeps = { getDb: () => handle.db, now: () => LATER } as never;
      const lateCtx = contextFor(A, ctxA.sessionContextId!, LATER);

      /* It is unusable by predicate... */
      const unusable = await startIdentityEnrollment(
        { capability: stale.capability },
        { getDb: () => handle.db, now: () => LATER, digestKey: DIGEST_KEY } as never,
      );
      assert.equal(unusable.status === "refused" && unusable.reason, "capability-not-usable");
      /* ...but the row still says `pending`, which is exactly the defect that stranded the slot. */
      const before = await setup.query<{ status: string }>(
        `select status from invitations where id=$1`,
        [stale.invitationId],
      );
      assert.equal(before.rows[0]!.status, "pending", "expiry is a predicate, not a recorded state");

      const cleaned = await revokeInvitation(
        lateCtx,
        { invitationId: stale.invitationId, reason: REASON },
        lateDeps,
      );
      assert.equal(cleaned.status, "revoked", "a lapsed invitation is revocable");
      if (cleaned.status !== "revoked") throw new Error("unreachable");
      assert.equal(cleaned.wasAlreadyExpiredByClock, true, "and it says which case it was");

      /* Slot freed: a fresh flow is possible for that address. */
      const fresh = await issueFor(ctxA, "stale@newcomer.test", LATER);
      assert.ok(fresh.invitationId, "a replacement can be issued after cleanup");
    }

    /* ══ AN ACCEPTED INVITATION CANNOT BE REVOKED ══════════════════════════ */
    {
      const joiner = await issueFor(ctxA, "joiner@newcomer.test");
      const enroll = await startIdentityEnrollment({ capability: joiner.capability }, bearerDeps);
      assert.equal(enroll.status, "started");

      /* Create the human directly through the identity authority path used by Act 3. */
      const { decideIdentityEnrollment } = await import(
        "../../src/features/identity-enrollment/decide-enrollment.server"
      );
      const { completeIdentityEnrollment } = await import(
        "../../src/features/identity-enrollment/complete-enrollment.server"
      );
      if (enroll.status !== "started") throw new Error("unreachable");
      const approved = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: enroll.enrollmentId, decision: "approve", justification: REASON },
        deps,
      );
      assert.equal(approved.status, "approved");
      const completed = await completeIdentityEnrollment(
        {
          capability: joiner.capability,
          continuationReference: enroll.continuationReference,
          password: NEWCOMER_PASSWORD,
        },
        bearerDeps,
      );
      assert.equal(completed.status, "completed");
      const accepted = await acceptInvitation(
        { capability: joiner.capability, email: "joiner@newcomer.test", password: NEWCOMER_PASSWORD },
        bearerDeps,
      );
      assert.equal(accepted.status, "accepted");

      const r = await revokeInvitation(
        ctxA,
        { invitationId: joiner.invitationId, reason: REASON },
        deps,
      );
      assert.equal(
        r.status === "refused" && r.reason,
        "invitation-not-revocable",
        "an invitation that produced a membership cannot be withdrawn",
      );
      const membership = await setup.query<{ count: string }>(
        `select count(*) from memberships where accepted_invitation_id=$1`,
        [joiner.invitationId],
      );
      assert.equal(Number(membership.rows[0]!.count), 1, "the membership is untouched");
    }

    /* ══ CONCURRENCY: two revocations, exactly one winner ══════════════════ */
    {
      const raced = await issueFor(ctxA, "raced@newcomer.test");
      const before = await auditCount();

      const [one, two] = await Promise.all([
        revokeInvitation(ctxA, { invitationId: raced.invitationId, reason: REASON }, deps),
        revokeInvitation(ctxA, { invitationId: raced.invitationId, reason: REASON }, deps),
      ]);
      const outcomes = [one.status, two.status].sort();
      assert.deepEqual(outcomes, ["refused", "revoked"], "exactly one wins");
      const loser = one.status === "refused" ? one : two.status === "refused" ? two : null;
      assert.ok(loser && loser.status === "refused");
      assert.ok(
        loser!.status === "refused" &&
          ["already-revoked", "invitation-not-revocable"].includes(loser!.reason),
        "the loser gets a stable, honest refusal",
      );

      assert.equal(await auditCount(), before + 1, "exactly one audit row, never two");
      const rows = await setup.query<{ count: string }>(
        `select count(*) from audit_log where action=$1 and entity_id=$2`,
        [INVITATION_REVOKED_ACTION, raced.invitationId],
      );
      assert.equal(Number(rows.rows[0]!.count), 1, "no duplicate revocation event");
    }

    console.log("PASS invitation revocation");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main();
