/*
 * RUNG 2 PREREQUISITE — TENANT MACHINE-EXECUTION AUTHORITY against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A human holding a tenant's Governance authority can durably enrol that organization into
 *    machine execution for one frozen capability, and withdraw it as a NEW revision leaving the
 *    predecessor byte-identical. A tenant OWNER without Governance cannot. An agent cannot — the
 *    database refuses it. One tenant's enrolment never satisfies another. And enrolment authorizes
 *    no act: no permit, request, decision-about-an-act or work row is created by it."
 *
 * Every row is produced by the released writer that owns it. Uses a disposable local database.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  authorizeTenantMachineExecution,
  withdrawTenantMachineExecution,
} from "../../src/features/tenant-machine-execution-authority/authorize-tenant-machine-execution.server";
import { readEffectiveTenantMachineExecution } from "../../src/features/tenant-machine-execution-authority/read-tenant-machine-execution.server";
import { resolveMachineExecutionReachability } from "../../src/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server";
import {
  TENANT_MACHINE_EXECUTION_AUTHORIZED_OUTCOME,
  TENANT_MACHINE_EXECUTION_DOMAIN,
  TENANT_MACHINE_EXECUTION_SUBJECT_TYPE,
  TENANT_MACHINE_EXECUTION_WITHDRAWN_OUTCOME,
} from "../../src/features/tenant-machine-execution-authority/contracts";
import { RECORD_WORK_ACTION_KIND } from "../../src/features/heby-action-inlet/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const CAP = RECORD_WORK_ACTION_KIND;
const JUSTIFICATION =
  "This organization agrees that work it has already authorized may be delivered by machine, and I accept responsibility for that.";
const WITHDRAWAL =
  "We are pausing machine delivery of authorized work while we review how it is supervised.";

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
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId,
    authenticatedAt: new Date().toISOString(),
  });
}

async function count(client: Client, table: string): Promise<number> {
  const row = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.rows[0]!.n;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_rung2_tenant");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED, AND CARRIES NO SCHEDULE AND NO SUBJECT.
     * ═════════════════════════════════════════════════════════════════════ */
    const columns = (
      await setup.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'tenant_machine_execution_authorizations' order by column_name`,
      )
    ).rows.map((r) => r.column_name);
    assert.ok(columns.length > 0, "the tenant machine-execution table exists");
    for (const required of [
      "tenant_id",
      "capability_key",
      "state",
      "authorization_revision",
      "governance_decision_id",
      "governance_session_id",
      "authorized_by_actor_type",
      "authorized_by_actor_id",
      "supersedes_authorization_id",
    ]) {
      assert.ok(columns.includes(required), `it carries ${required}`);
    }
    /* The observation sibling's fields are ABSENT, not nulled — see the schema header. */
    for (const absent of ["interval_minutes", "subject_ref", "subject_kind", "integration_id", "provider_key"]) {
      assert.ok(!columns.includes(absent), `it does NOT carry ${absent} — no cadence, no subject`);
    }

    /* THE ROOT CONTROL WAS NOT TOUCHED BY THIS MIGRATION. */
    const rootColumns = (
      await setup.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'provider_connectivity_controls'`,
      )
    ).rows.map((r) => r.column_name);
    assert.ok(!rootColumns.includes("tenant_id"), "the root control gained no tenant dimension");

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH A GOVERNANCE AUTHORITY.
     * ═════════════════════════════════════════════════════════════════════ */
    const trh = await seedLocalIdentity(setup, {
      companyName: "Turkish Rug House",
      companySlug: "turkish-rug-house-rung2",
      email: "director@trh.test",
      roleType: "owner",
    });
    const other = await seedLocalIdentity(setup, {
      companyName: "Another Organization",
      companySlug: "another-org-rung2",
      email: "director@other.test",
      roleType: "owner",
    });

    const trhTenant = contextFor(trh, await sessionRowFor(setup, trh, "aaaa1"), "rung2-trh");
    const otherTenant = contextFor(other, await sessionRowFor(setup, other, "bbbb2"), "rung2-other");

    for (const [seeded, tenant, who] of [
      [trh, trhTenant, "TRH"],
      [other, otherTenant, "the other organization"],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, tenant.sessionContextId],
      );
      const bootstrap = await establishGovernanceAuthority(
        tenant,
        { justification: `Establishing ${who}'s Governance authority for this test fixture.` },
        baseDeps,
      );
      assert.equal(bootstrap.status, "established", `${who} has a Governance authority`);
    }

    const before = {
      permits: await count(setup, "action_permits"),
      requests: await count(setup, "heby_action_requests"),
      work: await count(setup, "work_items"),
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. NOBODY IS ENROLLED, AND THAT IS "ABSENT" — NOT "WITHDRAWN".
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(
      (await readEffectiveTenantMachineExecution(trh.tenantId, CAP, baseDeps)).status,
      "absent",
      "a fresh deployment holds NO enrolment for this tenant",
    );
    const beforeGrant = await resolveMachineExecutionReachability(trh.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => true,
    });
    assert.equal(
      beforeGrant.status === "refused" && beforeGrant.reason,
      "tenant-not-authorized",
      "root armed is NOT enough — an unenrolled tenant is refused",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. AN UNSUPPORTED CAPABILITY CANNOT BE ENROLLED AT ALL.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const capability of ["send-external-communication", "place-human", "", "record_work"]) {
      const refused = await authorizeTenantMachineExecution(
        trhTenant,
        { capabilityKey: capability, justification: JUSTIFICATION, observedRevision: null },
        baseDeps,
      );
      assert.equal(
        refused.status === "refused" && refused.reason,
        "unsupported-machine-capability",
        `"${capability}" is outside the frozen set and cannot be enrolled`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. GOVERNANCE ENROLS THE TENANT.
     * ═════════════════════════════════════════════════════════════════════ */
    const authorized = await authorizeTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: JUSTIFICATION, observedRevision: null },
      baseDeps,
    );
    assert.equal(authorized.status, "written", "the Governance authority enrolled the tenant");
    assert.equal(authorized.status === "written" && authorized.authorizationRevision, 1);
    assert.equal(authorized.status === "written" && authorized.state, "active");

    const row = (
      await setup.query<{
        tenant_id: string;
        capability_key: string;
        state: string;
        authorized_by_actor_type: string;
        authorized_by_actor_id: string;
        supersedes_authorization_id: string | null;
      }>(
        `select tenant_id, capability_key, state, authorized_by_actor_type, authorized_by_actor_id,
                supersedes_authorization_id
           from tenant_machine_execution_authorizations where authorization_revision = 1`,
      )
    ).rows[0]!;
    assert.equal(row.tenant_id, trh.tenantId, "owned by the authenticated tenant");
    assert.equal(row.capability_key, CAP);
    assert.equal(row.state, "active");
    assert.equal(row.authorized_by_actor_type, "human", "a NAMED human, never possession");
    assert.equal(row.authorized_by_actor_id, trh.userId);
    assert.equal(row.supersedes_authorization_id, null, "revision 1 supersedes nothing");

    /* The Governance decision is filed in its OWN domain with its OWN outcome. */
    const decision = (
      await setup.query<{ governance_domain: string; outcome: string; subject_type: string; actor_type: string }>(
        /* The DOMAIN lives on the session; the OUTCOME on the decision. Both are asserted. */
        `select s.governance_domain, d.outcome, d.subject_type, d.actor_type
           from decision_records d join governance_sessions s on s.id = d.session_id
          where d.id = $1`,
        [authorized.status === "written" ? authorized.governanceDecisionId : ""],
      )
    ).rows[0]!;
    assert.equal(decision.governance_domain, TENANT_MACHINE_EXECUTION_DOMAIN);
    assert.equal(decision.outcome, TENANT_MACHINE_EXECUTION_AUTHORIZED_OUTCOME);
    assert.equal(decision.subject_type, TENANT_MACHINE_EXECUTION_SUBJECT_TYPE);
    assert.equal(decision.actor_type, "human");
    assert.notEqual(decision.outcome, "membership-authorized", "never filed as a person joining");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. ENROLMENT AUTHORIZED NO ACT. This is the assertion the design rests on.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await count(setup, "action_permits"), before.permits, "no permit was minted");
    assert.equal(await count(setup, "heby_action_requests"), before.requests, "no request was created");
    assert.equal(await count(setup, "work_items"), before.work, "no work was recorded");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. COMPOSITION: TENANT ENROLLED IS STILL NOT ENOUGH.
     * ═════════════════════════════════════════════════════════════════════ */
    const rootOff = await resolveMachineExecutionReachability(trh.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => false,
    });
    assert.equal(
      rootOff.status === "refused" && rootOff.reason,
      "root-control-disabled",
      "an enrolled tenant is still refused while the operator's stop is on",
    );
    const bothOn = await resolveMachineExecutionReachability(trh.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => true,
    });
    assert.equal(bothOn.status, "reachable", "both authorities agreeing is what makes it reachable");

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. ONE TENANT'S ENROLMENT NEVER SATISFIES ANOTHER.
     * ═════════════════════════════════════════════════════════════════════ */
    const crossTenant = await resolveMachineExecutionReachability(other.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => true,
    });
    assert.equal(
      crossTenant.status === "refused" && crossTenant.reason,
      "tenant-not-authorized",
      "TRH's enrolment does not enrol anybody else",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. A TENANT OWNER WITHOUT GOVERNANCE CANNOT ENROL.
     * ═════════════════════════════════════════════════════════════════════ */
    const stranger = await seedLocalIdentity(setup, {
      companyName: "Third Organization",
      companySlug: "third-org-rung2",
      email: "owner@third.test",
      roleType: "owner",
    });
    const strangerTenant = contextFor(
      stranger,
      await sessionRowFor(setup, stranger, "cccc3"),
      "rung2-stranger",
    );
    const noGovernance = await authorizeTenantMachineExecution(
      strangerTenant,
      { capabilityKey: CAP, justification: JUSTIFICATION, observedRevision: null },
      baseDeps,
    );
    assert.equal(
      noGovernance.status === "refused" && noGovernance.reason,
      "no-governance-authority",
      "an OWNER without a Governance authority is refused exactly like a stranger",
    );

    /* And an unauthenticated caller has no representation at all. */
    assert.equal(
      (
        await authorizeTenantMachineExecution(
          null,
          { capabilityKey: CAP, justification: JUSTIFICATION, observedRevision: null },
          baseDeps,
        )
      ).status === "refused" && true,
      true,
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. AN AGENT CANNOT ENROL ITS OWN ORGANIZATION — POSTGRES REFUSES IT.
     * ═════════════════════════════════════════════════════════════════════ */
    let agentRefused = false;
    try {
      await setup.query(
        `insert into tenant_machine_execution_authorizations
           (tenant_id, authorization_revision, state, capability_key, governance_decision_id,
            governance_session_id, authorized_by_actor_type, authorized_by_actor_id, authorized_at)
         select $1, 99, 'active', $2, governance_decision_id, governance_session_id,
                'agent', $3, now()
           from tenant_machine_execution_authorizations limit 1`,
        [trh.tenantId, CAP, trh.userId],
      );
    } catch {
      agentRefused = true;
    }
    assert.ok(agentRefused, "the human-authorizer CHECK is enforced by the database itself");

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. RE-ENROLLING AN ENROLLED TENANT IS REFUSED, NOT RECORDED.
     * ═════════════════════════════════════════════════════════════════════ */
    const again = await authorizeTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: JUSTIFICATION, observedRevision: 1 },
      baseDeps,
    );
    assert.equal(
      again.status === "refused" && again.reason,
      "already-authorized",
      "a second decision that changes nothing is refused",
    );

    /* A human who was shown a stale revision is refused too. */
    const stale = await withdrawTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: WITHDRAWAL, observedRevision: null },
      baseDeps,
    );
    assert.equal(
      stale.status === "refused" && stale.reason,
      "stale-authorization-revision",
      "deciding against a revision that moved underneath you is refused",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. WITHDRAWAL IS A NEW REVISION; THE PREDECESSOR IS BYTE-IDENTICAL.
     * ═════════════════════════════════════════════════════════════════════ */
    const firstBefore = (
      await setup.query(`select * from tenant_machine_execution_authorizations where authorization_revision = 1`)
    ).rows[0]!;

    const withdrawn = await withdrawTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: WITHDRAWAL, observedRevision: 1 },
      baseDeps,
    );
    assert.equal(withdrawn.status, "written");
    assert.equal(withdrawn.status === "written" && withdrawn.authorizationRevision, 2);
    assert.equal(withdrawn.status === "written" && withdrawn.state, "withdrawn");

    const firstAfter = (
      await setup.query(`select * from tenant_machine_execution_authorizations where authorization_revision = 1`)
    ).rows[0]!;
    assert.deepEqual(firstAfter, firstBefore, "the revision it replaced was not edited at all");

    const withdrawDecision = (
      await setup.query<{ governance_domain: string; outcome: string }>(
        `select s.governance_domain, d.outcome
           from decision_records d join governance_sessions s on s.id = d.session_id
          where d.id = $1`,
        [withdrawn.status === "written" ? withdrawn.governanceDecisionId : ""],
      )
    ).rows[0]!;
    assert.equal(withdrawDecision.governance_domain, TENANT_MACHINE_EXECUTION_DOMAIN);
    assert.equal(withdrawDecision.outcome, TENANT_MACHINE_EXECUTION_WITHDRAWN_OUTCOME);
    assert.notEqual(
      withdrawDecision.outcome,
      "authority-revoked",
      "withdrawing delivery takes nobody's Governance authority away",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. AFTER WITHDRAWAL: REFUSED, AND SAID SO SPECIFICALLY.
     * ═════════════════════════════════════════════════════════════════════ */
    const afterWithdrawal = await resolveMachineExecutionReachability(trh.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => true,
    });
    assert.equal(
      afterWithdrawal.status === "refused" && afterWithdrawal.reason,
      "tenant-authorization-withdrawn",
      "a withdrawn tenant is refused even with the root control armed",
    );
    /* And with the root ALSO off, the tenant's own fact still wins. */
    const bothOff = await resolveMachineExecutionReachability(trh.tenantId, CAP, {
      ...baseDeps,
      rootEnabled: async () => false,
    });
    assert.equal(
      bothOff.status === "refused" && bothOff.reason,
      "tenant-authorization-withdrawn",
      "an operator stop must never disguise a withdrawal",
    );

    /* Withdrawing twice is refused; the history stays inspectable. */
    const twice = await withdrawTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: WITHDRAWAL, observedRevision: 2 },
      baseDeps,
    );
    assert.equal(twice.status === "refused" && twice.reason, "no-active-authorization");
    assert.equal(
      await count(setup, "tenant_machine_execution_authorizations"),
      2,
      "two revisions, both preserved — nothing was deleted",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 13. RE-ENROLLING AFTER A WITHDRAWAL IS A THIRD REVISION.
     * ═════════════════════════════════════════════════════════════════════ */
    const reAuthorized = await authorizeTenantMachineExecution(
      trhTenant,
      { capabilityKey: CAP, justification: JUSTIFICATION, observedRevision: 2 },
      baseDeps,
    );
    assert.equal(reAuthorized.status, "written");
    assert.equal(reAuthorized.status === "written" && reAuthorized.authorizationRevision, 3);
    assert.equal(
      (await readEffectiveTenantMachineExecution(trh.tenantId, CAP, baseDeps)).status,
      "read",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 14. AND STILL: NO ACT WAS EVER AUTHORIZED BY ANY OF IT.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await count(setup, "action_permits"), before.permits);
    assert.equal(await count(setup, "heby_action_requests"), before.requests);
    assert.equal(await count(setup, "work_items"), before.work);

    console.log("RUNG 2 tenant containment (postgres): PASS");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose?.().catch?.(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
