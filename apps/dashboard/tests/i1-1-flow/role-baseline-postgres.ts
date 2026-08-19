/*
 * I1.1 — Tenant role baseline against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION, VERBATIM FROM THE BRIEF, IS WHAT THIS FILE PROVES:
 *
 *   "A tenant's ordinary member role exists because an already-authorized human explicitly
 *    provisioned it through Governance; PostgreSQL prevents a second ordinary member role for that
 *    tenant; the role itself grants no Governance or other privileged authority; and I1 can consume
 *    that role for membership authorization without I1.1 creating any human, invitation,
 *    credential, identity, or membership."
 *
 * Plus the mandatory before/after I1 integration proof and the Director's attack cases.
 *
 * DELIBERATE FIXTURE CHOICE: no fixture creates a `member` role. Every member role in this file is
 * created by the ceremony under test, so the gap I1.1 exists to close is never faked away.
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
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "../../src/features/governance-decision/authority-delegation.server";
import { provisionMemberRole } from "../../src/features/tenant-role-baseline/provision-member-role.server";
import {
  BASELINE_ROLE_NAME,
  BASELINE_ROLE_TYPE,
  ORGANIZATIONAL_ROLE_AUDIT_ACTION,
  ORGANIZATIONAL_ROLE_DECISION_TYPE,
  ORGANIZATIONAL_ROLE_DOMAIN,
  ORGANIZATIONAL_ROLE_OUTCOME,
  ORGANIZATIONAL_ROLE_SUBJECT_TYPE,
} from "../../src/features/tenant-role-baseline/contracts";
import { authorizeMembership } from "../../src/features/membership-authority/authorize-membership.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const NOW = new Date("2026-08-12T11:00:00.000Z");
const REASON = "Establishing this organization's ordinary member role is a deliberate decision.";

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
    requestId: "i1-1-request",
    authenticatedAt: NOW.toISOString(),
  };
}

/** NOTE: `roleType` never defaults to `member` here — see the header. */
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

async function counts(client: Client): Promise<Record<string, number>> {
  const row = await client.query<Record<string, string>>(`
    select (select count(*) from invitations)      as invitations,
           (select count(*) from memberships)      as memberships,
           (select count(*) from users)            as users,
           (select count(*) from auth_identities)  as identities,
           (select count(*) from auth_credentials) as credentials,
           (select count(*) from knowledge_nodes)  as knowledge,
           (select count(*) from executions)       as executions,
           (select count(*) from provider_connectivity_controls) as providers
  `);
  return Object.fromEntries(
    Object.entries(row.rows[0]!).map(([k, v]) => [k, Number(v)]),
  ) as Record<string, number>;
}

async function memberRoles(client: Client, tenantId: string) {
  return (
    await client.query<{ id: string; name: string; type: string }>(
      `select id, name, type from roles where tenant_id = $1 and type = 'member'`,
      [tenantId],
    )
  ).rows;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i1_1_baseline");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db, now: () => NOW } as never;

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── Seed. NOBODY gets a `member` role. ───────────────────────────────── */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme",
      email: "a@acme.test",
      password: "a-correct-password-7Qx",
    });
    // An ordinary human with no Governance authority (auditor band carries no connected privilege).
    const B = await addMember(setup, A.tenantId, "b@acme.test", "auditor");
    // The OWNER band — the strongest product role — and no Governance authority.
    const D = await addMember(setup, A.tenantId, "d@acme.test", "owner");

    const X = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex",
      email: "x@globex.test",
      password: "x-correct-password-4Lm",
    });
    const Y = await addMember(setup, X.tenantId, "y@globex.test", "auditor");

    const ctxA = contextFor(A, await sessionRowFor(setup, A, "aaaa"));
    const ctxB = contextFor(B, await sessionRowFor(setup, B, "bbbb"));
    const ctxD = contextFor(D, await sessionRowFor(setup, D, "dddd"));
    const ctxX = contextFor(X, await sessionRowFor(setup, X, "eeee"));
    /* Y's session row must exist for the Globex block to build a context from the database; the
     * context itself is assembled there, from what was actually persisted. */
    await sessionRowFor(setup, Y, "ffff");

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

    /* Snapshot the seeded owner role so "unchanged" is a claim about real bytes. */
    const ownerBefore = (
      await setup.query(`select * from roles where id = $1`, [A.roleId])
    ).rows[0]!;
    const before = await counts(setup);

    /* ══ I1 INTEGRATION — BEFORE ═════════════════════════════════════════════
     * The gap this phase exists to close, proven present first. */
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        { targetEmail: "new@acme.test", intendedRoleId: A.roleId, justification: REASON },
        deps,
      ),
      { status: "refused", reason: "role-not-eligible" },
      "the owner role is not onboarding-eligible",
    );
    assert.deepEqual(
      await authorizeMembership(
        ctxA,
        {
          targetEmail: "new@acme.test",
          intendedRoleId: "00000000-0000-4000-8000-000000000000",
          justification: REASON,
        },
        deps,
      ),
      { status: "refused", reason: "no-eligible-role-in-tenant" },
      "BEFORE I1.1: the tenant has no onboarding-eligible role at all",
    );
    assert.equal((await memberRoles(setup, A.tenantId)).length, 0);

    /* ── ATTACKS 1-3 — who may NOT provision ───────────────────────────────── */
    assert.deepEqual(await provisionMemberRole(null, { justification: REASON }, deps), {
      status: "refused",
      reason: "unauthenticated",
    });
    assert.deepEqual(await provisionMemberRole(ctxB, { justification: REASON }, deps), {
      status: "refused",
      reason: "not-the-governance-authority",
    });
    assert.deepEqual(await provisionMemberRole(ctxD, { justification: REASON }, deps), {
      status: "refused",
      reason: "not-the-governance-authority",
    });
    /* Justification is still required of a real authority. */
    assert.deepEqual(await provisionMemberRole(ctxA, { justification: "short" }, deps), {
      status: "refused",
      reason: "justification-required",
    });
    assert.equal((await memberRoles(setup, A.tenantId)).length, 0, "no refusal may create a role");

    /* ── ATTACK 4 — the BOOTSTRAP authority provisions ─────────────────────── */
    let memberRoleId = "";
    {
      const result = await provisionMemberRole(ctxA, { justification: REASON }, deps);
      assert.equal(result.status, "provisioned");
      if (result.status !== "provisioned") throw new Error("unreachable");
      memberRoleId = result.roleId;

      const rows = await memberRoles(setup, A.tenantId);
      assert.equal(rows.length, 1, "exactly one member role");
      assert.equal(rows[0]!.id, result.roleId);
      assert.equal(rows[0]!.name, BASELINE_ROLE_NAME);
      assert.equal(rows[0]!.type, BASELINE_ROLE_TYPE);

      /* The role row carries NO invented authority. */
      const role = (await setup.query(`select * from roles where id = $1`, [result.roleId]))
        .rows[0]!;
      assert.equal(role.system_role, false);
      assert.equal(role.authority_rank, null, "authority_rank must stay unused");
      assert.equal(role.policy_refs, null, "policy_refs must stay unused");
      assert.equal(role.created_by, A.userId);
      assert.equal(role.created_by_type, "human");
      assert.equal(role.tenant_id, A.tenantId);
      /* Provenance is decision-side: no governance columns were bolted onto roles. */
      assert.ok(
        !Object.keys(role).some((k) => /decision|governance|session/.test(k)),
        "roles must not carry Governance provenance columns",
      );

      /* The Governance decision, bound to the exact role. */
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
        }>(`select * from decision_records where id = $1`, [result.decisionId])
      ).rows[0]!;
      assert.equal(decision.decision_type, ORGANIZATIONAL_ROLE_DECISION_TYPE);
      assert.equal(decision.subject_type, ORGANIZATIONAL_ROLE_SUBJECT_TYPE);
      assert.equal(decision.subject_id, result.roleId, "the subject is the exact role");
      assert.equal(decision.outcome, ORGANIZATIONAL_ROLE_OUTCOME);
      assert.equal(decision.actor_type, "human");
      assert.equal(decision.actor_id, A.userId);
      assert.equal(decision.bootstrap, false);
      assert.equal(decision.evidence.authorityVia, "bootstrap");

      const session = (
        await setup.query<{ governance_domain: string }>(
          `select * from governance_sessions where id = $1`,
          [result.sessionId],
        )
      ).rows[0]!;
      assert.equal(session.governance_domain, ORGANIZATIONAL_ROLE_DOMAIN);
      assert.notEqual(session.governance_domain, "membership-authorization");
      assert.notEqual(session.governance_domain, "authority-delegation");

      /* Audit: one row, identity only. */
      const audit = (
        await setup.query<{ entity_id: string; result: string; metadata: Record<string, unknown> }>(
          `select * from audit_log where action = $1`,
          [ORGANIZATIONAL_ROLE_AUDIT_ACTION],
        )
      ).rows;
      assert.equal(audit.length, 1);
      assert.equal(audit[0]!.entity_id, result.decisionId);
      assert.equal(audit[0]!.result, "committed");
      assert.equal(audit[0]!.metadata.provisionedRoleId, result.roleId);
      assert.ok(
        !JSON.stringify(audit[0]!.metadata).includes(REASON),
        "audit must not duplicate the justification",
      );
    }

    /* ── ATTACK 20 — the seeded owner role is byte-for-byte unchanged ──────── */
    {
      const ownerAfter = (await setup.query(`select * from roles where id = $1`, [A.roleId]))
        .rows[0]!;
      assert.deepEqual(ownerAfter, ownerBefore, "provisioning must not touch an existing role");
    }

    /* ── ATTACKS 21-30 — nothing else in the world changed ─────────────────── */
    {
      const after = await counts(setup);
      assert.equal(after.memberships, before.memberships, "no membership created");
      assert.equal(after.invitations, before.invitations, "no invitation created");
      assert.equal(after.users, before.users, "no user created");
      assert.equal(after.identities, before.identities, "no auth identity created");
      assert.equal(after.credentials, before.credentials, "no credential created");
      assert.equal(after.knowledge, before.knowledge, "no Knowledge mutation");
      assert.equal(after.providers, before.providers, "no provider mutation");
      assert.equal(after.executions, before.executions, "no execution mutation");
    }

    /* ── THE UNIQUENESS INVARIANT IS THE DATABASE'S ───────────────────────── */
    await assert.rejects(
      setup.query(`insert into roles (tenant_id, name, type) values ($1, 'Second', 'member')`, [
        A.tenantId,
      ]),
      /roles_one_member_per_tenant_uq/,
      "a second ordinary member role must be impossible, enforced by Postgres",
    );
    /* Privileged bands stay UNCONSTRAINED — the index is partial on purpose. */
    await setup.query(`insert into roles (tenant_id, name, type) values ($1, 'Second Owner', 'owner')`, [
      A.tenantId,
    ]);

    /* ── ATTACK 26 — the provisioned role grants NO Governance authority ───── */
    {
      const holder = await addMember(setup, A.tenantId, "m@acme.test", "auditor");
      await setup.query(`update memberships set role_id = $1 where id = $2`, [
        memberRoleId,
        holder.membershipId,
      ]);
      const ctxHolder = contextFor(
        { ...holder, roleId: memberRoleId },
        await sessionRowFor(setup, holder, "1111"),
      );
      assert.equal(
        (await resolveGovernanceAuthority(ctxHolder, deps)).authorized,
        false,
        "holding the member role grants no Governance authority",
      );
      assert.deepEqual(await provisionMemberRole(ctxHolder, { justification: REASON }, deps), {
        status: "refused",
        reason: "not-the-governance-authority",
      });
    }

    const beforeI1 = await counts(setup);
    const context = ctxA;

    /* ── ATTACK 18 — provisioning twice is refused, and mutates nothing ────── */
    assert.deepEqual(await provisionMemberRole(context, { justification: REASON }, deps), {
      status: "refused",
      reason: "already-provisioned",
    });
    assert.equal((await memberRoles(setup, A.tenantId)).length, 1);

    /* ── ATTACKS 8-12 — forged fields cannot reach anything ────────────────── */
    {
      const forged = {
        justification: REASON,
        tenantId: "00000000-0000-4000-8000-000000000000",
        actorId: "00000000-0000-4000-8000-000000000001",
        actorType: "agent",
        roleId: "00000000-0000-4000-8000-000000000002",
        type: "owner",
        name: "Owner",
      } as unknown as { justification: string };
      /* Already provisioned, so the truthful refusal is the same one — and crucially the forged
       * `type: "owner"` created nothing, which the role census below proves. */
      assert.deepEqual(await provisionMemberRole(context, forged, deps), {
        status: "refused",
        reason: "already-provisioned",
      });
      const census = (
        await setup.query<{ type: string; count: string }>(
          `select type, count(*)::text from roles where tenant_id = $1 group by type order by type`,
          [A.tenantId],
        )
      ).rows;
      /*
       * `order by type` sorts by the ENUM's declaration order (owner, director, operator, auditor,
       * member), not alphabetically — a Postgres property worth stating rather than re-discovering.
       *
       * owner   3 — the seeded Owner, D's owner role, and the "Second Owner" inserted above to show
       *             the partial index leaves privileged bands unconstrained.
       * auditor 2 — B, and the member-role holder seeded in the ATTACK 26 block.
       * member  1 — the ONE role the ceremony created. No forged `type: "owner"` appeared.
       */
      assert.deepEqual(
        census,
        [
          { type: "owner", count: "3" },
          { type: "auditor", count: "2" },
          { type: "member", count: "1" },
        ],
        "no forged role type may appear, and member stays at exactly one",
      );
    }

    /* ══ I1 INTEGRATION — AFTER ═════════════════════════════════════════════ */
    {
      const result = await authorizeMembership(
        context,
        { targetEmail: "new@acme.test", intendedRoleId: memberRoleId, justification: REASON },
        deps,
      );
      assert.equal(result.status, "authorized", "I1 must now succeed against the provisioned role");
      if (result.status !== "authorized") throw new Error("unreachable");

      const row = (
        await setup.query<{ intended_role_id: string }>(
          `select intended_role_id from membership_authorizations where id = $1`,
          [result.authorizationId],
        )
      ).rows[0]!;
      assert.equal(row.intended_role_id, memberRoleId);

      /* I2 still does not exist. */
      const afterI1 = await counts(setup);
      assert.equal(afterI1.invitations, beforeI1.invitations, "no invitation");
      assert.equal(afterI1.memberships, beforeI1.memberships, "no membership");
      assert.equal(afterI1.users, beforeI1.users, "no user");
      assert.equal(afterI1.identities, beforeI1.identities, "no auth identity");
      assert.equal(afterI1.credentials, beforeI1.credentials, "no credential");
    }

    /* ══ TENANT ISOLATION + delegated / revoked authority (Globex) ══════════ */
    {
      const globexTenant = (
        await setup.query<{ id: string }>(`select id from companies where slug = 'globex'`)
      ).rows[0]!.id;

      /* Tenant A's member role does not satisfy Globex, and uniqueness is tenant-scoped. */
      assert.equal((await memberRoles(setup, globexTenant)).length, 0);

      const xUser = (
        await setup.query<{ actor_id: string }>(
          `select actor_id from decision_records where tenant_id = $1 and bootstrap = true`,
          [globexTenant],
        )
      ).rows[0]!.actor_id;
      const xSession = (
        await setup.query<{ id: string; auth_identity_id: string; active_membership_id: string }>(
          `select id, auth_identity_id, active_membership_id from user_session_contexts
            where user_id = $1 limit 1`,
          [xUser],
        )
      ).rows[0]!;
      const ctxX: TenantContext = {
        tenantId: globexTenant,
        userId: xUser,
        authIdentityId: xSession.auth_identity_id,
        membershipId: xSession.active_membership_id,
        membershipVersion: 1,
        roleId: (
          await setup.query<{ role_id: string }>(`select role_id from memberships where id = $1`, [
            xSession.active_membership_id,
          ])
        ).rows[0]!.role_id,
        sessionContextId: xSession.id,
        provider: "local",
        assuranceLevel: "aal1",
        mfaVerified: false,
        requestId: "i1-1-request",
        authenticatedAt: NOW.toISOString(),
      };

      /* Tenant A's authority cannot provision in Globex: the tenant comes from the session. */
      assert.equal(
        (await resolveGovernanceAuthority({ ...context, tenantId: globexTenant }, deps)).authorized,
        false,
        "A's human holds no authority inside Globex",
      );

      /* ── ATTACK 5 — an ACTIVE delegate may provision ─────────────────────── */
      const yUser = (
        await setup.query<{ id: string }>(`select id from users where email = 'y@globex.test'`)
      ).rows[0]!.id;
      const delegated = await delegateGovernanceAuthority(
        ctxX,
        { toUserId: yUser, justification: REASON },
        deps,
      );
      assert.equal(delegated.status, "delegated");
      if (delegated.status !== "delegated") throw new Error("unreachable");

      const ySession = (
        await setup.query<{ id: string; auth_identity_id: string; active_membership_id: string }>(
          `select id, auth_identity_id, active_membership_id from user_session_contexts
            where user_id = $1 limit 1`,
          [yUser],
        )
      ).rows[0]!;
      const ctxY: TenantContext = {
        ...ctxX,
        userId: yUser,
        authIdentityId: ySession.auth_identity_id,
        membershipId: ySession.active_membership_id,
        roleId: (
          await setup.query<{ role_id: string }>(`select role_id from memberships where id = $1`, [
            ySession.active_membership_id,
          ])
        ).rows[0]!.role_id,
        sessionContextId: ySession.id,
      };

      const byDelegate = await provisionMemberRole(ctxY, { justification: REASON }, deps);
      assert.equal(byDelegate.status, "provisioned", "an active delegate holds the capability");
      if (byDelegate.status !== "provisioned") throw new Error("unreachable");

      /* Tenant-scoped uniqueness: both tenants now independently hold exactly one. */
      assert.equal((await memberRoles(setup, globexTenant)).length, 1);
      assert.equal((await memberRoles(setup, A.tenantId)).length, 1);

      const evidence = (
        await setup.query<{ evidence: Record<string, unknown> }>(
          `select evidence from decision_records where id = $1`,
          [byDelegate.decisionId],
        )
      ).rows[0]!;
      assert.equal(evidence.evidence.authorityVia, "delegated");

      /* ── Tenant A's I1 cannot target Globex's role ───────────────────────── */
      const globexRoleId = (await memberRoles(setup, globexTenant))[0]!.id;
      assert.deepEqual(
        await authorizeMembership(
          context,
          { targetEmail: "cross@acme.test", intendedRoleId: globexRoleId, justification: REASON },
          deps,
        ),
        { status: "refused", reason: "role-unresolvable" },
        "a foreign tenant's role is unresolvable, not merely forbidden",
      );

      /* ── ATTACK 6 — a REVOKED delegate may no longer provision ───────────── */
      assert.equal(
        (
          await revokeGovernanceAuthority(
            ctxX,
            { delegationDecisionId: delegated.decisionId, justification: REASON },
            deps,
          )
        ).status,
        "revoked",
      );
      assert.equal((await resolveGovernanceAuthority(ctxY, deps)).authorized, false);
      assert.deepEqual(await provisionMemberRole(ctxY, { justification: REASON }, deps), {
        status: "refused",
        reason: "not-the-governance-authority",
      });
      /* History is intact: the role the delegate provisioned while authorized still stands. */
      assert.equal((await memberRoles(setup, globexTenant)).length, 1);
    }

    console.log("PASS i1.1 role baseline (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
