/*
 * I1 — Membership Authority against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human currently holding Tenant T's Governance authority — whether by bootstrap or by an
 *    unrevoked delegation — can durably authorize ONE future onboarding of an intended human into
 *    an eligible role, producing a Governance decision and a consumable authorization artifact
 *    bound to it, WITHOUT creating an invitation, a token, a user, an identity, a credential, a
 *    membership or a role; and that ability ends the moment the delegation is revoked."
 *
 * Plus the Director's mandatory attack cases, each marked below.
 *
 * DELIBERATE FIXTURE CHOICE: tenant `Solo` is seeded with an owner role and NOTHING else, so the
 * real production gap — no tenant provisions an onboarding-eligible role — is PROVEN here rather
 * than hidden by a convenience fixture that adds a `member` role everywhere.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
// Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*.
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { resolveGovernanceAuthority } from "../../src/features/governance-decision/decision-authority.server";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import {
  MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION,
  MEMBERSHIP_AUTHORIZATION_DECISION_TYPE,
  MEMBERSHIP_AUTHORIZATION_DOMAIN,
  MEMBERSHIP_AUTHORIZATION_OUTCOME,
  MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE,
} from "../../src/features/membership-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-12T09:00:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";

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
    requestId: "i1-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function addMember(
  client: Client,
  tenantId: string,
  email: string,
  roleType = "member",
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

async function counts(client: Client): Promise<Record<string, number>> {
  const row = await client.query<Record<string, string>>(`
    select (select count(*) from invitations)      as invitations,
           (select count(*) from users)            as users,
           (select count(*) from auth_identities)  as identities,
           (select count(*) from auth_credentials) as credentials,
           (select count(*) from memberships)      as memberships,
           (select count(*) from roles)            as roles,
           (select count(*) from executions)       as executions,
           (select count(*) from provider_connectivity_controls) as providers,
           (select count(*) from decision_records where decision_type = 'delegate-authority')
                                                   as delegations
  `);
  return Object.fromEntries(
    Object.entries(row.rows[0]!).map(([k, v]) => [k, Number(v)]),
  ) as Record<string, number>;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_membership");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed ─────────────────────────────────────────────────────────────────
     * Acme   : A genesis (owner band), B member band (future delegate),
     *          D owner band with NO Governance authority, R a director-band role holder.
     * Globex : X genesis, Y member band — a foreign tenant with a foreign eligible role.
     * Solo   : S genesis, owner band ONLY — the real role-baseline gap, preserved.
     */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    const B = await addMember(setup, A.tenantId, "b@acme.test", "member");
    const D = await addMember(setup, A.tenantId, "d@acme.test", "owner");
    const R = await addMember(setup, A.tenantId, "r@acme.test", "director");

    const X = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "x@globex.test",
      password: "x-correct-password-4Lm",
    });
    const Y = await addMember(setup, X.tenantId, "y@globex.test", "member");

    const S = await seedLocalIdentity(setup, {
      companyName: "Solo",
      companySlug: "solo",
      email: "s@solo.test",
      password: "s-correct-password-2Zt",
    });

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxB = contextFor(B, await sessionRowFor(setup, B, "bbbb"));
    const ctxD = contextFor(D, await sessionRowFor(setup, D, "dddd"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "eeee"));
    const ctxS = contextFor(S, await sessionRowFor(setup, S, "ffff"));

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
    await establish(S, ctxS);

    const before = await counts(setup);

    /* ── ATTACK 1 — unauthenticated actor refused ───────────────────────────── */
    assert.deepEqual(
      await authorizeMembership(
        null,
        { targetEmail: "new@acme.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "unauthenticated" },
    );

    /* ── ATTACK 2 — an ordinary member is refused ───────────────────────────── */
    assert.deepEqual(
      await authorizeMembership(
        ctxB,
        { targetEmail: "new@acme.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "not-the-governance-authority" },
    );

    /* ── ATTACK 3 — the OWNER band without Governance authority is refused ──── */
    assert.deepEqual(
      await authorizeMembership(
        ctxD,
        { targetEmail: "new@acme.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "not-the-governance-authority" },
    );

    /* ── ATTACK 9/10/11 — target role band and existence ────────────────────── */
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: D.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-not-eligible" },
      "owner is not an onboarding-eligible band",
    );
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: R.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-not-eligible" },
      "director is not an onboarding-eligible band",
    );
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: randomUUID(), justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-unresolvable" },
    );

    /* ── ATTACK 8 — a foreign tenant's role is unresolvable, not "forbidden" ── */
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: Y.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-unresolvable" },
    );

    /* ── ATTACK 7 — wrong tenant: Globex's authority cannot use Acme's role ─── */
    assert.deepEqual(
      await authorizeMembership(
        ctxX,
        { targetEmail: "new@globex.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-unresolvable" },
    );

    /* ── ATTACK 12 — a tenant with no eligible role refuses, and says why ───── */
    {
      assert.equal((await resolveGovernanceAuthority(ctxS, deps)).authorized, true);
      assert.deepEqual(
        await authorizeMembership(
          ctxS,
          { targetEmail: "new@solo.test", intendedRoleId: randomUUID(), justification: REASON },
          deps,
        ),
        { status: "refused", reason: "no-eligible-role-in-tenant" },
        "the role-baseline gap must be reported as itself, not as a bad input",
      );
    }

    /* ── Input validation ───────────────────────────────────────────────────── */
    for (const bad of ["", "not-an-email", "  "]) {
      assert.deepEqual(
        await authorizeMembership(
          ctxA,
          { targetEmail: bad, intendedRoleId: B.roleId, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "invalid-target-email" },
      );
    }
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: B.roleId, justification: "too short" },
        deps,
      ),
      { status: "refused", reason: "justification-required" },
    );

    /* Nothing above may have written anything. */
    assert.deepEqual(await counts(setup), before, "no refusal may create a row");
    assert.equal(
      Number(
        (await setup.query(`select count(*) from membership_authorizations`)).rows[0]!.count,
      ),
      0,
    );

    /* ── ATTACK 4 — the BOOTSTRAP authority is accepted ──────────────────────── */
    let firstAuthorizationId = "";
    {
      const result = await authorizeMembership(
        ctxA,
        { targetEmail: "  New.Hire@Acme.TEST ", intendedRoleId: B.roleId, justification: REASON },
        deps,
      );
      assert.equal(result.status, "authorized");
      if (result.status !== "authorized") throw new Error("unreachable");
      firstAuthorizationId = result.authorizationId;

      /* The artifact, and every field the Director required it to answer. */
      const row = (
        await setup.query(`select * from membership_authorizations where id = $1`, [
          result.authorizationId,
        ])
      ).rows[0]!;
      assert.equal(row.tenant_id, A.tenantId);
      assert.equal(row.normalized_email, "new.hire@acme.test", "stored normalized, not as typed");
      assert.equal(row.intended_role_id, B.roleId);
      assert.equal(row.governance_decision_id, result.decisionId);
      assert.equal(row.governance_session_id, result.sessionId);
      assert.equal(row.authorized_by_actor_type, "human");
      assert.equal(row.authorized_by_actor_id, A.userId);
      assert.equal(row.status, "authorized");
      assert.equal(row.consumed_at, null, "I1 never consumes");
      assert.equal(row.consumed_by_invitation_id, null);
      assert.equal(row.revoked_at, null);

      /* The Governance decision, bound to the artifact and to no email string. */
      const decision = (
        await setup.query<{
          decision_type: string;
          subject_type: string;
          subject_id: string;
          outcome: string;
          actor_type: string;
          actor_id: string;
          bootstrap: boolean;
          evidence: Record<string, unknown>;
          justification: string;
        }>(`select * from decision_records where id = $1`, [result.decisionId])
      ).rows[0]!;
      assert.equal(decision.decision_type, MEMBERSHIP_AUTHORIZATION_DECISION_TYPE);
      assert.equal(decision.subject_type, MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE);
      assert.equal(decision.subject_id, result.authorizationId, "the subject is the artifact");
      assert.equal(decision.outcome, MEMBERSHIP_AUTHORIZATION_OUTCOME);
      assert.equal(decision.actor_type, "human");
      assert.equal(decision.actor_id, A.userId);
      assert.equal(decision.bootstrap, false, "this is never a genesis");
      assert.ok(
        !JSON.stringify(decision.evidence).includes("acme.test"),
        "the intended human's address must not be duplicated into Governance evidence",
      );
      assert.ok(
        !decision.justification.includes("@"),
        "the future human must not be smuggled into justification text",
      );

      const session = (
        await setup.query(`select * from governance_sessions where id = $1`, [result.sessionId])
      ).rows[0]!;
      assert.equal(session.governance_domain, MEMBERSHIP_AUTHORIZATION_DOMAIN);
      assert.notEqual(session.governance_domain, "authority-delegation");

      /* Audit: one row, identity only, no address and no justification duplicate. */
      const audit = (
        await setup.query(`select * from audit_log where action = $1`, [
          MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION,
        ])
      ).rows;
      assert.equal(audit.length, 1);
      assert.equal(audit[0]!.entity_id, result.decisionId);
      assert.equal(audit[0]!.result, "committed");
      const auditJson = JSON.stringify(audit[0]!.metadata);
      assert.ok(auditJson.includes(result.authorizationId));
      assert.ok(!auditJson.includes("acme.test"), "audit must not duplicate the address");
      assert.ok(!auditJson.includes(REASON), "audit must not duplicate the justification");
    }

    /* ── ATTACKS 19-27 — nothing else in the world changed ──────────────────── */
    {
      const after = await counts(setup);
      assert.equal(after.invitations, before.invitations, "no invitation created");
      assert.equal(after.users, before.users, "no user created");
      assert.equal(after.identities, before.identities, "no auth_identity created");
      assert.equal(after.credentials, before.credentials, "no credential created");
      assert.equal(after.memberships, before.memberships, "no membership created");
      assert.equal(after.roles, before.roles, "no role created");
      assert.equal(after.delegations, before.delegations, "no Governance delegation side effect");
      assert.equal(after.providers, before.providers, "no provider side effect");
      assert.equal(after.executions, before.executions, "no execution side effect");
    }

    /* ── ATTACK 18 — a duplicate live authorization is refused ──────────────── */
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "NEW.HIRE@acme.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "already-authorized" },
      "normalization must make a differently-cased address the same human",
    );

    /* ── ATTACKS 13-17 — forged fields cannot reach the row ─────────────────── */
    {
      const forged = {
        targetEmail: "forged@acme.test",
        intendedRoleId: B.roleId,
        justification: REASON,
        /* None of these are parameters. They are supplied to prove they are ignored. */
        tenantId: X.tenantId,
        userId: X.userId,
        actorId: X.userId,
        governanceDecisionId: randomUUID(),
        governanceSessionId: randomUUID(),
        status: "consumed",
        authorizedByActorType: "agent",
        consumedAt: NOW.toISOString(),
      } as unknown as {
        targetEmail: string;
        intendedRoleId: string;
        justification: string;
      };

      const result = await authorizeMembership(ctxA, forged, deps);
      assert.equal(result.status, "authorized");
      if (result.status !== "authorized") throw new Error("unreachable");

      const row = (
        await setup.query(`select * from membership_authorizations where id = $1`, [
          result.authorizationId,
        ])
      ).rows[0]!;
      assert.equal(row.tenant_id, A.tenantId, "forged tenantId ignored");
      assert.equal(row.authorized_by_actor_id, A.userId, "forged actorId ignored");
      assert.equal(row.authorized_by_actor_type, "human", "forged actor type ignored");
      assert.equal(row.governance_decision_id, result.decisionId, "forged decision id ignored");
      assert.equal(row.governance_session_id, result.sessionId, "forged session id ignored");
      assert.equal(row.status, "authorized", "forged status ignored");
      assert.equal(row.consumed_at, null, "forged consumption ignored");
    }

    /* ── ATTACK 5 — an ACTIVE delegate may authorize ────────────────────────── */
    let delegationId = "";
    {
      const delegated = await delegateGovernanceAuthority(
        ctxA,
        { toUserId: B.userId, justification: REASON },
        deps,
      );
      assert.equal(delegated.status, "delegated");
      if (delegated.status !== "delegated") throw new Error("unreachable");
      delegationId = delegated.decisionId;

      const authority = await resolveGovernanceAuthority(ctxB, deps);
      assert.equal(authority.authorized, true);
      assert.equal(authority.via, "delegated");

      const result = await authorizeMembership(
        ctxB,
        { targetEmail: "by-delegate@acme.test", intendedRoleId: B.roleId, justification: REASON },
        deps,
      );
      assert.equal(result.status, "authorized", "an active delegate holds the same capability");
      if (result.status !== "authorized") throw new Error("unreachable");

      const row = (
        await setup.query(`select * from membership_authorizations where id = $1`, [
          result.authorizationId,
        ])
      ).rows[0]!;
      assert.equal(row.authorized_by_actor_id, B.userId, "the delegate is the accountable actor");

      /* Provenance records HOW the delegate held authority, so history is readable later. */
      const decision = (
        await setup.query<{ evidence: Record<string, unknown> }>(
          `select evidence from decision_records where id = $1`,
          [result.decisionId],
        )
      ).rows[0]!;
      assert.equal(decision.evidence.authorityVia, "delegated");
      assert.equal(decision.evidence.authorityDelegationDecisionId, delegationId);
    }

    /* ── ATTACK 6 — a REVOKED delegate may no longer authorize ──────────────── */
    {
      const revoked = await revokeGovernanceAuthority(
        ctxA,
        { delegationDecisionId: delegationId, justification: REASON },
        deps,
      );
      assert.equal(revoked.status, "revoked");

      assert.equal((await resolveGovernanceAuthority(ctxB, deps)).authorized, false);
      assert.deepEqual(
        await authorizeMembership(
          ctxB,
          { targetEmail: "after-revoke@acme.test", intendedRoleId: B.roleId, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "not-the-governance-authority" },
        "revoking authority must end the ability to admit humans",
      );

      /* History is intact: the authorization the delegate made while authorized still stands. */
      const survivors = await setup.query(
        `select count(*) from membership_authorizations where authorized_by_actor_id = $1`,
        [B.userId],
      );
      assert.equal(Number(survivors.rows[0]!.count), 1, "revocation is not retroactive");
    }

    /* ── The consumption invariant is the DATABASE's, ready for I2 ──────────── */
    {
      /* I1 wrote no invitation, so consumption cannot even be attempted yet — but the constraint
       * that will stop I2 spending one authorization twice is already installed and proven. */
      const constraint = await setup.query(`
        select indexdef from pg_indexes
         where tablename = 'membership_authorizations'
           and indexname = 'membership_authorizations_consumed_invitation_uq'
      `);
      assert.equal(constraint.rows.length, 1, "the one-time consumption index must exist");
      assert.match(String(constraint.rows[0]!.indexdef), /UNIQUE/);

      /* And the artifact cannot claim consumption without naming the invitation. */
      await assert.rejects(
        setup.query(`update membership_authorizations set status = 'consumed' where id = $1`, [
          firstAuthorizationId,
        ]),
        /membership_authorizations_consumed/,
        "consumed without evidence must be unrepresentable",
      );
    }

    /* ── An agent may never be the authorizing actor — enforced by Postgres ─── */
    await assert.rejects(
      setup.query(
        `insert into membership_authorizations
           (tenant_id, normalized_email, intended_role_id, governance_decision_id,
            governance_session_id, authorized_by_actor_type, authorized_by_actor_id)
         select tenant_id, 'agent-made@acme.test', intended_role_id, governance_decision_id,
                governance_session_id, 'agent', authorized_by_actor_id
           from membership_authorizations where id = $1`,
        [firstAuthorizationId],
      ),
      /membership_authorizations_human_authorizer_chk/,
      "human supremacy must be a database fact",
    );

    console.log("PASS i1 membership authorization (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
