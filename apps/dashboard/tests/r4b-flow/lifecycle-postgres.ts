/*
 * R4B — tenant suspension, proved against a REAL PostgreSQL database.
 *
 * THE CLAIM UNDER TEST. Suspending a tenant stops every path into it — including the three
 * pre-tenant flows that ignored tenant state until now — and reactivating restores them, all without
 * revoking a single session or deleting a single row.
 *
 * The proofs that only a real database can give:
 *   - the exact five columns move, and the ones R4B must never touch do not;
 *   - **a session issued BEFORE suspension is refused on its next resolution**, while its
 *     `user_session_contexts` row stays byte-identical — suspension is live-state enforcement, not
 *     session destruction, and that distinction is invisible without a real resolver;
 *   - the same session resolves again after reactivation, with nobody signing in;
 *   - invitation acceptance, enrollment start and enrollment completion each refuse while suspended
 *     and create nothing — the gap R4B exists to close, proved by row counts either side;
 *   - the predicate decides concurrency: two simultaneous suspends produce one transition and one
 *     version increment;
 *   - R4A birth still lands `active`, and `deleting_at` is still NULL everywhere.
 *
 * FIXTURES ARE STATE-RELATIVE. No calendar literal decides an outcome and no global migration count
 * is pinned: every count is measured before an act and compared after it.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST on purpose: the schema barrel is the only safe entry point for
// `src/db/schema/*` (a pre-existing _base → company → organization cycle).
import { createControlPlaneDb } from "../../src/db/client.server";
import { suspendTenant, reactivateTenant } from "../../scripts/lib/tenant-lifecycle";
import { provisionTenant } from "../../scripts/lib/provision-tenant";
import { isTenantOnboardingEligible } from "../../src/features/auth-runtime/identity-repository.server";
import { resolveSessionFromReference } from "../../src/features/auth-runtime/session-service.server";
import { acceptInvitation } from "../../src/features/human-onboarding/accept-invitation.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { digestSessionReference } from "../../src/features/auth-runtime/session-digest.server";
import { hashPassword } from "../../src/features/auth-runtime/password-hash.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { resolveNominationTarget, nominateGenesisHuman } from "../../scripts/lib/nominate-genesis-human";
import { acceptGenesisNomination } from "../../src/features/governance-genesis/genesis-acceptance.server";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date();
const DIGEST_KEY = { version: 1, secret: "r4b-test-secret-value-at-least-32-chars-long" } as const;
const ACCEPT_PASSWORD = "an-r4b-test-password-long-enough";

type Human = { userId: string; authIdentityId: string; email: string };
type Born = { tenantId: string; membershipId: string; roleId: string };

/** A session row the real resolver can find, so suspension can be proved against a live session. */
async function mintSession(client: Client, human: Human, born: Born, tag: string): Promise<string> {
  const reference = `${tag}-${"b".repeat(48)}`;
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
      human.authIdentityId,
      digestSessionReference(reference, DIGEST_KEY),
      human.userId,
      born.tenantId,
      born.membershipId,
    ],
  );
  return row.rows[0]!.id;
}

function contextFor(human: Human, born: Born, sessionContextId: string): TenantContext {
  return {
    tenantId: born.tenantId,
    userId: human.userId,
    authIdentityId: human.authIdentityId,
    membershipId: born.membershipId,
    membershipVersion: 1,
    roleId: born.roleId,
    sessionContextId,
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "r4b-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function count(client: Client, table: string, where = "true", params: unknown[] = []) {
  const r = await client.query<{ n: string }>(
    `select count(*)::text n from ${table} where ${where}`,
    params,
  );
  return Number(r.rows[0]!.n);
}

async function companyRow(client: Client, tenantId: string) {
  return (
    await client.query(
      `select tenant_status, tenant_status_changed_at, suspended_at, suspension_reason, version,
              lifecycle_status, authentication_disabled_at, deleting_at, provisioning_source,
              plan, name, slug, created_by
         from companies where id = $1`,
      [tenantId],
    )
  ).rows[0]! as Record<string, unknown>;
}

async function seedHuman(client: Client, email: string) {
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
  return { userId, authIdentityId: identity.rows[0]!.id, email };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r4b_lifecycle");
  await harness.createDatabase();
  const db = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);

  try {
    harness.migrateDatabase();
    await db.connect();

    /* ── A tenant, born through R4A ──────────────────────────────────────── */
    const alice = await seedHuman(db, "alice@r4b.test");
    const born = await provisionTenant(db, {
      slug: "r4b-co",
      displayName: "R4B Co",
      identityEmail: alice.email,
    });
    assert.equal(born.status, "provisioned");
    const tenant = born.status === "provisioned" ? born.tenant : undefined!;

    const beforeSuspend = await companyRow(db, tenant.tenantId);
    assert.equal(beforeSuspend.tenant_status, "active", "R4A birth still lands active");
    assert.equal(beforeSuspend.version, 1);
    assert.equal(beforeSuspend.deleting_at, null);

    /* ── The seam agrees while active ────────────────────────────────────── */
    assert.equal(await isTenantOnboardingEligible(handle.db, tenant.tenantId), true);

    /* ── A REAL SESSION, issued while the tenant is active ───────────────── */
    const sessionReference = `r4b-${"a".repeat(45)}`;
    const hash = digestSessionReference(sessionReference, DIGEST_KEY);

    const sessionRow = await db.query<{ id: string }>(
      `insert into user_session_contexts
         (auth_identity_id, provider_session_reference_hash, provider_session_reference_digest_version,
          user_id, active_tenant_id, active_membership_id, membership_version, assurance_level,
          mfa_verified, authenticated_at, issued_at, last_activity_at, absolute_expires_at,
          inactivity_expires_at)
       values ($1, $2, 1, $3, $4, $5, 1, 'aal1', false, now(), now(), now(),
               now() + interval '1 day', now() + interval '1 hour')
       returning id`,
      [alice.authIdentityId, hash, alice.userId, tenant.tenantId, tenant.membershipId],
    );
    const sessionId = sessionRow.rows[0]!.id;
    const sessionBefore = (
      await db.query(`select * from user_session_contexts where id = $1`, [sessionId])
    ).rows[0]!;

    /* ── SUSPEND ─────────────────────────────────────────────────────────── */
    const suspended = await suspendTenant(db, {
      slug: "r4b-co",
      reason: "Operator pausing the tenant for the R4B proof.",
    });
    assert.equal(suspended.status, "changed", JSON.stringify(suspended));

    /* ── Exactly the contracted fields moved ─────────────────────────────── */
    {
      const after = await companyRow(db, tenant.tenantId);
      assert.equal(after.tenant_status, "suspended");
      assert.ok(after.tenant_status_changed_at, "the transition is stamped");
      assert.ok(after.suspended_at, "suspension is stamped");
      assert.equal(after.suspension_reason, "Operator pausing the tenant for the R4B proof.");
      assert.equal(after.version, 2, "version advanced exactly once");

      /* And everything R4B must never touch is byte-identical. */
      for (const untouched of [
        "lifecycle_status", "authentication_disabled_at", "deleting_at",
        "provisioning_source", "plan", "name", "slug", "created_by",
      ]) {
        assert.deepEqual(after[untouched], beforeSuspend[untouched], `${untouched} must not move`);
      }
      assert.equal(after.deleting_at, null, "R5 stays R5");
    }

    /* ── The seam now refuses ────────────────────────────────────────────── */
    assert.equal(await isTenantOnboardingEligible(handle.db, tenant.tenantId), false);

    /* ══ THE SESSION PROOF — refused live, NOT revoked ═══════════════════════ */
    {
      const resolved = await resolveSessionFromReference(
        handle.db,
        { sessionDigestCurrentKey: DIGEST_KEY, sessionDigestPreviousKey: null } as never,
        sessionReference,
        { requestId: "r4b" },
        NOW,
      );
      assert.notEqual(resolved.status, "authorized",
        "a session issued BEFORE suspension must be refused on its next resolution");

      const sessionAfter = (
        await db.query(`select * from user_session_contexts where id = $1`, [sessionId])
      ).rows[0]!;
      assert.equal(sessionAfter.revoked_at, null, "the session row was NOT revoked");
      assert.deepEqual(
        { ...sessionAfter, last_activity_at: null },
        { ...sessionBefore, last_activity_at: null },
        "the session row is otherwise untouched — suspension destroys nothing",
      );
      assert.equal(
        await count(db, "user_session_contexts", "revoked_at is not null"),
        0,
        "no session anywhere was revoked",
      );
    }

    /* ══ PRE-TENANT ENFORCEMENT — the gap R4B closes ═════════════════════════ */

    /*
     * The fixtures below are built by the REAL chain, not by hand-written rows. An approved
     * enrollment must carry a genuine Governance decision (`identity_enrollment_requests_decision_fk`
     * FKs `approval_decision_id` to `decision_records`), so a fabricated one is not merely dishonest
     * — it is unrepresentable. Establishing Governance for real is therefore both the truthful and
     * the only available fixture, and it doubles as proof that R4A's tenant reaches these authorities.
     *
     * Everything here is created while the tenant is ACTIVE. Only then is it suspended, so each
     * refusal below is provably about the TENANT and not about missing ceremony state.
     */
    await reactivateTenant(db, { slug: "r4b-co" });

    let invitationForAcceptance = "";
    let invitationForEnrollment = "";
    let enrollmentContinuation = "";

    {
      /* Genesis → acceptance → G2, so alice holds real Governance authority. */
      const target = await resolveNominationTarget(db, "r4b-co", alice.email);
      assert.ok(target, "R4A's tenant is reachable by the existing Genesis resolver");
      await nominateGenesisHuman(db, target!);

      const sessionForGovernance = await mintSession(db, alice, tenant, "gov");
      const context = contextFor(alice, tenant, sessionForGovernance);
      const govDeps = { getDb: () => handle.db, now: () => NOW } as never;

      const accepted = await acceptGenesisNomination(context, govDeps);
      assert.equal(accepted.status, "accepted", JSON.stringify(accepted));
      const established = await establishGovernanceAuthority(
        context,
        { justification: "Establishing Governance so R4B can build honest enrollment fixtures." },
        govDeps,
      );
      assert.equal(established.status, "established", JSON.stringify(established));

      const baseline = await provisionMemberRole(
        context,
        { justification: "Provisioning the member baseline for the R4B enrollment fixtures." },
        govDeps,
      );
      assert.equal(baseline.status, "provisioned", JSON.stringify(baseline));
      const memberRole = (
        await db.query<{ id: string }>(
          `select id from roles where tenant_id = $1 and type = 'member'`,
          [tenant.tenantId],
        )
      ).rows[0]!.id;

      const onboardingDeps = { getDb: () => handle.db, now: () => NOW, digestKey: DIGEST_KEY } as never;

      /* Invitation 1 — for an EXISTING human, to exercise acceptance. */
      const existing = await seedHuman(db, "frank@r4b.test");
      /* Same shape `tests/helpers/r1-identity-seed.ts` uses — the real hasher, all five columns. */
      const hashed = await hashPassword(ACCEPT_PASSWORD);
      await db.query(
        `insert into auth_credentials
           (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
         values ($1, 'password', $2, $3::jsonb, $4, $5, 'active')`,
        [
          existing.authIdentityId,
          hashed.algorithm,
          JSON.stringify(hashed.params),
          hashed.salt,
          hashed.secretHash,
        ],
      );
      const authA = await authorizeMembership(
        context,
        {
          targetEmail: "frank@r4b.test",
          intendedRoleId: memberRole,
          justification: "Authorizing an existing human so R4B can prove acceptance is blocked.",
        },
        govDeps,
      );
      assert.equal(authA.status, "authorized", JSON.stringify(authA));
      const issuedA = await issueInvitation(
        context,
        { membershipAuthorizationId: authA.status === "authorized" ? authA.authorizationId : "" },
        onboardingDeps,
      );
      assert.equal(issuedA.status, "issued", JSON.stringify(issuedA));
      invitationForAcceptance = issuedA.status === "issued" ? issuedA.capability : "";

      /* Invitation 2 — for a NEW human, to exercise enrollment start and completion. */
      const authB = await authorizeMembership(
        context,
        {
          targetEmail: "grace@r4b.test",
          intendedRoleId: memberRole,
          justification: "Authorizing a new human so R4B can prove enrollment is blocked.",
        },
        govDeps,
      );
      assert.equal(authB.status, "authorized", JSON.stringify(authB));
      const issuedB = await issueInvitation(
        context,
        { membershipAuthorizationId: authB.status === "authorized" ? authB.authorizationId : "" },
        onboardingDeps,
      );
      assert.equal(issuedB.status, "issued", JSON.stringify(issuedB));
      invitationForEnrollment = issuedB.status === "issued" ? issuedB.capability : "";

      /* Start and APPROVE the ceremony while active, so only completion remains. */
      const started = await startIdentityEnrollment(
        { capability: invitationForEnrollment },
        onboardingDeps,
      );
      assert.equal(started.status, "started", JSON.stringify(started));
      enrollmentContinuation = started.status === "started" ? started.continuationReference : "";

      const decided = await decideIdentityEnrollment(
        context,
        {
          enrollmentId: started.status === "started" ? started.enrollmentId : "",
          decision: "approve",
          justification: "Approving so R4B can prove completion is blocked by suspension alone.",
        },
        govDeps,
      );
      assert.equal(decided.status, "approved", JSON.stringify(decided));
    }

    /* ── Now suspend. Every refusal below is about the tenant. ───────────── */
    {
      const again = await suspendTenant(db, {
        slug: "r4b-co",
        reason: "Suspended to prove the pre-tenant flows now refuse.",
      });
      assert.equal(again.status, "changed", JSON.stringify(again));
      assert.equal(await isTenantOnboardingEligible(handle.db, tenant.tenantId), false);
    }

    const onboardingDeps = { getDb: () => handle.db, now: () => NOW, digestKey: DIGEST_KEY } as never;

    /* A — invitation acceptance refuses, and creates no membership. */
    {
      const before = await count(db, "memberships");
      const invitationsBefore = await count(db, "invitations", "status = 'pending'");
      const outcome = await acceptInvitation(
        {
          capability: invitationForAcceptance,
          email: "frank@r4b.test",
          password: ACCEPT_PASSWORD,
        },
        onboardingDeps,
      );
      assert.equal(outcome.status, "refused", JSON.stringify(outcome));
      assert.equal(
        outcome.status === "refused" ? outcome.reason : "",
        "capability-not-usable",
        "reused vocabulary — an unauthenticated bearer learns nothing about the organization",
      );
      assert.equal(await count(db, "memberships"), before, "NO membership was created");
      assert.equal(
        await count(db, "invitations", "status = 'pending'"),
        invitationsBefore,
        "the invitation was not spent",
      );
    }

    /* B — enrollment start refuses, and creates no enrollment state. */
    {
      const before = await count(db, "identity_enrollment_requests");
      const outcome = await startIdentityEnrollment(
        { capability: invitationForAcceptance },
        onboardingDeps,
      );
      assert.equal(outcome.status, "refused", JSON.stringify(outcome));
      assert.equal(
        await count(db, "identity_enrollment_requests"),
        before,
        "NO enrollment state was created",
      );
    }

    /* C — enrollment completion refuses, and creates no identity at all. */
    {
      const usersBefore = await count(db, "users");
      const identitiesBefore = await count(db, "auth_identities");
      const credentialsBefore = await count(db, "auth_credentials");
      const membershipsBefore = await count(db, "memberships");

      const outcome = await completeIdentityEnrollment(
        {
          capability: invitationForEnrollment,
          continuationReference: enrollmentContinuation,
          password: ACCEPT_PASSWORD,
        },
        onboardingDeps,
      );
      assert.equal(outcome.status, "refused", JSON.stringify(outcome));
      assert.equal(await count(db, "users"), usersBefore, "NO user was created");
      assert.equal(await count(db, "auth_identities"), identitiesBefore, "NO identity was created");
      assert.equal(
        await count(db, "auth_credentials"),
        credentialsBefore,
        "NO credential was created",
      );
      assert.equal(await count(db, "memberships"), membershipsBefore, "NO membership was created");
      assert.equal(
        await count(db, "identity_enrollment_requests", "status = 'approved'"),
        1,
        "the ceremony stays approved — a suspension is a pause, not a rejection of the human",
      );
    }

    /* ── Reactivate, and prove the same flows now work ───────────────────── */
    {
      const back = await reactivateTenant(db, { slug: "r4b-co" });
      assert.equal(back.status, "changed", JSON.stringify(back));

      const completed = await completeIdentityEnrollment(
        {
          capability: invitationForEnrollment,
          continuationReference: enrollmentContinuation,
          password: ACCEPT_PASSWORD,
        },
        onboardingDeps,
      );
      assert.equal(
        completed.status,
        "completed",
        `the identical call now succeeds — suspension was the only thing refusing it: ${JSON.stringify(completed)}`,
      );

      const accepted = await acceptInvitation(
        {
          capability: invitationForAcceptance,
          email: "frank@r4b.test",
          password: ACCEPT_PASSWORD,
        },
        onboardingDeps,
      );
      assert.equal(accepted.status, "accepted", JSON.stringify(accepted));
    }

    /* ── Suspend again for the remaining state assertions ────────────────── */
    await suspendTenant(db, { slug: "r4b-co", reason: "Back to suspended for the state checks." });


    /* ── Duplicate suspend refuses, and moves nothing ────────────────────── */
    {
      const before = await companyRow(db, tenant.tenantId);
      const again = await suspendTenant(db, { slug: "r4b-co", reason: "A second attempt." });
      assert.deepEqual(again, { status: "refused", reason: "not-in-expected-state" });
      assert.deepEqual(await companyRow(db, tenant.tenantId), before, "nothing moved");
    }

    /* ── REACTIVATE ──────────────────────────────────────────────────────── */
    {
      /* State-relative: the fixture chain above performs several transitions, so the version is
       * measured immediately before this one rather than pinned to a literal that would move
       * whenever a fixture gains a step. */
      const beforeReactivate = await companyRow(db, tenant.tenantId);
      const reactivated = await reactivateTenant(db, { slug: "r4b-co" });
      assert.equal(reactivated.status, "changed", JSON.stringify(reactivated));

      const after = await companyRow(db, tenant.tenantId);
      assert.equal(after.tenant_status, "active");
      assert.equal(after.suspended_at, null, "the suspension evidence is cleared");
      assert.equal(after.suspension_reason, null);
      assert.equal(
        Number(after.version),
        Number(beforeReactivate.version) + 1,
        "version advanced exactly once",
      );
      assert.equal(after.deleting_at, null);
      assert.deepEqual(after.lifecycle_status, beforeSuspend.lifecycle_status);
      assert.deepEqual(after.provisioning_source, beforeSuspend.provisioning_source);

      const duplicate = await reactivateTenant(db, { slug: "r4b-co" });
      assert.deepEqual(duplicate, { status: "refused", reason: "not-in-expected-state" });
    }

    /* ── The SAME session resolves again, with nobody signing in ─────────── */
    {
      assert.equal(await isTenantOnboardingEligible(handle.db, tenant.tenantId), true);
      const resolved = await resolveSessionFromReference(
        handle.db,
        { sessionDigestCurrentKey: DIGEST_KEY, sessionDigestPreviousKey: null } as never,
        sessionReference,
        { requestId: "r4b" },
        NOW,
      );
      assert.equal(
        resolved.status,
        "authorized",
        "the pre-existing session resumes: it was refused, never destroyed",
      );
    }

    /*
     * The "flows work again" proof lives above, in the reactivation block: the IDENTICAL
     * `completeIdentityEnrollment` call that was refused while suspended succeeds once the tenant is
     * active, and acceptance follows. That is a stronger statement than re-running a flow that would
     * now refuse for its own reasons, so nothing is repeated here.
     */


    /* ── Refusals for a missing tenant, and for a bad reason ─────────────── */
    {
      assert.deepEqual(await suspendTenant(db, { slug: "nope", reason: "x" }), {
        status: "refused",
        reason: "tenant-not-found",
      });
      assert.deepEqual(await suspendTenant(db, { slug: "r4b-co", reason: "   " }), {
        status: "refused",
        reason: "invalid-input",
      });
      assert.deepEqual(await suspendTenant(db, { slug: "r4b-co", reason: "x".repeat(129) }), {
        status: "refused",
        reason: "invalid-input",
      });
      assert.equal((await companyRow(db, tenant.tenantId)).tenant_status, "active",
        "no refusal moved the tenant");
    }

    /* ── CONCURRENCY: two suspends, one transition, one version increment ── */
    {
      const before = await companyRow(db, tenant.tenantId);
      const a = new Client({ connectionString: harness.dbUrl });
      const b = new Client({ connectionString: harness.dbUrl });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          suspendTenant(a, { slug: "r4b-co", reason: "Racer A." }),
          suspendTenant(b, { slug: "r4b-co", reason: "Racer B." }),
        ]);
        assert.deepEqual([ra.status, rb.status].sort(), ["changed", "refused"], "exactly one winner");
        const loser = ra.status === "refused" ? ra : rb.status === "refused" ? rb : undefined!;
        assert.equal(loser.reason, "not-in-expected-state");
      } finally {
        await a.end();
        await b.end();
      }
      const after = await companyRow(db, tenant.tenantId);
      assert.equal(after.tenant_status, "suspended");
      assert.equal(
        Number(after.version),
        Number(before.version) + 1,
        "the version advanced exactly once, not twice",
      );
    }

    /* ── CONCURRENCY: two reactivates, same property ─────────────────────── */
    {
      const before = await companyRow(db, tenant.tenantId);
      const a = new Client({ connectionString: harness.dbUrl });
      const b = new Client({ connectionString: harness.dbUrl });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          reactivateTenant(a, { slug: "r4b-co" }),
          reactivateTenant(b, { slug: "r4b-co" }),
        ]);
        assert.deepEqual([ra.status, rb.status].sort(), ["changed", "refused"], "exactly one winner");
      } finally {
        await a.end();
        await b.end();
      }
      const after = await companyRow(db, tenant.tenantId);
      assert.equal(after.tenant_status, "active");
      assert.equal(Number(after.version), Number(before.version) + 1);
    }

    /* ── Tenant isolation: suspending one tenant leaves the other alone ──── */
    {
      const bob = await seedHuman(db, "bob@r4b.test");
      const second = await provisionTenant(db, {
        slug: "r4b-other",
        displayName: "Other Co",
        identityEmail: bob.email,
      });
      assert.equal(second.status, "provisioned");
      const other = second.status === "provisioned" ? second.tenant : undefined!;

      await suspendTenant(db, { slug: "r4b-co", reason: "Isolation check." });
      assert.equal((await companyRow(db, other.tenantId)).tenant_status, "active",
        "the other tenant is untouched");
      assert.equal(await isTenantOnboardingEligible(handle.db, other.tenantId), true);
      await reactivateTenant(db, { slug: "r4b-co" });
    }

    /* ── R5 / R3B firewalls: nothing else exists at all ──────────────────── */
    {
      assert.equal(await count(db, "companies", "deleting_at is not null"), 0);
      assert.equal(await count(db, "companies", "authentication_disabled_at is not null"), 0);
      /*
       * NOT a global zero — the Governance fixtures above legitimately audit (genesis acceptance,
       * the bootstrap decision, role provisioning, membership authorization, invitation issuance,
       * the enrollment decision), and asserting `audit_log = 0` would only prove no fixture ran.
       * The precise claim is that a LIFECYCLE TRANSITION writes nothing: measured across one, and
       * confirmed by no audit action ever naming one.
       */
      const auditBefore = await count(db, "audit_log");
      await reactivateTenant(db, { slug: "r4b-co" });
      await suspendTenant(db, { slug: "r4b-co", reason: "Audit-silence check." });
      assert.equal(
        await count(db, "audit_log"),
        auditBefore,
        "a suspend and a reactivate together wrote zero audit rows",
      );
      const actions = (
        await db.query<{ action: string }>(`select action from audit_log`)
      ).rows.map((r) => r.action);
      for (const action of actions) {
        assert.doesNotMatch(
          action,
          /suspend|reactivat|lifecycle|tenant[._-]?status/i,
          "no audit action claims a lifecycle transition — R4B has no actor to attribute one to",
        );
      }
      assert.equal(
        await count(db, "audit_log", "actor_id is null or actor_type is null"),
        0,
        "every audit row that exists names a real actor",
      );
      assert.equal(await count(db, "provider_connectivity_controls"), 0);
      assert.equal(await count(db, "action_execution_attempts"), 0);
      assert.equal(await count(db, "action_permits"), 0);
    }

    console.log("r4b-flow/lifecycle-postgres: ok");
  } finally {
    await db.end().catch(() => {});
    await handle.dispose?.();
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
