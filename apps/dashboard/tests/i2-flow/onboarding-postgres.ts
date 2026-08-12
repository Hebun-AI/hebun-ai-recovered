/*
 * I2 — the complete human onboarding lifecycle against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A Governance-authorized prospective membership becomes a durable membership carrying the EXACT
 *    intended tenant, human and member role — after the invited human proves both possession of the
 *    capability and the credential of the identity the authorization named. The authorization is
 *    spent exactly once, the invitation is accepted exactly once, and no user, identity, credential,
 *    role, session or Governance grant is created along the way."
 *
 * Both human paths are proven end to end:
 *   PATH A  brand-new human  — I1.2 enrollment, then acceptance, then real tenant access
 *   PATH B  existing human   — acceptance only, and the honest limit on tenant access
 *
 * Plus the Director's attack matrix, each case marked below.
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
import { startIdentityEnrollment } from "../../src/features/identity-enrollment/start-enrollment.server";
import { decideIdentityEnrollment } from "../../src/features/identity-enrollment/decide-enrollment.server";
import { completeIdentityEnrollment } from "../../src/features/identity-enrollment/complete-enrollment.server";
import { issueInvitation } from "../../src/features/human-onboarding/issue-invitation.server";
import {
  acceptInvitation,
  describeTenantReachability,
} from "../../src/features/human-onboarding/accept-invitation.server";
import {
  INVITATION_ISSUED_ACTION,
  MEMBERSHIP_CREATED_ACTION,
} from "../../src/features/human-onboarding/contracts";
import {
  issueLocalSession,
  resolveSessionFromReference,
  selectTenantForSession,
} from "../../src/features/auth-runtime/session-service.server";
import { findPrimaryActiveMembership } from "../../src/features/auth-runtime/identity-repository.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type {
  AuthenticationDigestKey,
  ConfiguredAuthenticationEnvironment,
} from "../../src/features/auth/environment/auth-environment.server";

const NOW = new Date("2026-08-12T15:00:00.000Z");
const REASON = "Admitting this person is a deliberate organizational decision with a stated reason.";
const KEY: AuthenticationDigestKey = Object.freeze({ version: 1, secret: "i2-test-digest-secret" });
const NEWCOMER = "newcomer@acme.test";
const NEWCOMER_PASSWORD = "a-correct-horse-battery-7Qx";

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

async function counts(client: Client): Promise<Record<string, number>> {
  const row = await client.query<Record<string, string>>(`
    select (select count(*) from users)                        as users,
           (select count(*) from auth_identities)              as identities,
           (select count(*) from auth_credentials)             as credentials,
           (select count(*) from memberships)                  as memberships,
           (select count(*) from roles)                        as roles,
           (select count(*) from invitations)                  as invitations,
           (select count(*) from user_session_contexts)        as sessions,
           (select count(*) from identity_enrollment_requests) as enrollments,
           (select count(*) from decision_records)             as decisions,
           (select count(*) from knowledge_nodes)              as knowledge,
           (select count(*) from executions)                   as executions,
           (select count(*) from provider_connectivity_controls) as providers
  `);
  return Object.fromEntries(
    Object.entries(row.rows[0]!).map(([k, v]) => [k, Number(v)]),
  ) as Record<string, number>;
}

/** Authorize one onboarding through I1 and return the authorization id. */
async function authorize(
  ctx: TenantContext,
  email: string,
  roleId: string,
  govDeps: never,
): Promise<string> {
  const result = await authorizeMembership(
    ctx, { targetEmail: email, intendedRoleId: roleId, justification: REASON }, govDeps,
  );
  assert.equal(result.status, "authorized", `I1 must authorize ${email}`);
  if (result.status !== "authorized") throw new Error("unreachable");
  return result.authorizationId;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_i2_onboarding");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const govDeps = { getDb: () => handle.db, now: () => NOW } as never;
  const deps = { getDb: () => handle.db, now: () => NOW, digestKey: KEY };

  try {
    harness.migrateDatabase();
    await setup.connect();

    /* ── The world before I2: two tenants, each with Governance. ────────────── */
    const A = await seedLocalIdentity(setup, {
      companyName: "Acme", companySlug: "acme",
      email: "root@acme.test", password: "a-correct-password-7Qx",
    });
    const B = await seedLocalIdentity(setup, {
      companyName: "Globex", companySlug: "globex",
      email: "root@globex.test", password: "another-correct-password-8Rz",
    });

    const aSession = await sessionRowFor(setup, A, "i2-a");
    const bSession = await sessionRowFor(setup, B, "i2-b");
    const rootA = contextFor(A, aSession, "i2-root-a");
    const rootB = contextFor(B, bSession, "i2-root-b");

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

    /* I1.1 provisions each tenant's ordinary member role — not assumed to exist. */
    const roleA = await provisionMemberRole(rootA, { justification: REASON }, govDeps);
    const roleB = await provisionMemberRole(rootB, { justification: REASON }, govDeps);
    assert.equal(roleA.status, "provisioned");
    assert.equal(roleB.status, "provisioned");
    if (roleA.status !== "provisioned" || roleB.status !== "provisioned") throw new Error("x");
    const memberRoleA = roleA.roleId;
    const memberRoleB = roleB.roleId;

    const before = await counts(setup);

    /* ══ ATTACK 1: an arbitrary authorization id cannot issue ════════════════ */
    {
      const r = await issueInvitation(
        rootA, { membershipAuthorizationId: "00000000-0000-4000-8000-000000000000" }, deps,
      );
      assert.equal(r.status === "refused" && r.reason, "authorization-unresolvable");
      assert.equal((await counts(setup)).invitations, 0);
    }

    /* ══ The legitimate authorization for the brand-new human ════════════════ */
    const authA = await authorize(rootA, NEWCOMER, memberRoleA, govDeps);

    /* ══ ATTACK 2: another tenant's authorization cannot be used ═════════════ */
    {
      const r = await issueInvitation(rootB, { membershipAuthorizationId: authA }, deps);
      assert.equal(
        r.status === "refused" && r.reason, "authorization-unresolvable",
        "a foreign authorization is indistinguishable from one that never existed",
      );
    }

    /* ══ ATTACK 3: an actor without Governance authority cannot issue ════════ */
    {
      const ordinaryUser = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('ordinary@acme.test','ordinary') returning id`,
      );
      const ordinaryIdentity = await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
         values ($1,'local','hebun-local','local:ordinary@acme.test','active',true,now()) returning id`,
        [ordinaryUser.rows[0]!.id],
      );
      const ownerRole = await setup.query<{ id: string }>(
        `insert into roles (tenant_id, name, type) values ($1,'Owner B','owner') returning id`,
        [A.tenantId],
      );
      const m = await setup.query<{ id: string }>(
        `insert into memberships (tenant_id,user_id,role_id,status) values ($1,$2,$3,'active') returning id`,
        [A.tenantId, ordinaryUser.rows[0]!.id, ownerRole.rows[0]!.id],
      );
      const seeded: Seeded = {
        tenantId: A.tenantId,
        userId: ordinaryUser.rows[0]!.id,
        authIdentityId: ordinaryIdentity.rows[0]!.id,
        membershipId: m.rows[0]!.id,
        roleId: ownerRole.rows[0]!.id,
      };
      const ctx = contextFor(seeded, await sessionRowFor(setup, seeded, "i2-own"), "i2-own");
      const r = await issueInvitation(ctx, { membershipAuthorizationId: authA }, deps);
      assert.equal(
        r.status === "refused" && r.reason, "not-the-governance-authority",
        "an owner-band role is not Governance authority",
      );
      assert.equal((await counts(setup)).invitations, 0, "a refused issuance mints nothing");
    }

    /* ══ ACT A: the legitimate issuance ══════════════════════════════════════ */
    const issued = await issueInvitation(rootA, { membershipAuthorizationId: authA }, deps);
    assert.equal(issued.status, "issued");
    if (issued.status !== "issued") throw new Error("unreachable");

    /* ── The capability is real, and only its digest is stored ─────────────── */
    {
      assert.ok(issued.capability.length >= 40, "the capability carries real entropy");
      const stored = await setup.query<{ token_hash: string; status: string; normalized_email: string; intended_role_id: string; tenant_id: string; inviter_id: string; send_count: number; last_sent_at: string | null }>(
        `select token_hash, status, normalized_email, intended_role_id, tenant_id, inviter_id,
                send_count, last_sent_at from invitations where id=$1`,
        [issued.invitationId],
      );
      const row = stored.rows[0]!;
      /* ══ ATTACK 6: plaintext capability never persists ══════════════════════ */
      assert.equal(row.token_hash.includes(issued.capability), false);
      assert.match(row.token_hash.trim(), /^[0-9a-f]{64}$/, "only a digest is stored");
      assert.equal(row.status, "pending");
      assert.equal(row.normalized_email, NEWCOMER, "the address came from the authorization");
      assert.equal(row.intended_role_id, memberRoleA, "the role came from the authorization");
      assert.equal(row.tenant_id, A.tenantId, "the tenant came from the authorization");
      assert.equal(row.inviter_id, A.userId, "the inviter came from the session");
      /* Nothing claims a delivery Hebun cannot perform. */
      assert.equal(Number(row.send_count), 0, "send_count must stay 0 — nothing was sent");
      assert.equal(row.last_sent_at, null, "last_sent_at must stay null — nothing was sent");
    }

    /* ══ CONSUMPTION HAPPENED AT ISSUANCE ═══════════════════════════════════ */
    {
      const auth = await setup.query<{ status: string; consumed_at: string | null; consumed_by_invitation_id: string | null }>(
        `select status, consumed_at, consumed_by_invitation_id from membership_authorizations where id=$1`,
        [authA],
      );
      assert.equal(auth.rows[0]!.status, "consumed");
      assert.ok(auth.rows[0]!.consumed_at !== null);
      assert.equal(auth.rows[0]!.consumed_by_invitation_id, issued.invitationId);
    }

    /* ══ ATTACK 4: an already-consumed authorization cannot issue again ══════ */
    {
      const r = await issueInvitation(rootA, { membershipAuthorizationId: authA }, deps);
      assert.equal(r.status === "refused" && r.reason, "authorization-not-live");
      const invitations = await setup.query(`select count(*) from invitations`);
      assert.equal(Number(invitations.rows[0]!.count), 1, "still exactly one invitation");
    }

    /* ══ ATTACK 7: the capability never enters audit ════════════════════════ */
    {
      const audit = await setup.query<{ action: string; metadata: Record<string, unknown>; actor_id: string }>(
        `select action, metadata, actor_id from audit_log where entity_id=$1`, [issued.invitationId],
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0]!.action, INVITATION_ISSUED_ACTION);
      assert.equal(audit.rows[0]!.actor_id, A.userId);
      const text = JSON.stringify(audit.rows[0]!);
      assert.equal(text.includes(issued.capability), false, "no plaintext capability in audit");
      assert.equal(text.includes(NEWCOMER), false, "the address is not duplicated into audit");
      assert.equal(
        (audit.rows[0]!.metadata as { delivered?: boolean }).delivered, false,
        "history states that nothing was delivered",
      );
    }

    /* ══ ATTACK 21: the capability ALONE cannot create a membership ═════════ */
    {
      const r = await acceptInvitation(
        { capability: issued.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.equal(
        r.status === "refused" && r.reason, "not-acceptable",
        "the invited human does not exist yet — the capability proves nothing about them",
      );
      const after = await counts(setup);
      assert.equal(after.memberships, before.memberships + 1, "only the ATTACK-3 fixture membership");
      assert.equal(after.users, before.users + 1, "only the ATTACK-3 fixture user");
    }

    /* ══ ATTACK 8: a wrong capability fails ════════════════════════════════ */
    {
      const r = await acceptInvitation(
        { capability: "not-a-real-capability", email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.equal(r.status === "refused" && r.reason, "capability-unrecognized");
    }

    /* ══ PATH A — I1.2 brings the brand-new human into existence ════════════ */
    const enrollStart = await startIdentityEnrollment({ capability: issued.capability }, deps);
    assert.equal(enrollStart.status, "started");
    if (enrollStart.status !== "started") throw new Error("unreachable");

    /* ══ ATTACK 26: a PENDING enrollment cannot reach acceptance ════════════ */
    {
      const r = await acceptInvitation(
        { capability: issued.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.equal(
        r.status === "refused" && r.reason, "not-acceptable",
        "a pending enrollment created no identity, so there is nobody to authenticate",
      );
    }

    const approved = await decideIdentityEnrollment(
      rootA, { enrollmentId: enrollStart.enrollmentId, decision: "approve", justification: REASON },
      govDeps,
    );
    assert.equal(approved.status, "approved");

    const enrolled = await completeIdentityEnrollment(
      {
        capability: issued.capability,
        continuationReference: enrollStart.continuationReference,
        password: NEWCOMER_PASSWORD,
      },
      deps,
    );
    assert.equal(enrolled.status, "completed");
    if (enrolled.status !== "completed") throw new Error("unreachable");

    /* I1.2 created identity + credential and NO membership — the I2 handoff state. */
    {
      const m = await setup.query(`select count(*) from memberships where user_id=$1`, [enrolled.userId]);
      assert.equal(Number(m.rows[0]!.count), 0, "I1.2 leaves membership to I2");
      const inv = await setup.query<{ status: string }>(
        `select status from invitations where id=$1`, [issued.invitationId],
      );
      assert.equal(inv.rows[0]!.status, "pending", "I1.2 does not accept the invitation");
    }

    /* ══ ATTACK 20/22: the WRONG authenticated human cannot steal it ════════ */
    {
      const r = await acceptInvitation(
        { capability: issued.capability, email: "root@acme.test", password: "a-correct-password-7Qx" },
        deps,
      );
      assert.equal(
        r.status === "refused" && r.reason, "not-acceptable",
        "a real human proving a real password is still not the invited human",
      );
      const m = await setup.query(`select count(*) from memberships where user_id=$1`, [A.userId]);
      assert.equal(Number(m.rows[0]!.count), 1, "the thief gained no second membership");
    }

    /* A wrong password for the RIGHT human is equally indistinguishable. */
    {
      const r = await acceptInvitation(
        { capability: issued.capability, email: NEWCOMER, password: "wrong-password-entirely" }, deps,
      );
      assert.equal(r.status === "refused" && r.reason, "not-acceptable");
    }

    /* ══ ACT B: the legitimate acceptance ═══════════════════════════════════ */
    const beforeAcceptance = await counts(setup);
    const accepted = await acceptInvitation(
      { capability: issued.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
    );
    assert.equal(accepted.status, "accepted");
    if (accepted.status !== "accepted") throw new Error("unreachable");

    /* ══ PROVENANCE AND ROLE/TENANT EXACTNESS ══════════════════════════════ */
    {
      assert.equal(accepted.tenantId, A.tenantId, "correct tenant");
      assert.equal(accepted.userId, enrolled.userId, "correct human");
      assert.equal(accepted.roleId, memberRoleA, "the EXACT intended member role");
      assert.equal(accepted.invitationId, issued.invitationId, "exact invitation provenance");
      assert.equal(accepted.membershipAuthorizationId, authA, "exact authorization provenance");

      const row = await setup.query<{ tenant_id: string; user_id: string; role_id: string; status: string; accepted_invitation_id: string; role_type: string }>(
        `select m.tenant_id, m.user_id, m.role_id, m.status, m.accepted_invitation_id, r.type as role_type
           from memberships m join roles r on r.id = m.role_id where m.id=$1`,
        [accepted.membershipId],
      );
      const m = row.rows[0]!;
      assert.equal(m.tenant_id, A.tenantId);
      assert.equal(m.user_id, enrolled.userId);
      assert.equal(m.role_id, memberRoleA);
      assert.equal(m.status, "active");
      assert.equal(m.accepted_invitation_id, issued.invitationId);
      /* ══ ATTACKS 12/13/14/15: never owner/director/operator/auditor ══════ */
      assert.equal(m.role_type, "member", "onboarding may only ever produce a member");

      const inv = await setup.query<{ status: string; accepted_by_user_id: string; accepted_at: string }>(
        `select status, accepted_by_user_id, accepted_at from invitations where id=$1`,
        [issued.invitationId],
      );
      assert.equal(inv.rows[0]!.status, "accepted");
      assert.equal(inv.rows[0]!.accepted_by_user_id, enrolled.userId);
      assert.ok(inv.rows[0]!.accepted_at !== null);
    }

    /* ══ ATTACKS 35-41: acceptance creates NOTHING else ════════════════════ */
    {
      const after = await counts(setup);
      assert.equal(after.users, beforeAcceptance.users, "no user created during acceptance");
      assert.equal(after.identities, beforeAcceptance.identities, "no auth identity created");
      assert.equal(after.credentials, beforeAcceptance.credentials, "no credential created");
      assert.equal(after.roles, beforeAcceptance.roles, "no role created or mutated");
      assert.equal(after.sessions, beforeAcceptance.sessions, "no session issued");
      assert.equal(after.decisions, beforeAcceptance.decisions, "no Governance decision recorded");
      assert.equal(after.knowledge, beforeAcceptance.knowledge, "no Knowledge row touched");
      assert.equal(after.executions, beforeAcceptance.executions, "no execution row touched");
      assert.equal(after.providers, beforeAcceptance.providers, "no provider row touched");
      assert.equal(after.memberships, beforeAcceptance.memberships + 1, "exactly one membership");

      const grants = await setup.query(
        `select count(*) from decision_records where actor_id=$1`, [enrolled.userId],
      );
      assert.equal(Number(grants.rows[0]!.count), 0, "the new member holds no Governance authority");
    }

    /* ══ Audit records the membership honestly ═════════════════════════════ */
    {
      const audit = await setup.query<{ action: string; actor_id: string; metadata: Record<string, unknown> }>(
        `select action, actor_id, metadata from audit_log where action=$1`, [MEMBERSHIP_CREATED_ACTION],
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0]!.actor_id, enrolled.userId, "the actor is the human who joined");
      const meta = audit.rows[0]!.metadata as Record<string, string>;
      assert.equal(meta.membershipId, accepted.membershipId);
      assert.equal(meta.membershipAuthorizationId, authA);
      assert.equal(meta.roleId, memberRoleA);
      const text = JSON.stringify(audit.rows[0]!);
      for (const secret of [issued.capability, NEWCOMER_PASSWORD]) {
        assert.equal(text.includes(secret), false, "no secret material in audit");
      }
    }

    /* ══ ATTACK 11: an accepted invitation cannot be reused ════════════════ */
    {
      const r = await acceptInvitation(
        { capability: issued.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.ok(
        ["capability-not-usable", "already-a-member"].includes(
          r.status === "refused" ? r.reason : "",
        ),
        "a spent invitation cannot produce a second membership",
      );
      const m = await setup.query(`select count(*) from memberships where user_id=$1`, [enrolled.userId]);
      assert.equal(Number(m.rows[0]!.count), 1, "still exactly one membership");
    }

    /* ══ PATH A COMPLETES: real tenant access through the UNCHANGED login ═══ */
    {
      const membership = await findPrimaryActiveMembership(handle.db, enrolled.userId);
      assert.ok(membership, "the production resolver finds the new membership");
      assert.equal(membership!.tenantId, A.tenantId);
      assert.equal(membership!.roleId, memberRoleA);

      const env = {
        status: "configured",
        enabled: true,
        provider: "local",
        controlPlaneDatabaseUrl: harness.dbUrl,
        sessionDigestCurrentKey: KEY,
      } as ConfiguredAuthenticationEnvironment;
      const session = await issueLocalSession(
        handle.db, env,
        { email: NEWCOMER, password: NEWCOMER_PASSWORD, requestId: "i2-login" },
        NOW,
      );
      assert.equal(session.diagnostic, "ok", "the newly onboarded human can sign in");
      assert.equal(session.result.status, "authorized");
      if (session.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(session.result.tenantContext.tenantId, A.tenantId, "and lands in the right tenant");
      assert.equal(session.result.tenantContext.roleId, memberRoleA);
      assert.equal(session.result.tenantContext.userId, enrolled.userId);

      const reach = await describeTenantReachability(handle.db, enrolled.userId, A.tenantId);
      assert.equal(reach.memberships, 1);
      assert.equal(reach.reachable, true);
      assert.equal(reach.reason, "only-membership");
    }

    /* ══ PATH B — an EXISTING verified human joins a SECOND tenant ══════════ */
    const authB = await authorize(rootB, NEWCOMER, memberRoleB, govDeps);
    const issuedB = await issueInvitation(rootB, { membershipAuthorizationId: authB }, deps);
    assert.equal(issuedB.status, "issued");
    if (issuedB.status !== "issued") throw new Error("unreachable");

    const beforeB = await counts(setup);
    const acceptedB = await acceptInvitation(
      { capability: issuedB.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
    );
    assert.equal(acceptedB.status, "accepted");
    if (acceptedB.status !== "accepted") throw new Error("unreachable");

    /* ══ ATTACK 28/36/37: the existing human path creates NO second identity ═ */
    {
      const after = await counts(setup);
      assert.equal(after.users, beforeB.users, "no second user for an existing human");
      assert.equal(after.identities, beforeB.identities, "no second auth identity");
      assert.equal(after.credentials, beforeB.credentials, "no second credential");
      assert.equal(after.enrollments, beforeB.enrollments, "no enrollment ceremony was needed");
      assert.equal(after.memberships, beforeB.memberships + 1, "exactly one new membership");

      assert.equal(acceptedB.userId, enrolled.userId, "the SAME human, not a copy");
      assert.equal(acceptedB.tenantId, B.tenantId);
      assert.equal(acceptedB.roleId, memberRoleB, "tenant B's own member role");
    }

    /* ══ ATTACKS 23/24: no cross-tenant substitution ═══════════════════════ */
    {
      const rows = await setup.query<{ tenant_id: string; role_id: string }>(
        `select tenant_id, role_id from memberships where user_id=$1 order by created_at`,
        [enrolled.userId],
      );
      assert.equal(rows.rows.length, 2);
      const byTenant = new Map(rows.rows.map((r) => [r.tenant_id, r.role_id]));
      assert.equal(byTenant.get(A.tenantId), memberRoleA, "tenant A membership uses tenant A's role");
      assert.equal(byTenant.get(B.tenantId), memberRoleB, "tenant B membership uses tenant B's role");
      assert.notEqual(memberRoleA, memberRoleB);
    }

    /* ══ THE SECOND MEMBERSHIP IS REACHABLE — Tenant Selection resolved this ═
     *
     * This block asserted the opposite when I2 closed: sign-in resolved the OLDEST membership and
     * the second tenant was unreachable. Tenant Selection Authority made sign-in ASK instead of
     * guess, so the fixture was updated to the new truth rather than the invariant relaxed to keep
     * the old assertion alive.
     */
    {
      const reach = await describeTenantReachability(handle.db, enrolled.userId, B.tenantId);
      assert.equal(reach.memberships, 2);
      assert.equal(
        reach.reachable, false,
        "tenant B is still not what an UNQUALIFIED sign-in resolves — that is all this now means",
      );
      assert.equal(reach.reason, "not-the-oldest-membership");

      const membership = await findPrimaryActiveMembership(handle.db, enrolled.userId);
      assert.equal(
        membership!.tenantId, A.tenantId,
        "findPrimaryActiveMembership still returns the oldest — unchanged by tenant selection",
      );

      const env = {
        status: "configured", enabled: true, provider: "local",
        controlPlaneDatabaseUrl: harness.dbUrl, sessionDigestCurrentKey: KEY,
      } as ConfiguredAuthenticationEnvironment;
      const session = await issueLocalSession(
        handle.db, env,
        { email: NEWCOMER, password: NEWCOMER_PASSWORD, requestId: "i2-login-2" }, NOW,
      );
      /* Two memberships, so sign-in no longer guesses. */
      assert.equal(
        session.result.status, "tenant-selection-required",
        "a human with two memberships is asked which workspace to enter",
      );
      if (session.result.status !== "tenant-selection-required") throw new Error("unreachable");
      assert.deepEqual(
        [...session.result.eligibleTenantIds].sort(),
        [A.tenantId, B.tenantId].sort(),
        "and BOTH tenants are offered — including the one I2 just created a membership in",
      );

      /* And choosing tenant B actually works: the I2 limitation is gone. */
      const chosen = await selectTenantForSession(
        handle.db, env, session.reference,
        { membershipId: acceptedB.membershipId, requestId: "i2-select-b" }, NOW,
      );
      assert.equal(chosen.status, "selected");
      if (chosen.status !== "selected") throw new Error("unreachable");
      assert.equal(chosen.result.status, "authorized");
      if (chosen.result.status !== "authorized") throw new Error("unreachable");
      assert.equal(
        chosen.result.tenantContext.tenantId, B.tenantId,
        "the human CAN now enter the tenant I2 admitted them to",
      );
      assert.equal(chosen.result.tenantContext.roleId, memberRoleB);
    }

    /* ══ ATTACK 9: an EXPIRED invitation cannot be accepted ════════════════ */
    {
      const auth = await authorize(rootA, "expired@acme.test", memberRoleA, govDeps);
      const inv = await issueInvitation(rootA, { membershipAuthorizationId: auth }, deps);
      assert.equal(inv.status, "issued");
      if (inv.status !== "issued") throw new Error("unreachable");
      await setup.query(
        `update invitations set issued_at = $2::timestamptz - interval '2 hours',
                                expires_at = $2::timestamptz - interval '1 hour' where id=$1`,
        [inv.invitationId, NOW.toISOString()],
      );
      const r = await acceptInvitation(
        { capability: inv.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.equal(r.status === "refused" && r.reason, "capability-not-usable");
    }

    /* ══ ATTACK 10: a REVOKED invitation cannot be accepted ════════════════ */
    {
      const auth = await authorize(rootA, "revoked@acme.test", memberRoleA, govDeps);
      const inv = await issueInvitation(rootA, { membershipAuthorizationId: auth }, deps);
      assert.equal(inv.status, "issued");
      if (inv.status !== "issued") throw new Error("unreachable");
      await setup.query(
        `update invitations set status='revoked', revoked_at=now(),
                                revocation_reason='withdrawn by the authority' where id=$1`,
        [inv.invitationId],
      );
      const r = await acceptInvitation(
        { capability: inv.capability, email: NEWCOMER, password: NEWCOMER_PASSWORD }, deps,
      );
      assert.equal(r.status === "refused" && r.reason, "capability-not-usable");
    }

    /* ══ ATTACKS 16-19: forged authority-bearing values have nowhere to go ══ */
    {
      /*
       * Structural rather than behavioural: the input shapes carry no tenantId, roleId, userId,
       * authIdentityId, actorId or status field. The boundaries test asserts that against the
       * source; here we prove the runtime consequence — every authority-bearing value on the two
       * durable rows came from the authorization or the verified credential.
       */
      const row = await setup.query<{ tenant_id: string; role_id: string; user_id: string }>(
        `select tenant_id, role_id, user_id from memberships where id=$1`, [accepted.membershipId],
      );
      assert.equal(row.rows[0]!.tenant_id, A.tenantId);
      assert.equal(row.rows[0]!.role_id, memberRoleA);
      assert.equal(row.rows[0]!.user_id, enrolled.userId);
    }

    /* ══ ATTACK 45: the normal authorized session invariant is unchanged ════ */
    {
      const env = {
        status: "configured", enabled: true, provider: "local",
        controlPlaneDatabaseUrl: harness.dbUrl, sessionDigestCurrentKey: KEY,
      } as ConfiguredAuthenticationEnvironment;
      /* A human with an identity and a credential but NO membership still cannot get a session. */
      const orphanUser = await setup.query<{ id: string }>(
        `insert into users (email, name) values ('orphan@acme.test','orphan') returning id`,
      );
      const orphanIdentity = await setup.query<{ id: string }>(
        `insert into auth_identities (user_id, provider, issuer, subject, status, is_primary, verified_at)
         values ($1,'local','hebun-local','local:orphan@acme.test','active',true,now()) returning id`,
        [orphanUser.rows[0]!.id],
      );
      const { hashPassword } = await import("../../src/features/auth-runtime/password-hash.server");
      const hashed = await hashPassword("orphan-password-1234");
      await setup.query(
        `insert into auth_credentials (auth_identity_id, credential_type, algorithm, params, salt, secret_hash, status)
         values ($1,'password',$2,$3::jsonb,$4,$5,'active')`,
        [orphanIdentity.rows[0]!.id, hashed.algorithm, JSON.stringify(hashed.params), hashed.salt, hashed.secretHash],
      );
      const session = await issueLocalSession(
        handle.db, env,
        { email: "orphan@acme.test", password: "orphan-password-1234", requestId: "i2-orphan" }, NOW,
      );
      assert.equal(session.diagnostic, "no-membership");
      /*
       * The SHAPE of this refusal changed when Tenant Selection Authority landed: a verified human
       * with no membership now gets the `onboarding-required` state the contract always declared,
       * instead of a bare `forbidden`. What has NOT changed, and is what this case exists to prove,
       * is that they do not get `authorized` and cannot reach a tenant.
       */
      assert.equal(session.result.status, "onboarding-required");
      assert.notEqual(
        session.result.status, "authorized",
        "membership is still required for a normal tenant session — that invariant is untouched",
      );
      const resolved = await resolveSessionFromReference(
        handle.db, env, session.reference, { requestId: "i2-orphan-r" }, NOW,
      );
      assert.notEqual(resolved.status, "authorized", "and its receipt reaches no tenant either");
    }

    console.log("PASS i2 onboarding (postgres)");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
