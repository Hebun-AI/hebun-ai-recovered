/*
 * Onboarding entry — the approver's read seam against a REAL PostgreSQL database.
 *
 * WHAT THIS FILE PROVES, AND WHY IT HAD TO EXIST:
 *
 *   The second key could never be turned through the product, because nothing told the Governance
 *   authority that a submission had arrived. `readPendingEnrollment` answers "tell me about ceremony
 *   X" and Act 1 returns X to the BEARER, so the approver had no way to learn it. This is the list
 *   that closes that gap — and it must be authority-gated, tenant-scoped, and address-free, or it
 *   becomes a disclosure path around the authority it represents.
 *
 * The four consumption authorities themselves are already proved end to end by
 * `tests/i2-flow/onboarding-postgres.ts`. This file does not re-prove them; it proves the seam that
 * makes them reachable, and it drives them only far enough to create the states it reads.
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
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { readPendingEnrollments } from "../../src/features/identity-enrollment/read-pending-enrollments.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
const NOW = new Date("2026-08-14T09:00:00.000Z");
const REASON = "This organization deliberately admits one new member through onboarding.";
const DIGEST_KEY = { version: 1, secret: "onboarding-entry-test-secret-value" };

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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
    requestId: "onboarding-entry-request",
    authenticatedAt: NOW.toISOString(),
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
  const harness = createDisposablePostgresHarness("hebun_onboarding_entry_read");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;
  const bearerDeps = { getDb: () => handle.db, now: () => NOW, digestKey: DIGEST_KEY } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed two tenants, each with its own Governance authority. ─────────── */
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
    /* An ordinary human with the strongest PRODUCT band and no Governance authority. */
    const OWNER = await addMember(setup, A.tenantId, "owner@acme.test", "owner");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "bbbb"));
    const ctxOwner = contextFor(OWNER, await sessionRowFor(setup, OWNER, "cccc"));

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

    /** Issue a capability for one address and present it, leaving a PENDING ceremony. */
    const submit = async (ctx: TenantContext, email: string): Promise<string> => {
      /* Provisioned once per tenant; the second call refuses and the existing role is re-read. */
      const role = await provisionMemberRole(ctx, { justification: REASON }, deps);
      const roleId =
        role.status === "provisioned"
          ? role.roleId
          : (
              await setup.query<{ id: string }>(
                `select id from roles where tenant_id=$1 and type='member' limit 1`,
                [ctx.tenantId],
              )
            ).rows[0]!.id;

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
        bearerDeps,
      );
      assert.equal(issued.status, "issued");
      if (issued.status !== "issued") throw new Error("unreachable");

      const started = await startIdentityEnrollment({ capability: issued.capability }, bearerDeps);
      assert.equal(started.status, "started");
      if (started.status !== "started") throw new Error("unreachable");
      return started.enrollmentId;
    };

    const acmeFirst = await submit(ctxA, "first@newcomer.test");
    const acmeSecond = await submit(ctxA, "second@newcomer.test");
    const globexOnly = await submit(ctxX, "third@newcomer.test");

    /* ══ 1. THE AUTHORITY SEES ITS OWN TENANT'S SUBMISSIONS ════════════════ */
    {
      const view = await readPendingEnrollments(ctxA, deps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      assert.equal(view.view.viewerIsGovernanceAuthority, true);
      assert.deepEqual(
        view.view.pending.map((row) => row.enrollmentId).sort(),
        [acmeFirst, acmeSecond].sort(),
        "exactly this tenant's two pending ceremonies",
      );
      assert.ok(
        !view.view.pending.some((row) => row.enrollmentId === globexOnly),
        "another tenant's ceremony is not visible",
      );
    }

    /* ══ 2. CROSS-TENANT IS NOT A FILTERING DETAIL, IT IS THE PREDICATE ════ */
    {
      const view = await readPendingEnrollments(ctxX, deps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      assert.deepEqual(
        view.view.pending.map((row) => row.enrollmentId),
        [globexOnly],
        "Globex's authority sees only Globex's ceremony",
      );
    }

    /* ══ 3. AN OWNER-BAND HUMAN WITHOUT GOVERNANCE SEES NOTHING ═══════════ */
    {
      const view = await readPendingEnrollments(ctxOwner, deps);
      assert.equal(view.status, "read");
      if (view.status !== "read") throw new Error("unreachable");
      assert.equal(view.view.viewerIsGovernanceAuthority, false);
      assert.deepEqual(view.view.pending, [], "the strongest product role is not Governance authority");
    }

    /* ══ 4. NO SESSION, NO VIEW ═══════════════════════════════════════════ */
    {
      const view = await readPendingEnrollments(null, deps);
      assert.equal(view.status, "unavailable");
      if (view.status !== "unavailable") throw new Error("unreachable");
      assert.equal(view.reason, "no-authorized-tenant-context");
    }

    /* ══ 5. THE ADDRESS IS NEVER RETURNED ═════════════════════════════════ */
    {
      const view = await readPendingEnrollments(ctxA, deps);
      if (view.status !== "read") throw new Error("unreachable");
      const text = JSON.stringify(view.view);
      for (const address of ["first@newcomer.test", "second@newcomer.test"]) {
        assert.equal(
          text.includes(address),
          false,
          `the approver correlates timing, not identity — ${address} must not appear`,
        );
      }
      assert.equal(text.includes("continuation"), false, "the bearer's half is never returned");
      for (const row of view.view.pending) {
        /*
         * WIDENED WITH THE SEAM, NOT LOOSENED. The stranded-enrollment recovery phase added two
         * fields so the surface can tell a `pending` ceremony from an APPROVED one that never
         * completed — the state that used to be invisible and unrejectable. The invariant this
         * assertion protects is unchanged: an exact, closed field list, all of it real columns or
         * derived from them, and none of it identifying the prospective human.
         */
        assert.deepEqual(
          Object.keys(row).sort(),
          [
            "approvedAt",
            "enrollmentId",
            "invitationId",
            "lifecycle",
            "receiptExpiresAt",
            "submittedAt",
          ],
          "exactly these fields, all of them real columns or derived from one",
        );
      }
    }

    /* ══ 6. AN APPROVED CEREMONY STAYS LISTED — AS STRANDED ══════════════ */
    {
      /*
       * CORRECTED BY THE STRANDED-ENROLLMENT RECOVERY PHASE. This used to assert that approving a
       * ceremony removed it from the list, on the reasoning that a decided ceremony is history. That
       * reasoning was wrong for one state and it cost a real ceremony: an APPROVED row is not
       * finished, it is permission the bearer may still fail to spend, and while it sits there it
       * blocks every fresh submission for that invitation. Hiding it made it unrecoverable.
       *
       * It is still listed, and now says which state it is in. Terminal states — `rejected` and
       * `completed` — do leave: §7 proves it for a rejection, and the recovery suite proves it for a
       * completion at a clock past the receipt's lifetime.
       */
      const decided = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: acmeFirst, decision: "approve", justification: REASON },
        deps,
      );
      assert.equal(decided.status, "approved");

      const view = await readPendingEnrollments(ctxA, deps);
      if (view.status !== "read") throw new Error("unreachable");
      assert.deepEqual(
        view.view.pending.map((row) => row.enrollmentId).sort(),
        [acmeFirst, acmeSecond].sort(),
        "the approved ceremony remains visible so it can still be acted on",
      );
      const approvedRow = view.view.pending.find((row) => row.enrollmentId === acmeFirst)!;
      /*
       * CORRECTED AGAIN, BY THE CLASSIFICATION FIX. This previously asserted the row was STRANDED
       * the instant it was approved, which is what the defect looked like from inside the tests: an
       * approval seconds old was indistinguishable from an abandonment a day old. A freshly approved
       * ceremony is IN FLIGHT — the bearer still holds a live continuation receipt.
       */
      assert.equal(
        approvedRow.lifecycle,
        "approved-in-flight",
        "a just-approved ceremony is waiting on the bearer, not stranded",
      );
      assert.ok(approvedRow.approvedAt, "with the approval timestamp");
      assert.ok(approvedRow.receiptExpiresAt, "and the deadline the bearer is working against");
      const pendingRow = view.view.pending.find((row) => row.enrollmentId === acmeSecond)!;
      assert.equal(pendingRow.lifecycle, "pending", "while an undecided one is pending");
      assert.equal(pendingRow.approvedAt, null);
      assert.equal(pendingRow.receiptExpiresAt, null);
    }

    /* ══ 7. A REJECTION ALSO LEAVES, AND FREES THE INVITATION ═════════════ */
    {
      const rejected = await decideIdentityEnrollment(
        ctxA,
        { enrollmentId: acmeSecond, decision: "reject", justification: REASON },
        deps,
      );
      assert.equal(rejected.status, "rejected");

      const view = await readPendingEnrollments(ctxA, deps);
      if (view.status !== "read") throw new Error("unreachable");
      /*
       * `rejected` IS terminal, so this one leaves. The approved ceremony from §6 stays, because it
       * is still actionable — that is the difference the recovery phase drew.
       */
      assert.deepEqual(
        view.view.pending.map((row) => row.enrollmentId),
        [acmeFirst],
        "the rejected ceremony leaves; the approved one is still actionable",
      );

      /*
       * THE RECOVERY PATH THE CONTINUATION RECEIPT'S TTL DEPENDS ON.
       * `identity_enrollment_requests_one_live_per_invitation_uq` is partial on `status <>
       * 'rejected'`, so rejecting a stranded ceremony lets the SAME capability be presented again.
       * If this ever stopped being true, a bearer who lost their receipt would be permanently stuck.
       */
      const invitationId = (
        await setup.query<{ invitation_id: string }>(
          `select invitation_id from identity_enrollment_requests where id=$1`,
          [acmeSecond],
        )
      ).rows[0]!.invitation_id;
      const reinserted = await setup.query<{ id: string }>(
        `insert into identity_enrollment_requests
           (tenant_id, invitation_id, continuation_hash, continuation_version, status)
         values ($1, $2, repeat('a', 64), 1, 'pending') returning id`,
        [A.tenantId, invitationId],
      );
      assert.ok(reinserted.rows[0]!.id, "a rejected ceremony frees its invitation for a fresh one");
    }

    /* ══ 8. THE SEAM WRITES NOTHING ═══════════════════════════════════════ */
    {
      const before = await setup.query<Record<string, string>>(`
        select (select count(*) from users) users,
               (select count(*) from memberships) memberships,
               (select count(*) from auth_credentials) credentials,
               (select count(*) from audit_log) audit
      `);
      await readPendingEnrollments(ctxA, deps);
      await readPendingEnrollments(ctxX, deps);
      await readPendingEnrollments(ctxOwner, deps);
      const after = await setup.query<Record<string, string>>(`
        select (select count(*) from users) users,
               (select count(*) from memberships) memberships,
               (select count(*) from auth_credentials) credentials,
               (select count(*) from audit_log) audit
      `);
      assert.deepEqual(after.rows[0], before.rows[0], "a read seam reads");
    }

    console.log("PASS onboarding entry read seam");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

main();
