/*
 * OSA OWNER ELIGIBILITY HARDENING — against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The Organization Structure Authority's owner writer fails closed on its own, against the
 *    authoritative Identity and membership state, for every way a human stops being eligible. It
 *    accepts an active same-tenant human — including the tenant's own Governance authority holder —
 *    and refuses a revoked membership, a soft-deleted identity, another tenant's human and an
 *    identifier nobody holds. It does so when called DIRECTLY, with no surface in the way, because
 *    a control that hides somebody is not enforcement. And nothing about hardening it granted
 *    anybody anything, wrote a Governance record, or rewrote a department that already existed."
 *
 * The pins:
 *
 *   THE UI HIDING SOMEBODY != ENFORCEMENT      ELIGIBLE != AUTHORIZED
 *   ENFORCED AT ASSIGNMENT != REWRITTEN LATER  A PREDICATE != AN AUTHORITY
 *
 * Every row is produced by the released writer or seed that owns it. No adapter, no network, no
 * model. Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import { readSelectableMembers } from "../../src/features/auth-runtime/human-label-read.server";
import {
  recordDepartment,
  setDepartmentOwner,
} from "../../src/features/organization-authority/write-structure.server";
import { readOrganizationStructure } from "../../src/features/organization-authority/read-structure.server";
import { resolveGovernanceAuthority } from "../../src/features/governance-decision/authority-read.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const GENESIS_JUSTIFICATION =
  "I am establishing this organization's Governance authority and I accept responsibility for it.";

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

/** Add another human to a tenant, in whatever eligibility state the case under test needs. */
async function addMember(
  client: Client,
  tenant: { tenantId: string; roleId: string },
  input: {
    email: string;
    displayName?: string | null;
    membershipStatus?: "active" | "revoked";
    revoked?: boolean;
    userDeleted?: boolean;
    userLifecycle?: "active" | "archived" | "deleted";
    membershipLifecycle?: "active" | "archived";
  },
): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, display_name, deleted_at, lifecycle_status)
     values ($1, $2, $3, $4::lifecycle_status) returning id`,
    [
      input.email,
      input.displayName ?? null,
      input.userDeleted ? new Date() : null,
      input.userLifecycle ?? "active",
    ],
  );
  const userId = user.rows[0]!.id;
  await client.query(
    `insert into memberships (tenant_id, user_id, role_id, status, revoked_at, lifecycle_status)
     values ($1,$2,$3,$4,$5,$6)`,
    [
      tenant.tenantId,
      userId,
      tenant.roleId,
      input.membershipStatus ?? "active",
      input.revoked ? new Date() : null,
      input.membershipLifecycle ?? "active",
    ],
  );
  return userId;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_osa_eligibility");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    const acme = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-osaelig",
      email: "director@acme-osaelig.test",
      userName: "Acme Director",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-osaelig",
      email: "director@globex-osaelig.test",
      userName: "Globex Director",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "osaelig-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "osaelig-globex");

    for (const [seeded, ctx] of [
      [acme, acmeCtx],
      [globex, globexCtx],
    ] as const) {
      await setup.query(
        `insert into genesis_nominations
           (tenant_id, nominated_auth_identity_id, nominated_user_id, status, nomination_source,
            accepted_at, accepted_session_context_id, accepted_assurance_level)
         values ($1,$2,$3,'accepted','local-operator-ceremony', now(), $4, 'aal1')`,
        [seeded.tenantId, seeded.authIdentityId, seeded.userId, ctx.sessionContextId],
      );
      const genesis = await establishGovernanceAuthority(
        ctx,
        { justification: GENESIS_JUSTIFICATION },
        deps,
      );
      assert.equal(genesis.status, "established");
    }

    /* One human per way of being ineligible, so every predicate is isolated by a fixture. */
    const eligible = await addMember(setup, acme, {
      email: "ok@acme-osaelig.test",
      displayName: "Eligible Person",
    });
    const revokedStatus = await addMember(setup, acme, {
      email: "revoked@acme-osaelig.test",
      displayName: "Revoked Status",
      membershipStatus: "revoked",
      revoked: true,
    });
    /*
     * THE MIRROR PAIR. `status` and `revoked_at` are checked separately, so each needs a fixture
     * where it is THE ONLY signal — otherwise removing one condition changes nothing, the sibling
     * catches the case, and the bite-proof survives against a guard that is really untested. That
     * happened here for `status` and is why this row exists.
     */
    const statusRevokedOnly = await addMember(setup, acme, {
      email: "statusrevoked@acme-osaelig.test",
      displayName: "Revoked Status Only",
      membershipStatus: "revoked",
      revoked: false,
    });
    const revokedTimestampOnly = await addMember(setup, acme, {
      email: "halfrevoked@acme-osaelig.test",
      displayName: "Revoked Timestamp Only",
      membershipStatus: "active",
      revoked: true,
    });
    const archivedMembership = await addMember(setup, acme, {
      email: "archivedm@acme-osaelig.test",
      displayName: "Archived Membership",
      membershipLifecycle: "archived",
    });
    const softDeletedIdentity = await addMember(setup, acme, {
      email: "deleted@acme-osaelig.test",
      displayName: "Soft Deleted",
      userDeleted: true,
    });
    const archivedIdentity = await addMember(setup, acme, {
      email: "archivedu@acme-osaelig.test",
      displayName: "Archived Identity",
      userLifecycle: "archived",
    });
    const unknown = "00000000-0000-4000-8000-000000000000";

    const recorded = await recordDepartment(
      acmeCtx,
      { name: "Engineering", slug: "engineering" },
      deps,
    );
    assert.equal(recorded.status, "recorded");
    if (recorded.status !== "recorded") throw new Error("unreachable");
    const departmentId = recorded.department.departmentId;

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. ACCEPTED — an active same-tenant human, and the authority holder.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const [id, who] of [
      [eligible, "an active same-tenant human"],
      [acme.userId, "the tenant's own Governance authority holder"],
    ] as const) {
      const set = await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: id }, deps);
      assert.equal(set.status, "recorded", `${who} may be made accountable`);
    }

    /*
     * THE AUTHORITY HOLDER CASE IS NOT INCIDENTAL. OSA-2 recorded exactly this in production — the
     * tenant's only human owning its only department — so a hardening that tightened this away would
     * have broken the one real record that exists.
     */

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. REFUSED — every way of being ineligible, judged on the identifier.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const [id, why] of [
      [revokedStatus, "a revoked membership"],
      [statusRevokedOnly, "a membership revoked by status while its revoked-at is still null"],
      [revokedTimestampOnly, "a membership revoked by timestamp while its status still says active"],
      [archivedMembership, "an archived membership"],
      [softDeletedIdentity, "a soft-deleted identity"],
      [archivedIdentity, "an archived identity"],
      [globex.userId, "another organization's human"],
      [unknown, "an identifier nobody holds"],
    ] as const) {
      const refused = await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: id }, deps);
      assert.deepEqual(
        refused,
        { status: "refused", reason: "owner-not-active-member" },
        `the writer refuses ${why}`,
      );
    }

    /*
     * ── CALLED DIRECTLY, WITH NO SURFACE IN THE WAY ─────────────────────────
     *
     * Every refusal above came from invoking the released writer as a function. There is no page, no
     * server action and no picker between the caller and the authority, which is the whole point:
     * the previous behaviour was safe ONLY while a human used the product, and a caller with a
     * session could set any uuid it liked.
     */

    /* The same refusals apply at CREATE time, not only when changing an existing owner. */
    for (const [id, why] of [
      [revokedStatus, "a revoked membership"],
      [softDeletedIdentity, "a soft-deleted identity"],
      [globex.userId, "another organization's human"],
    ] as const) {
      const refused = await recordDepartment(
        acmeCtx,
        { name: `Dept ${why}`, slug: `d-${Math.abs(why.length)}-${id.slice(0, 8)}`, ownerUserId: id },
        deps,
      );
      assert.deepEqual(
        refused,
        { status: "refused", reason: "owner-not-active-member" },
        `recording a department with ${why} as owner is refused too`,
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. PICKER AND WRITER AGREE — EXACTLY, IN BOTH DIRECTIONS.
     * ═════════════════════════════════════════════════════════════════════ */
    const offered = await readSelectableMembers(acmeCtx, deps);
    assert.equal(offered.status, "read");
    if (offered.status !== "read") throw new Error("unreachable");
    const offeredIds = offered.members.map((m) => m.userId);

    /* Everything offered is accepted. */
    for (const member of offered.members) {
      const set = await setDepartmentOwner(
        acmeCtx,
        { departmentId, ownerUserId: member.userId },
        deps,
      );
      assert.equal(set.status, "recorded", `the writer accepts every offered human (${member.label})`);
    }

    /* Everything the writer refuses is withheld. THIS is the direction that used to be false. */
    for (const [id, why] of [
      [revokedStatus, "a revoked membership"],
      [statusRevokedOnly, "a membership revoked by status alone"],
      [revokedTimestampOnly, "a membership revoked by timestamp alone"],
      [archivedMembership, "an archived membership"],
      [softDeletedIdentity, "a soft-deleted identity"],
      [archivedIdentity, "an archived identity"],
      [globex.userId, "another organization's human"],
    ] as const) {
      assert.ok(!offeredIds.includes(id), `the picker withholds ${why}, as the writer refuses it`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. HISTORY IS NOT REWRITTEN WHEN AN OWNER LATER BECOMES INELIGIBLE.
     * ═════════════════════════════════════════════════════════════════════ */
    const settled = await setDepartmentOwner(
      acmeCtx,
      { departmentId, ownerUserId: eligible },
      deps,
    );
    assert.equal(settled.status, "recorded");

    /* The membership ends AFTER ownership was recorded — the case the brief is most careful about. */
    await setup.query(
      `update memberships set status = 'revoked', revoked_at = now()
        where tenant_id = $1::uuid and user_id = $2::uuid`,
      [acme.tenantId, eligible],
    );

    const after = await readOrganizationStructure(acmeCtx, deps);
    assert.equal(after.status, "available");
    if (after.status !== "available") throw new Error("unreachable");
    const department = after.departments.find((d) => d.departmentId === departmentId);

    assert.equal(
      department?.owner?.actorId,
      eligible,
      "the department STILL NAMES the human who was made accountable — nothing was erased",
    );
    assert.equal(
      department?.inService,
      true,
      "and the department was not retired, because an owner's membership ending is not a department lifecycle event",
    );
    assert.equal(
      department?.owner?.currentlyActiveMember,
      false,
      "the DERIVED flag says they are no longer an active member — the only thing that changed",
    );

    /* Re-assigning them now is refused: eligibility is enforced at assignment. */
    const reassign = await setDepartmentOwner(acmeCtx, { departmentId, ownerUserId: eligible }, deps);
    assert.deepEqual(
      reassign,
      { status: "refused", reason: "owner-not-active-member" },
      "ENFORCED AT ASSIGNMENT: the same human can no longer be newly recorded as accountable",
    );

    /* And the record is unchanged by that refusal. */
    const unchanged = await readOrganizationStructure(acmeCtx, deps);
    if (unchanged.status !== "available") throw new Error("unreachable");
    assert.equal(
      unchanged.departments.find((d) => d.departmentId === departmentId)?.owner?.actorId,
      eligible,
      "a refused re-assignment mutated nothing",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. NOTHING WAS GRANTED, AND NOTHING GOVERNANCE-SHAPED WAS WRITTEN.
     * ═════════════════════════════════════════════════════════════════════ */
    const ownerCtx = contextFor(
      {
        tenantId: acme.tenantId,
        userId: eligible,
        authIdentityId: acme.authIdentityId,
        membershipId: acme.membershipId,
        roleId: acme.roleId,
      },
      await sessionRowFor(setup, acme, "dddd"),
      "osaelig-owner",
    );
    assert.equal(
      (await resolveGovernanceAuthority(ownerCtx, deps)).authorized,
      false,
      "being the accountable human grants no Governance authority",
    );

    for (const [table, expected] of [
      ["action_permits", 0],
      ["action_execution_attempts", 0],
    ] as const) {
      const n = (await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0]!
        .n;
      assert.equal(n, expected, `${table} is empty — hardening created none`);
    }
    const structuralDecisions = (
      await setup.query<{ n: number }>(
        `select count(*)::int as n from decision_records where subject_type = 'department'`,
      )
    ).rows[0]!.n;
    assert.equal(structuralDecisions, 0, "and no Governance decision was written for structure");

    console.log("OSA owner eligibility (postgres): all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
