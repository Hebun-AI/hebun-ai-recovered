/*
 * OSA-1 — the Organization Structure Authority, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization can record that a department exists, what it is called, whether it is in
 *    service, and which human is accountable for it — under its own Governance authority, in one
 *    transaction, with an audit trail — and doing so grants nobody anything. Another tenant's
 *    department cannot be read or mutated. Another tenant's member cannot be made accountable.
 *    Two active departments cannot share an identifier, while two tenants can. `organization_id`
 *    cannot be populated. An agent cannot be pointed at another tenant's department. No Governance
 *    decision, no permission row and no membership change appears anywhere."
 *
 * Every row is produced by the released writer that owns it. No adapter, no network, no credential.
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { establishGovernanceAuthority } from "../../src/features/governance-decision/bootstrap-authority.server";
import {
  recordDepartment,
  renameDepartment,
  retireDepartment,
  setDepartmentOwner,
} from "../../src/features/organization-authority/write-structure.server";
import { readOrganizationStructure } from "../../src/features/organization-authority/read-structure.server";
import { readOrganizationAuthority } from "../../src/features/organization-authority/read-organization.server";
import { readOrganizationGroundingSource } from "../../src/features/organization-authority/heby-organization-source.server";
import { readLiveMapProjection } from "../../src/features/live-map/read-live-map.server";
import {
  DEPARTMENT_AUDIT_CREATED,
  DEPARTMENT_AUDIT_OWNER_SET,
  DEPARTMENT_AUDIT_RENAMED,
  DEPARTMENT_AUDIT_RETIRED,
  DEPARTMENT_ENTITY_TYPE,
  ORGANIZATION_STRUCTURE_AUTHORITY_MODEL,
} from "../../src/features/organization-authority/structure-contracts";
import { ORGANIZATION_STRUCTURE_UNAVAILABLE } from "../../src/features/organization-authority/contracts";
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

async function count(client: Client, table: string): Promise<number> {
  const row = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
  return row.rows[0]!.n;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_osa1_structure");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const baseDeps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 0. THE HARDENING IS APPLIED, AND IT IS THE HARDENING THAT WAS DESIGNED.
     * ═════════════════════════════════════════════════════════════════════ */
    const constraints = await setup.query<{ conname: string }>(
      `select conname from pg_constraint
        where conrelid = 'departments'::regclass order by conname`,
    );
    const names = constraints.rows.map((r) => r.conname);
    for (const expected of [
      "departments_no_second_parent_chk",
      "departments_human_owner_chk",
      "departments_owner_pair_chk",
      "departments_name_chk",
      "departments_slug_chk",
    ]) {
      assert.ok(names.includes(expected), `${expected} exists on departments`);
    }

    const indexes = await setup.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where tablename = 'departments'`,
    );
    const anchor = indexes.rows.find((r) => r.indexname === "departments_tenant_id_uq");
    assert.ok(anchor, "the composite tenant anchor exists");
    const slugIndex = indexes.rows.find((r) => r.indexname === "departments_tenant_slug_active_uq");
    assert.ok(slugIndex, "the active-slug uniqueness index exists");
    assert.ok(
      /WHERE/i.test(slugIndex!.indexdef),
      "slug uniqueness is PARTIAL — a retired department must not reserve its name forever",
    );

    /*
     * THE FK REPAIR. The single-column reference that shipped in the foundation baseline is gone,
     * and a composite one that PostgreSQL can use to enforce same-tenant is in its place.
     */
    const agentFks = await setup.query<{ conname: string; def: string }>(
      `select conname, pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'agents'::regclass and contype = 'f'`,
    );
    const oldFk = agentFks.rows.find((r) => r.conname === "agents_department_id_departments_id_fk");
    assert.equal(oldFk, undefined, "the unsafe single-column department FK is gone");
    const newFk = agentFks.rows.find((r) => r.conname === "agents_tenant_department_fk");
    assert.ok(newFk, "the composite tenant-safe department FK exists");
    assert.match(
      newFk!.def,
      /\(tenant_id,\s*department_id\)/,
      "the FK binds the tenant and the department together",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH ITS OWN GOVERNANCE AUTHORITY.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-osa1",
      email: "director@acme-osa1.test",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-osa1",
      email: "director@globex-osa1.test",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "osa1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "osa1-globex");

    for (const [seeded, ctx, label] of [
      [acme, acmeCtx, "acme"],
      [globex, globexCtx, "globex"],
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
        baseDeps,
      );
      assert.equal(genesis.status, "established", `${label} governance established`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. THE THREE TRUTH STATES, AND THEY NEVER COLLAPSE INTO TWO.
     *
     *    A. authority unavailable   B. available, zero departments   C. available, departments
     * ═════════════════════════════════════════════════════════════════════ */

    /* A — the authority could not be reached. NOT "no departments". */
    const unreachable = await readOrganizationStructure(acmeCtx, { getDb: () => null });
    assert.equal(unreachable.status, "unavailable", "an unreachable authority reports unavailable");
    assert.equal(
      unreachable.detail,
      ORGANIZATION_STRUCTURE_UNAVAILABLE.detail,
      "the unavailable sentence is the authority's own, not a surface's paraphrase",
    );

    /* B — looked, found none. A REAL answer about the organization. */
    const empty = await readOrganizationStructure(acmeCtx, baseDeps);
    assert.equal(empty.status, "available", "a reachable authority with no rows is AVAILABLE");
    assert.ok(empty.status === "available" && empty.departments.length === 0, "and empty");
    assert.notEqual(
      empty.detail,
      unreachable.detail,
      "AVAILABLE-AND-EMPTY and UNAVAILABLE must not read the same to a human",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. RECORDING A DEPARTMENT. Identity, lifecycle, ownership.
     * ═════════════════════════════════════════════════════════════════════ */
    const finance = await recordDepartment(
      acmeCtx,
      { name: "Finance", slug: "finance" },
      baseDeps,
    );
    assert.equal(finance.status, "recorded", "the department is recorded");
    assert.ok(finance.status === "recorded");
    assert.equal(finance.department.ownerActorId, null, "recorded with nobody accountable yet");

    /* C — available, with departments. */
    const withOne = await readOrganizationStructure(acmeCtx, baseDeps);
    assert.ok(withOne.status === "available" && withOne.departments.length === 1);
    assert.equal(withOne.departments[0]!.name, "Finance");
    assert.equal(withOne.departments[0]!.inService, true);
    assert.equal(withOne.departments[0]!.owner, null, "no owner is null, never a fabricated one");

    /* Ownership: the acting human is a real active member of this tenant. */
    const owned = await setDepartmentOwner(
      acmeCtx,
      { departmentId: finance.department.departmentId, ownerUserId: acme.userId },
      baseDeps,
    );
    assert.equal(owned.status, "recorded", "ownership is recorded");

    const afterOwner = await readOrganizationStructure(acmeCtx, baseDeps);
    assert.ok(afterOwner.status === "available");
    const financeView = afterOwner.departments[0]!;
    assert.equal(financeView.owner?.actorId, acme.userId);
    assert.equal(financeView.owner?.actorType, "human");
    assert.equal(
      financeView.owner?.currentlyActiveMember,
      true,
      "membership status is DERIVED, and this owner is still a member",
    );

    /* Rename. */
    const renamed = await renameDepartment(
      acmeCtx,
      { departmentId: finance.department.departmentId, name: "Finance & Treasury" },
      baseDeps,
    );
    assert.equal(renamed.status, "recorded");
    assert.ok(renamed.status === "recorded");
    assert.equal(renamed.department.slug, "finance", "renaming keeps the identifier unless asked");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. TENANT ISOLATION. Four proofs, three of them structural.
     * ═════════════════════════════════════════════════════════════════════ */

    /* 4.1 — tenant B cannot READ tenant A's department. */
    const globexStructure = await readOrganizationStructure(globexCtx, baseDeps);
    assert.ok(
      globexStructure.status === "available" && globexStructure.departments.length === 0,
      "another tenant sees none of Acme's departments — and sees AVAILABLE, not unavailable",
    );

    /* 4.2 — tenant B cannot MUTATE tenant A's department, and cannot tell it apart from fiction. */
    const foreignRename = await renameDepartment(
      globexCtx,
      { departmentId: finance.department.departmentId, name: "Stolen" },
      baseDeps,
    );
    assert.equal(foreignRename.status, "refused");
    assert.ok(foreignRename.status === "refused");
    assert.equal(
      foreignRename.reason,
      "department-unresolved",
      "another tenant's department is INDISTINGUISHABLE from one that never existed",
    );

    const invented = await renameDepartment(
      globexCtx,
      { departmentId: "00000000-0000-4000-8000-000000000000", name: "Nowhere" },
      baseDeps,
    );
    assert.ok(invented.status === "refused" && invented.reason === "department-unresolved");

    /* 4.3 — a member of ANOTHER tenant cannot be made accountable. */
    const foreignOwner = await setDepartmentOwner(
      acmeCtx,
      { departmentId: finance.department.departmentId, ownerUserId: globex.userId },
      baseDeps,
    );
    assert.equal(foreignOwner.status, "refused");
    assert.ok(foreignOwner.status === "refused");
    assert.equal(foreignOwner.reason, "owner-not-active-member");

    /* 4.4 — a cross-tenant `agents.department_id` is refused BY THE DATABASE. */
    const globexAgent = await setup.query<{ id: string }>(
      `insert into agents (tenant_id, name) values ($1, 'Globex agent') returning id`,
      [globex.tenantId],
    );
    await assert.rejects(
      () =>
        setup.query(`update agents set department_id = $1 where id = $2`, [
          finance.department.departmentId,
          globexAgent.rows[0]!.id,
        ]),
      /agents_tenant_department_fk|foreign key/i,
      "an agent CANNOT be pointed at another tenant's department — PostgreSQL refuses",
    );

    /* And a NULL department_id stays perfectly valid. */
    const stillNull = await setup.query<{ n: number }>(
      `select count(*)::int as n from agents where department_id is null`,
    );
    assert.equal(stillNull.rows[0]!.n, 1, "an unassigned agent remains valid under the new FK");

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. SLUG UNIQUENESS — per tenant, and only while active.
     * ═════════════════════════════════════════════════════════════════════ */
    const duplicate = await recordDepartment(
      acmeCtx,
      { name: "Finance again", slug: "finance" },
      baseDeps,
    );
    assert.ok(duplicate.status === "refused" && duplicate.reason === "duplicate-active-slug");

    /* The SAME slug in ANOTHER tenant is legitimate. */
    const globexFinance = await recordDepartment(
      globexCtx,
      { name: "Finance", slug: "finance" },
      baseDeps,
    );
    assert.equal(globexFinance.status, "recorded", "two tenants may both have a `finance`");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. RETIREMENT — a withdrawal, not a deletion, and it releases the slug.
     * ═════════════════════════════════════════════════════════════════════ */
    const retired = await retireDepartment(
      acmeCtx,
      { departmentId: finance.department.departmentId },
      baseDeps,
    );
    assert.equal(retired.status, "recorded");

    const afterRetire = await readOrganizationStructure(acmeCtx, baseDeps);
    assert.ok(afterRetire.status === "available");
    const retiredView = afterRetire.departments.find(
      (d) => d.departmentId === finance.department.departmentId,
    );
    assert.ok(retiredView, "a retired department is still READABLE — retirement is not deletion");
    assert.equal(retiredView!.inService, false);
    assert.equal(retiredView!.name, "Finance & Treasury", "the name survives retirement");
    assert.equal(retiredView!.owner?.actorId, acme.userId, "ownership survives retirement");

    /* Re-applying retirement is refused, and there is no un-retire anywhere. */
    const again = await retireDepartment(
      acmeCtx,
      { departmentId: finance.department.departmentId },
      baseDeps,
    );
    assert.ok(again.status === "refused" && again.reason === "department-retired");

    /* The identifier is available again — that is what PARTIAL uniqueness buys. */
    const reused = await recordDepartment(acmeCtx, { name: "Finance", slug: "finance" }, baseDeps);
    assert.equal(reused.status, "recorded", "a retired department does not reserve its slug");

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. THE DATABASE REFUSES WHAT THE WRITER WOULD NEVER SEND.
     * ═════════════════════════════════════════════════════════════════════ */

    /* 7.1 — `organization_id` is UNREPRESENTABLE, so `organizations` cannot come alive here. */
    const org = await setup.query<{ id: string }>(
      `insert into organizations (tenant_id, name, slug) values ($1, 'Shadow', 'shadow') returning id`,
      [acme.tenantId],
    );
    await assert.rejects(
      () =>
        setup.query(`update departments set organization_id = $1 where tenant_id = $2`, [
          org.rows[0]!.id,
          acme.tenantId,
        ]),
      /departments_no_second_parent_chk/,
      "a second parent hierarchy is refused BY POSTGRES, not by convention",
    );

    /* 7.2 — an AGENT cannot be recorded as accountable for part of a human organization. */
    await assert.rejects(
      () =>
        setup.query(
          `insert into departments (tenant_id, name, slug, owner_actor_type, owner_actor_id)
           values ($1, 'Robots', 'robots', 'agent', $2)`,
          [acme.tenantId, acme.userId],
        ),
      /departments_human_owner_chk/,
      "an agent owner is refused by the database",
    );

    /* 7.3 — half an owner is unrepresentable, in both directions. */
    await assert.rejects(
      () =>
        setup.query(
          `insert into departments (tenant_id, name, slug, owner_actor_id) values ($1, 'Half', 'half', $2)`,
          [acme.tenantId, acme.userId],
        ),
      /departments_owner_pair_chk/,
      "an owner id with no type is refused",
    );

    /* 7.4 — a non-canonical slug is refused, so the uniqueness index compares like with like. */
    await assert.rejects(
      () =>
        setup.query(`insert into departments (tenant_id, name, slug) values ($1, 'Bad', 'Not A Slug')`, [
          acme.tenantId,
        ]),
      /departments_slug_chk/,
      "a non-canonical slug is refused",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE WRITER'S OWN REFUSALS LEAVE NOTHING BEHIND.
     * ═════════════════════════════════════════════════════════════════════ */
    const before = await count(setup, "departments");
    const beforeAudit = await count(setup, "audit_log");

    for (const [input, reason] of [
      [{ name: "", slug: "ok-slug" }, "malformed-department-name"],
      [{ name: " padded ", slug: "ok-slug" }, "malformed-department-name"],
      [{ name: "Fine", slug: "Not A Slug" }, "malformed-department-slug"],
      [{ name: "Fine", slug: "-leading" }, "malformed-department-slug"],
      [{ name: "Fine", slug: "double--hyphen" }, "malformed-department-slug"],
    ] as const) {
      const refused = await recordDepartment(acmeCtx, input, baseDeps);
      assert.ok(refused.status === "refused" && refused.reason === reason, `refused: ${reason}`);
    }

    /* An unauthenticated caller, and a caller with no Governance authority. */
    const noContext = await recordDepartment(null, { name: "X", slug: "x" }, baseDeps);
    assert.ok(
      noContext.status === "refused" && noContext.reason === "no-authorized-tenant-context",
    );

    const unauthorized = await recordDepartment(acmeCtx, { name: "X", slug: "x" }, {
      ...baseDeps,
      resolveAuthority: async () => ({
        authorized: false,
        bootstrapDecisionId: null,
        authorityActorId: null,
        via: "none" as const,
        delegationDecisionId: null,
        grantedByActorId: null,
      }),
    });
    assert.ok(unauthorized.status === "refused" && unauthorized.reason === "not-authorized");

    assert.equal(await count(setup, "departments"), before, "no refusal wrote a department");
    assert.equal(await count(setup, "audit_log"), beforeAudit, "no refusal wrote an audit row");

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. AUDIT — every act recorded, in the same transaction, and nothing else touched.
     * ═════════════════════════════════════════════════════════════════════ */
    const audits = await setup.query<{ action: string; entity_type: string; actor_type: string }>(
      `select action, entity_type, actor_type from audit_log
        where entity_type = $1 order by occurred_at, action`,
      [DEPARTMENT_ENTITY_TYPE],
    );
    const actions = audits.rows.map((r) => r.action);
    for (const expected of [
      DEPARTMENT_AUDIT_CREATED,
      DEPARTMENT_AUDIT_OWNER_SET,
      DEPARTMENT_AUDIT_RENAMED,
      DEPARTMENT_AUDIT_RETIRED,
    ]) {
      assert.ok(actions.includes(expected), `${expected} was audited`);
    }
    assert.ok(
      audits.rows.every((r) => r.actor_type === "human"),
      "every structural act is attributed to the human who performed it",
    );

    /*
     * NOTHING ELSE MOVED. This is the boundary claim, measured rather than asserted in prose.
     * `decision_records` holds exactly the two genesis rows the bootstrap ceremony wrote and not
     * one more — OSA writes no Governance decision.
     */
    assert.equal(
      await count(setup, "decision_records"),
      2,
      "OSA wrote NO Governance decision — only the two genesis rows exist",
    );
    assert.equal(await count(setup, "permissions"), 0, "no permission row");
    assert.equal(await count(setup, "role_permissions"), 0, "no role-permission row");
    assert.equal(await count(setup, "action_permits"), 0, "no permit");
    assert.equal(await count(setup, "agent_mandates"), 0, "no mandate");
    assert.equal(await count(setup, "memberships"), 2, "membership count is unchanged: one each");
    assert.equal(await count(setup, "roles"), 2, "role count is unchanged");
    assert.equal(await count(setup, "companies"), 2, "no company was created or removed");

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. OWNERSHIP IS HISTORICAL; MEMBERSHIP IS CURRENT.
     * ═════════════════════════════════════════════════════════════════════ */
    await setup.query(`update memberships set lifecycle_status = 'archived' where tenant_id = $1`, [
      acme.tenantId,
    ]);
    const afterRevoke = await readOrganizationStructure(acmeCtx, baseDeps);
    assert.ok(afterRevoke.status === "available");
    const stillOwned = afterRevoke.departments.find(
      (d) => d.departmentId === finance.department.departmentId,
    );
    assert.equal(
      stillOwned!.owner?.actorId,
      acme.userId,
      "the record of who was accountable SURVIVES their membership ending",
    );
    assert.equal(
      stillOwned!.owner?.currentlyActiveMember,
      false,
      "and the CURRENT status is derived separately, so the two facts cannot be confused",
    );
    await setup.query(`update memberships set lifecycle_status = 'active' where tenant_id = $1`, [
      acme.tenantId,
    ]);

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. THE EXISTING L3 SEAM CARRIES IT, AND HEBY INHERITS IT.
     * ═════════════════════════════════════════════════════════════════════ */
    const l3 = await readOrganizationAuthority(acmeCtx, baseDeps);
    assert.equal(l3.status, "available");
    assert.ok(l3.status === "available");
    assert.equal(
      l3.organization.structure.status,
      "available",
      "structure is now AVAILABLE through the ONE Organization read seam",
    );

    const grounding = await readOrganizationGroundingSource(acmeCtx, {
      readOrganization: (t) => readOrganizationAuthority(t, baseDeps),
    });
    assert.equal(grounding.state, "resolved", "Heby's organization class resolves");
    const line = grounding.items[0]!.detail;
    assert.match(line, /Finance/, "Heby's grounding names the recorded department");
    assert.match(line, new RegExp(acme.userId), "and names who OSA recorded as accountable");
    assert.doesNotMatch(
      line,
      /Marketing|Sales Agent|SEO Agent/,
      "and names nothing that OSA did not record",
    );

    /* Heby must not be handed structure when the authority could not be read. */
    const darkGrounding = await readOrganizationGroundingSource(acmeCtx, {
      readOrganization: (t) => readOrganizationAuthority(t, { ...baseDeps, readStructure: async () => ORGANIZATION_STRUCTURE_UNAVAILABLE }),
    });
    assert.match(
      darkGrounding.items[0]!.detail,
      /unknown — not absent/,
      "an unread structure grounds as UNKNOWN, never as an organization with no departments",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 11b. THE LIVE MAP INHERITS IT — counted, never drawn, and never a false zero.
     *
     * OSA-0 deferred department NODES to their own milestone, so the only thing proved here is
     * that the map stopped claiming an authority does not exist once one did. The projection reads
     * the SAME organization seam it has read since L4; OSA-1 added no Live Map seam.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const withStructure = await readLiveMapProjection(acmeCtx, {
        readOrganization: (t) => readOrganizationAuthority(t, baseDeps),
      });
      const structureDomain = withStructure.domains.find((d) => d.domainId === "structure")!;
      assert.notEqual(
        structureDomain.state.status,
        "no-authority",
        "the map must not claim there is no structural authority once one exists",
      );
      assert.match(
        "detail" in structureDomain.state ? structureDomain.state.detail : "",
        /department/i,
        "and it reports the recorded structure",
      );
      assert.equal(
        withStructure.domains.filter((d) => d.domainId === "structure" && d.state.status === "available")
          .length,
        0,
        "no department NODE is drawn — that is a deferred milestone, and the map must not imply it",
      );

      /* An UNREAD structure still reports no-authority, and still never as a zero. */
      const dark = await readLiveMapProjection(acmeCtx, {
        readOrganization: (t) =>
          readOrganizationAuthority(t, { ...baseDeps, readStructure: async () => ORGANIZATION_STRUCTURE_UNAVAILABLE }),
      });
      const darkStructure = dark.domains.find((d) => d.domainId === "structure")!;
      assert.equal(darkStructure.state.status, "no-authority");
      assert.match(
        "detail" in darkStructure.state ? darkStructure.state.detail : "",
        /unknown — not absent/,
        "an unread structure is never a measured zero on the map",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. THE BOUNDARY MODEL SAYS WHAT THIS MILESTONE ACTUALLY DID.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.writesGovernanceDecision, false);
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.governanceDomainAdded, false);
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanRoster, false);
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.humanAssignment, false);
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.agentAssignmentWriter, false);
    assert.equal(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.organizationsActivated, false);
    assert.deepEqual(ORGANIZATION_STRUCTURE_AUTHORITY_MODEL.writesTables, ["departments"]);

    console.log("osa1-organization-structure/structure-postgres: OK");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
