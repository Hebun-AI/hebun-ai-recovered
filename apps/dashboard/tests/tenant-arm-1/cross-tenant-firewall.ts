/*
 * TENANT-ARM-1 — PER-TENANT EXTERNAL-SEND CONTAINMENT against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Arming tenant A to send outside does NOT arm tenant B. B stays fail-closed while it holds no
 *    arming of its own. Disarming A does not touch B. The legacy GLOBAL control being ON cannot
 *    authorize any tenant by itself. An agent cannot arm an organization — the database refuses it.
 *    And arming authorizes no send: no permit, request, recipient or attempt is created by it."
 *
 * This is the invariant the phase exists for, so it is proven against real rows rather than fakes.
 * Uses a disposable local database, dropped on exit. Canonical is never opened. No provider, no
 * network, no paid call.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  armTenantExternalSend,
  disarmTenantExternalSend,
} from "../../src/features/tenant-external-send-authority/authorize-tenant-external-send.server";
import { readEffectiveTenantExternalSend } from "../../src/features/tenant-external-send-authority/read-tenant-external-send.server";
import { resolveExternalSendReachability } from "../../src/features/tenant-external-send-authority/resolve-external-send-reachability.server";
import {
  TENANT_EXTERNAL_SEND_ARMED_OUTCOME,
  TENANT_EXTERNAL_SEND_DISARMED_OUTCOME,
  TENANT_EXTERNAL_SEND_DOMAIN,
  TENANT_EXTERNAL_SEND_SUBJECT_TYPE,
} from "../../src/features/tenant-external-send-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const ARM_JUSTIFICATION =
  "This organization accepts that sends it has already authorized may leave the building, and I accept responsibility for that.";
const DISARM_JUSTIFICATION =
  "We are withdrawing this organization's ability to send outside while we review how it is supervised.";

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
  const harness = createDisposablePostgresHarness("hebun_tenant_arm_1");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };
  /* The ROOT half, injected. The deployment switch is ON for the whole file unless said otherwise,
   * precisely so every refusal below is proven to come from the TENANT half and nothing else. */
  const rootOn = { ...baseDeps, rootEnabled: async () => true };
  const rootOff = { ...baseDeps, rootEnabled: async () => false };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE MIGRATION IS APPLIED, AND THE ROOT CONTROL WAS NOT TOUCHED.
     * ═════════════════════════════════════════════════════════════════════ */
    const columns = (
      await setup.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'tenant_external_send_authorizations' order by column_name`,
      )
    ).rows.map((r) => r.column_name);
    assert.ok(columns.length > 0, "the tenant external-send arming table exists");
    for (const required of [
      "tenant_id",
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
    /* No cadence, no subject, no capability that can only hold one value. See the schema header. */
    for (const absent of ["interval_minutes", "subject_ref", "subject_kind", "capability_key", "provider_key"]) {
      assert.ok(!columns.includes(absent), `it does NOT carry ${absent}`);
    }

    const rootColumns = (
      await setup.query<{ column_name: string }>(
        `select column_name from information_schema.columns
          where table_name = 'provider_connectivity_controls'`,
      )
    ).rows.map((r) => r.column_name);
    assert.ok(!rootColumns.includes("tenant_id"), "the root control gained NO tenant dimension");

    /* THE CONTAINMENT, AS A DATABASE FACT: arming uniqueness is keyed by tenant. */
    const lineageIndex = (
      await setup.query<{ indexdef: string }>(
        `select indexdef from pg_indexes
          where tablename = 'tenant_external_send_authorizations'
            and indexname = 'tenant_external_send_authorizations_lineage_revision_uq'`,
      )
    ).rows[0];
    assert.ok(lineageIndex, "the arming lineage index exists");
    assert.ok(
      lineageIndex!.indexdef.includes("tenant_id"),
      "arming uniqueness is keyed by tenant_id — one tenant's row cannot be another's",
    );

    /* THE LEGACY GLOBAL ROW'S UNIQUENESS IS UNCHANGED — still provider_key alone. */
    const rootIndex = (
      await setup.query<{ indexdef: string }>(
        `select indexdef from pg_indexes
          where tablename = 'provider_connectivity_controls'
            and indexname = 'provider_connectivity_controls_provider_key_uq'`,
      )
    ).rows[0];
    assert.ok(rootIndex, "the root control's unique index survives");
    assert.ok(
      !rootIndex!.indexdef.includes("tenant_id"),
      "the root control's identity was NOT re-keyed by this phase",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH ITS OWN GOVERNANCE AUTHORITY.
     * ═════════════════════════════════════════════════════════════════════ */
    const a = await seedLocalIdentity(setup, {
      companyName: "Tenant A",
      companySlug: "tenant-a-arm1",
      email: "director@a.test",
      roleType: "owner",
    });
    const b = await seedLocalIdentity(setup, {
      companyName: "Tenant B",
      companySlug: "tenant-b-arm1",
      email: "director@b.test",
      roleType: "owner",
    });

    const aTenant = contextFor(a, await sessionRowFor(setup, a, "aaaa1"), "arm1-a");
    const bTenant = contextFor(b, await sessionRowFor(setup, b, "bbbb2"), "arm1-b");

    for (const [seeded, tenant, who] of [
      [a, aTenant, "Tenant A"],
      [b, bTenant, "Tenant B"],
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
      recipients: await count(setup, "external_recipients"),
      attempts: await count(setup, "action_execution_attempts"),
    };

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. INVARIANT 4 + 5 · A GLOBAL/LEGACY "ON" CANNOT AUTHORIZE ANY TENANT.
     *
     * The root half is forced ON for both tenants and BOTH are still refused, because neither
     * holds an arming of its own. This is exactly the production migration's starting state: the
     * legacy global row may say `true`, and the new table is empty.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const [tenantId, who] of [
      [a.tenantId, "Tenant A"],
      [b.tenantId, "Tenant B"],
    ] as const) {
      assert.equal(
        (await readEffectiveTenantExternalSend(tenantId, baseDeps)).status,
        "absent",
        `${who} holds NO arming on a freshly migrated deployment`,
      );
      const refused = await resolveExternalSendReachability(tenantId, rootOn);
      assert.equal(
        refused.status === "refused" && refused.reason,
        "tenant-not-armed",
        `root ON is NOT enough — ${who} is refused`,
      );
    }

    /* INVARIANT 5 · NO TENANT CONTEXT AT ALL REFUSES CONSEQUENTIAL EXECUTION. */
    for (const missing of ["", "   ", "not-a-uuid", "00000000-0000-0000-0000-00000000000"]) {
      const refused = await resolveExternalSendReachability(missing, rootOn);
      assert.equal(
        refused.status === "refused" && refused.reason,
        "tenant-not-armed",
        `a missing/malformed tenant context ("${missing}") refuses, and never widens`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. INVARIANT 1 · ARMING A DOES NOT ARM B.
     * ═════════════════════════════════════════════════════════════════════ */
    const armedA = await armTenantExternalSend(
      aTenant,
      { justification: ARM_JUSTIFICATION, observedRevision: null },
      baseDeps,
    );
    assert.equal(armedA.status, "written", "Tenant A's Governance armed it");
    assert.equal(armedA.status === "written" && armedA.authorizationRevision, 1);
    assert.equal(armedA.status === "written" && armedA.state, "active");

    const aReach = await resolveExternalSendReachability(a.tenantId, rootOn);
    assert.equal(aReach.status, "reachable", "Tenant A is now reachable");

    /* ── THE WHOLE PHASE, IN ONE ASSERTION ────────────────────────────────── */
    const bReach = await resolveExternalSendReachability(b.tenantId, rootOn);
    assert.equal(
      bReach.status === "refused" && bReach.reason,
      "tenant-not-armed",
      "INVARIANT 1/2: arming Tenant A did NOT arm Tenant B, and B stays fail-closed",
    );
    assert.equal(
      (await readEffectiveTenantExternalSend(b.tenantId, baseDeps)).status,
      "absent",
      "Tenant B still holds no row at all — A's write went nowhere near it",
    );

    const rowsAfterA = (
      await setup.query<{ tenant_id: string }>(
        `select tenant_id from tenant_external_send_authorizations`,
      )
    ).rows;
    assert.equal(rowsAfterA.length, 1, "exactly ONE arming row exists");
    assert.equal(rowsAfterA[0]!.tenant_id, a.tenantId, "and it belongs to Tenant A");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. INVARIANT 6 · A CLIENT-SUPPLIED TENANT CANNOT WIDEN AUTHORITY.
     *
     * The writer has NO tenant input field — this is the structural proof. B's own authenticated
     * context, carrying an extra `tenantId` that names A, arms B and never A.
     * ═════════════════════════════════════════════════════════════════════ */
    const hostile = { justification: ARM_JUSTIFICATION, observedRevision: null, tenantId: a.tenantId } as unknown as {
      justification: string;
      observedRevision: number | null;
    };
    const armedB = await armTenantExternalSend(bTenant, hostile, baseDeps);
    assert.equal(armedB.status, "written", "B's own Governance armed B");
    const bRow = await readEffectiveTenantExternalSend(b.tenantId, baseDeps);
    assert.equal(bRow.status, "read", "the row landed on B");
    assert.equal(
      bRow.status === "read" && bRow.effective.tenantId,
      b.tenantId,
      "INVARIANT 6: the supplied tenantId was ignored — the session's tenant decided",
    );
    assert.equal(
      (
        await setup.query<{ n: number }>(
          `select count(*)::int as n from tenant_external_send_authorizations where tenant_id = $1`,
          [a.tenantId],
        )
      ).rows[0]!.n,
      1,
      "Tenant A still holds exactly its own one revision — nothing was added to it",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. INVARIANT 3 · DISARMING A DOES NOT MUTATE B.
     * ═════════════════════════════════════════════════════════════════════ */
    const aRevisionBefore = (
      await setup.query<{ id: string; state: string; authorization_revision: number }>(
        `select id, state, authorization_revision from tenant_external_send_authorizations
          where tenant_id = $1 order by authorization_revision desc limit 1`,
        [a.tenantId],
      )
    ).rows[0]!;
    const bRevisionBefore = (
      await setup.query<{ id: string; state: string; authorization_revision: number; updated_at: Date }>(
        `select id, state, authorization_revision, updated_at from tenant_external_send_authorizations
          where tenant_id = $1 order by authorization_revision desc limit 1`,
        [b.tenantId],
      )
    ).rows[0]!;

    const disarmedA = await disarmTenantExternalSend(
      aTenant,
      { justification: DISARM_JUSTIFICATION, observedRevision: 1 },
      baseDeps,
    );
    assert.equal(disarmedA.status, "written", "A's Governance disarmed it");
    assert.equal(disarmedA.status === "written" && disarmedA.authorizationRevision, 2);

    const aAfter = await resolveExternalSendReachability(a.tenantId, rootOn);
    assert.equal(
      aAfter.status === "refused" && aAfter.reason,
      "tenant-arming-withdrawn",
      "A is withdrawn — a DIFFERENT fact from never having been armed",
    );

    const bAfter = await resolveExternalSendReachability(b.tenantId, rootOn);
    assert.equal(bAfter.status, "reachable", "INVARIANT 3: B is untouched and still reachable");

    const bRevisionAfter = (
      await setup.query<{ id: string; state: string; authorization_revision: number; updated_at: Date }>(
        `select id, state, authorization_revision, updated_at from tenant_external_send_authorizations
          where tenant_id = $1 order by authorization_revision desc limit 1`,
        [b.tenantId],
      )
    ).rows[0]!;
    assert.deepEqual(
      { ...bRevisionAfter, updated_at: bRevisionAfter.updated_at.toISOString() },
      { ...bRevisionBefore, updated_at: bRevisionBefore.updated_at.toISOString() },
      "B's row is byte-identical after A's withdrawal",
    );

    /* A's SUPERSEDED REVISION IS BYTE-IDENTICAL TOO — revisions, never edits. */
    const aRevision1 = (
      await setup.query<{ id: string; state: string; authorization_revision: number }>(
        `select id, state, authorization_revision from tenant_external_send_authorizations
          where tenant_id = $1 and authorization_revision = 1`,
        [a.tenantId],
      )
    ).rows[0]!;
    assert.deepEqual(aRevision1, aRevisionBefore, "A's revision 1 was not edited");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. INVARIANT 4 (the other direction) · ROOT OFF STOPS AN ARMED TENANT,
     *    AND A WITHDRAWAL IS NEVER DISGUISED AS AN OUTAGE.
     * ═════════════════════════════════════════════════════════════════════ */
    const bRootOff = await resolveExternalSendReachability(b.tenantId, rootOff);
    assert.equal(
      bRootOff.status === "refused" && bRootOff.reason,
      "root-control-disabled",
      "an armed tenant is still stopped by the deployment control",
    );
    const aRootOff = await resolveExternalSendReachability(a.tenantId, rootOff);
    assert.equal(
      aRootOff.status === "refused" && aRootOff.reason,
      "tenant-arming-withdrawn",
      "a withdrawn tenant reads as WITHDRAWN even while the root switch is off",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. AN AGENT CANNOT ARM AN ORGANIZATION — POSTGRES REFUSES IT.
     * ═════════════════════════════════════════════════════════════════════ */
    await assert.rejects(
      setup.query(
        `insert into tenant_external_send_authorizations
           (tenant_id, authorization_revision, state, governance_decision_id, governance_session_id,
            authorized_by_actor_type, authorized_by_actor_id, authorized_at)
         select $1, 99, 'active', governance_decision_id, governance_session_id, 'agent', $2, now()
           from tenant_external_send_authorizations where tenant_id = $1 limit 1`,
        [a.tenantId, a.userId],
      ),
      /human_authorizer_chk/,
      "the database refuses an agent authorizer, independently of any TypeScript",
    );

    /* A LINEAGE CANNOT OPEN WITH A WITHDRAWAL. */
    const orphanDisarm = await disarmTenantExternalSend(
      bTenant,
      { justification: DISARM_JUSTIFICATION, observedRevision: 1 },
      baseDeps,
    );
    assert.equal(orphanDisarm.status, "written", "B had an active arming, so this one is legitimate");
    const doubleDisarm = await disarmTenantExternalSend(
      bTenant,
      { justification: DISARM_JUSTIFICATION, observedRevision: 2 },
      baseDeps,
    );
    assert.equal(
      doubleDisarm.status === "refused" && doubleDisarm.reason,
      "no-active-arming",
      "disarming what is already disarmed records nothing",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE LEDGER SAYS WHAT HAPPENED, UNDER ITS OWN DOMAIN AND SUBJECT.
     * ═════════════════════════════════════════════════════════════════════ */
    const decisions = (
      await setup.query<{ domain: string; subject_type: string; outcome: string; tenant_id: string }>(
        /* The domain lives on the SESSION, which is where Governance files a decision's concern. */
        `select gs.governance_domain as domain, dr.subject_type, dr.outcome, dr.tenant_id
           from decision_records dr
           join governance_sessions gs on gs.id = dr.session_id
          where dr.subject_type = $1 order by dr.created_at`,
        [TENANT_EXTERNAL_SEND_SUBJECT_TYPE],
      )
    ).rows;
    assert.equal(decisions.length, 4, "four arming decisions were recorded");
    for (const d of decisions) {
      assert.equal(d.domain, TENANT_EXTERNAL_SEND_DOMAIN, "each is filed under its own domain");
      assert.ok(
        d.outcome === TENANT_EXTERNAL_SEND_ARMED_OUTCOME ||
          d.outcome === TENANT_EXTERNAL_SEND_DISARMED_OUTCOME,
        "and never as a membership admission or an authority revocation",
      );
    }
    assert.equal(
      decisions.filter((d) => d.tenant_id === a.tenantId).length,
      2,
      "A's ledger holds A's two decisions and no more",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. INVARIANT 7 · ARMING AUTHORIZED NO SEND. NOTHING WAS SENT.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(await count(setup, "action_permits"), before.permits, "no permit was minted");
    assert.equal(await count(setup, "heby_action_requests"), before.requests, "no request was made");
    assert.equal(await count(setup, "external_recipients"), before.recipients, "no recipient exists");
    assert.equal(await count(setup, "action_execution_attempts"), before.attempts, "nothing was attempted");

    console.log("TENANT-ARM-1 cross-tenant containment (postgres): PASS");
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
