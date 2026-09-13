/*
 * OWNER ONBOARDING — the widened band, end to end, against a real PostgreSQL.
 *
 * ── WHY THIS CAPABILITY EXISTS ───────────────────────────────────────────────
 *
 * `owner` was on `ONBOARDING_EXCLUDED_ROLE_TYPES`, and the repository was consistent about it:
 * tenant provisioning recorded that an owner "can only ever come from tenant birth". True, and a
 * dead end — a tenant needing to replace its only owner had NO released path to a second one.
 * Provisioning refuses an existing slug, the first-human ceremony refuses once any user exists, and
 * the only membership UPDATE writer revokes. So the last-owner guard, doing its job, made such a
 * tenant permanently unable to change hands.
 *
 * A Director decision admitted `owner` to `ELIGIBLE_ROLE_TYPE_LIST`. This suite is what that
 * decision costs: proof that widening the band widened NOTHING ELSE.
 *
 * ── THE PROPERTY THAT MATTERS MOST ───────────────────────────────────────────
 *
 * THE BAND AUTHORIZED AT ISSUANCE IS THE BAND REDEEMED AT ACCEPTANCE. The role is resolved
 * server-side from the tenant's own active roles when Governance authorizes, carried on the permit,
 * read by issuance through a join, and re-checked at redemption. Neither the issuer nor the redeemer
 * has a field to put a role in. A member invitation can therefore never become an owner one, and the
 * proof below is not "the API refuses a role argument" but "there is no role argument to pass".
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST on purpose: the schema barrel is the only safe entry point for `src/db/schema/*`. */
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import { delegateGovernanceAuthority } from "../../src/features/governance-decision/authority-delegation.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import { acceptInvitation } from "../../src/features/human-onboarding/accept-invitation.server";
import {
  ONBOARDING_ELIGIBLE_ROLE_TYPES,
  ONBOARDING_EXCLUDED_ROLE_TYPES,
} from "../../src/features/membership-authority/contracts";
import type { AuthenticationDigestKey } from "../../src/features/auth/environment/auth-environment.server";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const REASON = "the tenant is replacing its only owner, under Governance authority";
const NOW = new Date("2026-09-13T12:00:00.000Z");
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "owner-onboarding-secret" });
const OWNER_ELECT = "owner-elect@acme.test";
const MEMBER_ELECT = "member-elect@acme.test";
const PASSWORD = "a-sufficiently-long-password-9Kq";

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
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

function contextFor(seeded: Seeded, sessionContextId: string, requestId: string): TenantContext {
  return asHumanTenantContext({
    tenantId: seeded.tenantId,
    userId: seeded.userId,
    authIdentityId: seeded.authIdentityId,
    membershipId: seeded.membershipId,
    membershipVersion: 1,
    roleId: seeded.roleId,
    sessionContextId,
    provider: "local" as never,
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: NOW.toISOString(),
  } as never);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_owner_onboarding");
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
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex",
      email: "root@globex.test", password: "another-correct-password-8Rz",
    });
    const rootA = contextFor(A, await sessionRowFor(setup, A, "own-a"), "own-root-a");
    const rootB = contextFor(B, await sessionRowFor(setup, B, "own-b"), "own-root-b");

    for (const [seed, ctx] of [[A, rootA], [B, rootB]] as const) {
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

    const memberRole = await provisionMemberRole(rootA, { justification: REASON }, govDeps);
    assert.equal(memberRole.status, "provisioned");
    const memberRoleA = memberRole.status === "provisioned" ? memberRole.roleId : "";
    /* Acme's OWNER role is the one tenant birth created — the band this phase admitted. */
    const ownerRoleA = A.roleId;

    const roleTypeOf = async (roleId: string) =>
      (await setup.query<{ type: string }>(`select type from roles where id=$1`, [roleId]))
        .rows[0]!.type;
    assert.equal(await roleTypeOf(ownerRoleA), "owner", "the fixture's owner role really is owner");

    /* ═══ 1 + 3-5. THE CONTRACT: exactly two bands in, three still out ═══ */
    {
      assert.deepEqual(
        [...ONBOARDING_ELIGIBLE_ROLE_TYPES].sort(),
        ["member", "owner"],
        "onboarding admits exactly member and owner",
      );
      assert.deepEqual(
        [...ONBOARDING_EXCLUDED_ROLE_TYPES].sort(),
        ["auditor", "director", "operator"],
        "director, operator and auditor remain excluded — this is not `any role`",
      );
      for (const band of ONBOARDING_EXCLUDED_ROLE_TYPES) {
        const row = await setup.query<{ id: string }>(
          `insert into roles (tenant_id, name, type, system_role) values ($1,$2,$3,false) returning id`,
          [A.tenantId, `Fixture ${band}`, band],
        );
        const refused = await authorizeMembership(
          rootA,
          { targetEmail: `${band}-elect@acme.test`, intendedRoleId: row.rows[0]!.id, justification: REASON },
          govDeps,
        );
        assert.deepEqual(
          refused,
          { status: "refused", reason: "role-not-eligible" },
          `${band} must still be refused after owner was admitted`,
        );
      }
    }

    /* ═══ 6. AN UNAUTHORIZED CALLER CANNOT AUTHORIZE AN OWNER ═══════════ */
    {
      /* Globex's Governance authority is not Acme's, and Acme's role is not Globex's. */
      const crossed = await authorizeMembership(
        rootB,
        { targetEmail: OWNER_ELECT, intendedRoleId: ownerRoleA, justification: REASON },
        govDeps,
      );
      assert.equal(crossed.status, "refused", "another tenant's authority cannot authorize here");
      assert.equal(
        crossed.status === "refused" && crossed.reason,
        "role-unresolvable",
        "…and Acme's owner role is simply not visible to Globex",
      );
    }

    /* ═══ PRIVILEGE SEPARATION: A DELEGATE MAY NOT MINT AN OWNER ═══════ */
    {
      /*
       * Delegation is a grant to act on Governance matters. It is NOT a grant to widen the set of
       * people who hold the tenant. Without this separation one delegation would silently become
       * owner-minting authority — and an owner inherits every capability attached to the band.
       *
       * The distinction is the one `resolveGovernanceAuthority` already draws (`via`), so no new
       * authority, rank or permission was invented to express it.
       */
      const delegate = await seedLocalIdentity(setup, {
        companyName: "AcmeDelegateHolder", companySlug: "acme-delegate-holder",
        email: "delegate@acme.test", password: "delegate-correct-password-5Nw",
      });
      /* The delegate must be a member of ACME, not of their own seeded tenant. */
      const delegateMembership = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
         values ($1,$2,$3,'active',now()) returning id`,
        [A.tenantId, delegate.userId, memberRoleA],
      );
      const delegateSeed = {
        tenantId: A.tenantId,
        userId: delegate.userId,
        authIdentityId: delegate.authIdentityId,
        membershipId: delegateMembership.rows[0]!.id,
        roleId: memberRoleA,
      };
      const delegateCtx = contextFor(
        delegateSeed,
        await sessionRowFor(setup, delegateSeed, "own-dg"),
        "own-delegate",
      );

      const granted = await delegateGovernanceAuthority(
        rootA, { toUserId: delegate.userId, justification: REASON }, govDeps,
      );
      assert.equal(granted.status, "delegated", `delegation refused: ${JSON.stringify(granted)}`);

      /* ═══ 3. THE DELEGATE MAY AUTHORIZE A MEMBER — unchanged ═════════ */
      const memberByDelegate = await authorizeMembership(
        delegateCtx,
        { targetEmail: "member-by-delegate@acme.test", intendedRoleId: memberRoleA, justification: REASON },
        govDeps,
      );
      assert.equal(
        memberByDelegate.status,
        "authorized",
        `a delegate may still authorize a member: ${JSON.stringify(memberByDelegate)}`,
      );

      /* ═══ 4. THE DELEGATE MAY NOT AUTHORIZE AN OWNER ═════════════════ */
      const permitsBefore = async () =>
        Number(
          (await setup.query(`select count(*) from membership_authorizations`)).rows[0]!.count,
        );
      const before = await permitsBefore();
      const ownerByDelegate = await authorizeMembership(
        delegateCtx,
        { targetEmail: "owner-by-delegate@acme.test", intendedRoleId: ownerRoleA, justification: REASON },
        govDeps,
      );
      assert.deepEqual(
        ownerByDelegate,
        { status: "refused", reason: "owner-requires-bootstrap-authority" },
        "a Governance delegate must not be able to mint an owner",
      );

      /* ═══ 5-7. THE REFUSAL WRITES NOTHING, ANYWHERE ══════════════════ */
      assert.equal(await permitsBefore(), before, "no permit row was written");
      const leaked = await setup.query<{ n: string }>(
        `select (
             (select count(*) from membership_authorizations where normalized_email=$1)
           + (select count(*) from invitations where normalized_email=$1)
           + (select count(*) from memberships m join users u on u.id=m.user_id where u.email=$1)
         )::text n`,
        ["owner-by-delegate@acme.test"],
      );
      assert.equal(
        leaked.rows[0]!.n,
        "0",
        "no permit, no invitation and no membership exists for the refused owner-elect",
      );

      /* The refusal is NOT the same as having no Governance authority at all. */
      assert.notEqual(
        ownerByDelegate.status === "refused" ? ownerByDelegate.reason : "",
        "not-the-governance-authority",
        "a delegate genuinely holds Governance authority — the refusal must say which limit applied",
      );
    }

    /* ═══ 2. THE OWNER PERMIT, AND ITS BINDING ═════════════════════════ */
    const ownerAuthorizationId = await (async () => {
      const permit = await authorizeMembership(
        rootA,
        { targetEmail: OWNER_ELECT, intendedRoleId: ownerRoleA, justification: REASON },
        govDeps,
      );
      assert.equal(permit.status, "authorized", `owner permit refused: ${JSON.stringify(permit)}`);
      return permit.status === "authorized" ? permit.authorizationId : "";
    })();

    const permitRow = await setup.query<{ intended_role_id: string; tenant_id: string }>(
      `select intended_role_id, tenant_id from membership_authorizations where id=$1`,
      [ownerAuthorizationId],
    );
    assert.equal(permitRow.rows[0]!.intended_role_id, ownerRoleA, "the permit names the owner role");
    assert.equal(permitRow.rows[0]!.tenant_id, A.tenantId, "…in the authorizing tenant");

    /* ═══ 7. A PERMIT CANNOT BE ISSUED ACROSS TENANTS ══════════════════ */
    {
      const crossed = await issueInvitation(
        rootB, { membershipAuthorizationId: ownerAuthorizationId }, deps,
      );
      assert.equal(crossed.status, "refused", "Globex cannot issue against Acme's permit");
      assert.equal(
        crossed.status === "refused" && crossed.reason,
        "authorization-unresolvable",
        "…and it looks like absence, disclosing nothing about another tenant",
      );
    }

    /* ═══ THE OWNER INVITATION IS ISSUED ═══════════════════════════════ */
    const issued = await issueInvitation(rootA, { membershipAuthorizationId: ownerAuthorizationId }, deps);
    assert.equal(issued.status, "issued", `owner invitation refused: ${JSON.stringify(issued)}`);
    const ownerCapability = issued.status === "issued" ? issued.capability : "";

    const invitationRole = await setup.query<{ type: string }>(
      `select r.type from invitations i join roles r on r.id = i.intended_role_id
        where i.normalized_email = $1`,
      [OWNER_ELECT],
    );
    assert.equal(
      invitationRole.rows[0]!.type,
      "owner",
      "the invitation carries the OWNER band the permit named — not a default",
    );

    /* ═══ 8-9. NO ROLE TRAVELS WITH THE REDEMPTION ═════════════════════ */
    {
      /*
       * The acceptance input is `{ capability, email, password }`. There is no role field, so a
       * member invitation cannot be redeemed as owner and an owner invitation cannot be redeemed as
       * anything else: the band comes from the invitation row alone. Asserted against the SHAPE
       * rather than by attempting a substitution, because a substitution has nowhere to live.
       */
      const memberPermit = await authorizeMembership(
        rootA,
        { targetEmail: MEMBER_ELECT, intendedRoleId: memberRoleA, justification: REASON },
        govDeps,
      );
      assert.equal(memberPermit.status, "authorized");
      const memberIssued = await issueInvitation(
        rootA,
        { membershipAuthorizationId: memberPermit.status === "authorized" ? memberPermit.authorizationId : "" },
        deps,
      );
      assert.equal(memberIssued.status, "issued");

      const memberInvitationRole = await setup.query<{ type: string }>(
        `select r.type from invitations i join roles r on r.id = i.intended_role_id
          where i.normalized_email = $1`,
        [MEMBER_ELECT],
      );
      assert.equal(
        memberInvitationRole.rows[0]!.type,
        "member",
        "a member permit produces a MEMBER invitation, never an owner one",
      );

      /* Redeeming the member capability with the OWNER's email is refused outright. */
      const mismatched = await acceptInvitation(
        {
          capability: memberIssued.status === "issued" ? memberIssued.capability : "",
          email: OWNER_ELECT,
          password: PASSWORD,
        },
        deps,
      );
      assert.equal(
        mismatched.status,
        "refused",
        "a capability may only be redeemed by the address it was issued for",
      );
    }

    /* ═══ THE OWNER ENROLLS, THEN ACCEPTS ══════════════════════════════ */
    /*
     * ACCEPTANCE IS A RE-AUTHENTICATION, NOT ACCOUNT CREATION. It refuses `not-acceptable` unless
     * the invited human is already an active local identity holding a password credential — unknown
     * email, no credential, wrong password and "authenticated human is not the invited human" all
     * collapse to that one reason so nothing can be probed. So the invitee enrolls first, and the
     * enrollment is itself governed: the tenant's Governance authority approves it.
     *
     * Widening the band changed none of this. An owner invitee walks exactly the identity path a
     * member invitee walks.
     */
    {
      const started = await startIdentityEnrollment({ capability: ownerCapability }, deps);
      assert.equal(started.status, "started", `enrollment refused: ${JSON.stringify(started)}`);
      if (started.status !== "started") throw new Error("unreachable");

      /* A PENDING enrollment still cannot reach acceptance. */
      const early = await acceptInvitation(
        { capability: ownerCapability, email: OWNER_ELECT, password: PASSWORD }, deps,
      );
      assert.equal(early.status, "refused", "a pending enrollment cannot be redeemed");

      const approved = await decideIdentityEnrollment(
        rootA,
        { enrollmentId: started.enrollmentId, decision: "approve", justification: REASON },
        govDeps,
      );
      assert.equal(approved.status, "approved", "Governance approves the owner-elect's enrollment");

      const enrolled = await completeIdentityEnrollment(
        {
          capability: ownerCapability,
          continuationReference: started.continuationReference,
          password: PASSWORD,
        },
        deps,
      );
      assert.equal(enrolled.status, "completed", `enrollment completion: ${JSON.stringify(enrolled)}`);
    }

    const accepted = await acceptInvitation(
      { capability: ownerCapability, email: OWNER_ELECT, password: PASSWORD },
      deps,
    );
    assert.equal(accepted.status, "accepted", `owner acceptance refused: ${JSON.stringify(accepted)}`);

    const created = await setup.query<{
      tenant_id: string; status: string; role_type: string; user_email: string;
    }>(
      `select m.tenant_id, m.status, r.type role_type, u.email user_email
         from memberships m join roles r on r.id = m.role_id join users u on u.id = m.user_id
        where u.email = $1`,
      [OWNER_ELECT],
    );
    assert.equal(created.rows.length, 1, "exactly one membership was created");
    assert.equal(created.rows[0]!.role_type, "owner", "and it is an OWNER membership");
    assert.equal(created.rows[0]!.status, "active");
    assert.equal(created.rows[0]!.tenant_id, A.tenantId, "in the authorizing tenant only");

    /* The tenant now has TWO active owners — which is the whole point of the capability. */
    const owners = await setup.query<{ n: string }>(
      `select count(*)::text n from memberships m join roles r on r.id = m.role_id
        where m.tenant_id=$1 and m.status='active' and m.revoked_at is null and r.type='owner'`,
      [A.tenantId],
    );
    assert.equal(owners.rows[0]!.n, "2", "the tenant can now legitimately change hands");

    /* ═══ 10. REPLAY IS STILL REFUSED ══════════════════════════════════ */
    {
      const replay = await acceptInvitation(
        { capability: ownerCapability, email: OWNER_ELECT, password: PASSWORD },
        deps,
      );
      assert.equal(replay.status, "refused", "a consumed capability cannot be redeemed twice");
      const still = await setup.query<{ n: string }>(
        `select count(*)::text n from memberships m join users u on u.id=m.user_id where u.email=$1`,
        [OWNER_ELECT],
      );
      assert.equal(still.rows[0]!.n, "1", "…and no second membership appeared");
    }

    /* ═══ 12. DUPLICATE MEMBERSHIP PROTECTION IS UNCHANGED ═════════════ */
    {
      const secondPermit = await authorizeMembership(
        rootA,
        { targetEmail: OWNER_ELECT, intendedRoleId: memberRoleA, justification: REASON },
        govDeps,
      );
      if (secondPermit.status === "authorized") {
        const secondIssued = await issueInvitation(
          rootA, { membershipAuthorizationId: secondPermit.authorizationId }, deps,
        );
        if (secondIssued.status === "issued") {
          const again = await acceptInvitation(
            { capability: secondIssued.capability, email: OWNER_ELECT, password: PASSWORD },
            deps,
          );
          assert.equal(
            again.status,
            "refused",
            "a human already in the tenant cannot gain a second membership",
          );
        }
      }
      const total = await setup.query<{ n: string }>(
        `select count(*)::text n from memberships m join users u on u.id=m.user_id where u.email=$1`,
        [OWNER_ELECT],
      );
      assert.equal(total.rows[0]!.n, "1", "still exactly one membership for this human");
    }

    console.log("Owner onboarding (PostgreSQL): all assertions passed");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
