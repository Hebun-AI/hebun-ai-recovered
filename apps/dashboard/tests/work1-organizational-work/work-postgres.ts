/*
 * WORK-1 — the Organizational Work Authority, against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization can record that a unit of work exists, what it is called, which part of itself
 *    it belongs to, which human is accountable for it, and what state a human declared — under its
 *    own Governance authority, in one transaction, with an audit trail — and doing so grants nobody
 *    anything. Another tenant's work cannot be read or mutated. Another tenant's department cannot
 *    be named. Another tenant's member cannot be made accountable. A member whose membership was
 *    revoked, or whose identity was soft-deleted, is REFUSED BY THE WRITER. An agent cannot be
 *    accountable. No Governance decision, no permit, no action request and no execution attempt
 *    appears anywhere."
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
import { recordDepartment } from "../../src/features/organization-authority/write-structure.server";
import {
  recordWork,
  retireWork,
  retitleWork,
  setWorkAccountableHuman,
  setWorkDeclaredState,
} from "../../src/features/organizational-work/write-work.server";
import { readWorkRegister } from "../../src/features/organizational-work/read-work.server";
import {
  ORGANIZATIONAL_WORK_AUTHORITY_MODEL,
  WORK_AUDIT_ACCOUNTABLE_SET,
  WORK_AUDIT_RECORDED,
  WORK_AUDIT_RETIRED,
  WORK_AUDIT_RETITLED,
  WORK_AUDIT_STATE_DECLARED,
  WORK_DECLARED_STATES,
  WORK_ITEM_ENTITY_TYPE,
  MAX_WORK_TITLE_LENGTH,
} from "../../src/features/organizational-work/work-contracts";
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
  const harness = createDisposablePostgresHarness("hebun_work1_register");
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
      `select conname from pg_constraint where conrelid = 'work_items'::regclass order by conname`,
    );
    const names = constraints.rows.map((r) => r.conname);
    for (const expected of [
      "work_items_human_accountable_chk",
      "work_items_accountable_pair_chk",
      "work_items_title_chk",
    ]) {
      assert.ok(names.includes(expected), `${expected} exists on work_items`);
    }

    const indexes = await setup.query<{ indexname: string }>(
      `select indexname from pg_indexes where tablename = 'work_items'`,
    );
    assert.ok(
      indexes.rows.some((r) => r.indexname === "work_items_tenant_id_uq"),
      "the composite tenant anchor exists",
    );

    /* The same-tenant department FK, and it binds the pair — not the department alone. */
    const fks = await setup.query<{ conname: string; def: string }>(
      `select conname, pg_get_constraintdef(oid) as def from pg_constraint
        where conrelid = 'work_items'::regclass and contype = 'f'`,
    );
    const departmentFk = fks.rows.find((r) => r.conname === "work_items_tenant_department_fk");
    assert.ok(departmentFk, "the composite tenant-safe department FK exists");
    assert.match(
      departmentFk!.def,
      /\(tenant_id,\s*department_id\)/,
      "the FK binds the tenant and the department together",
    );

    /*
     * THE DEAD WORK ISLAND IS NOT REACHED. Not one foreign key from `work_items` points at any of
     * the eight tables the WORK-0 gate measured as dead. Proved against PostgreSQL rather than
     * against an import list, because a FK is the thing that would make one of them addressable.
     */
    const referenced = await setup.query<{ target: string }>(
      `select confrelid::regclass::text as target from pg_constraint
        where conrelid = 'work_items'::regclass and contype = 'f'`,
    );
    const targets = referenced.rows.map((r) => r.target);
    for (const dead of [
      "tasks",
      "goals",
      "plans",
      "missions",
      "workflows",
      "commands",
      "executions",
      "reasoning_traces",
    ]) {
      assert.ok(!targets.includes(dead), `work_items holds no FK to ${dead}`);
    }
    assert.deepEqual(
      [...targets].sort(),
      ["companies", "departments"],
      "work_items references exactly the tenant and the department, and nothing else",
    );

    /* The database enum and the product vocabulary are the same four values. */
    const enumRows = await setup.query<{ label: string }>(
      `select e.enumlabel as label from pg_enum e
         join pg_type t on t.oid = e.enumtypid
        where t.typname = 'work_declared_state' order by e.enumsortorder`,
    );
    assert.deepEqual(
      enumRows.rows.map((r) => r.label),
      [...WORK_DECLARED_STATES],
      "the declared-state enum and the product vocabulary cannot diverge",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO TENANTS, EACH WITH ITS OWN GOVERNANCE AUTHORITY.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-work1",
      email: "director@acme-work1.test",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-work1",
      email: "director@globex-work1.test",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "work1-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "work1-globex");

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

    /* A department in each tenant, through the released Organization Structure Authority. */
    const acmeDept = await recordDepartment(
      acmeCtx,
      { name: "Finance", slug: "finance" },
      baseDeps,
    );
    assert.equal(acmeDept.status, "recorded");
    const acmeDepartmentId =
      acmeDept.status === "recorded" ? acmeDept.department.departmentId : "";

    const globexDept = await recordDepartment(
      globexCtx,
      { name: "Legal", slug: "legal" },
      baseDeps,
    );
    assert.equal(globexDept.status, "recorded");
    const globexDepartmentId =
      globexDept.status === "recorded" ? globexDept.department.departmentId : "";

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. RECORDING WORK — the whole capability, in one act.
     * ═════════════════════════════════════════════════════════════════════ */
    const recorded = await recordWork(
      acmeCtx,
      {
        title: "Q3 supplier audit",
        departmentId: acmeDepartmentId,
        accountableUserId: acme.userId,
      },
      baseDeps,
    );
    assert.equal(recorded.status, "recorded", "work is recorded");
    const workItemId = recorded.status === "recorded" ? recorded.workItem.workItemId : "";
    assert.equal(
      recorded.status === "recorded" ? recorded.workItem.declaredState : null,
      "planned",
      "work with no stated state is DECLARED PLANNED, not stateless",
    );

    /* Attribution is the authenticated human's, taken from the session and never from input. */
    const attribution = await setup.query<{
      created_by: string;
      created_by_type: string;
      tenant_id: string;
      accountable_actor_type: string | null;
    }>(
      `select created_by, created_by_type, tenant_id, accountable_actor_type
         from work_items where id = $1`,
      [workItemId],
    );
    assert.equal(attribution.rows[0]!.created_by, acme.userId);
    assert.equal(attribution.rows[0]!.created_by_type, "human");
    assert.equal(attribution.rows[0]!.tenant_id, acme.tenantId);
    assert.equal(attribution.rows[0]!.accountable_actor_type, "human");

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. TENANT ISOLATION, AND WHERE IT IS ENFORCED.
     * ═════════════════════════════════════════════════════════════════════ */

    /* Another tenant's work is UNRESOLVED, not readable and not mutable. */
    const foreignRetitle = await retitleWork(
      globexCtx,
      { workItemId, title: "Stolen" },
      baseDeps,
    );
    assert.equal(foreignRetitle.status, "refused");
    assert.equal(
      foreignRetitle.status === "refused" ? foreignRetitle.reason : null,
      "work-unresolved",
      "another tenant's work item does not exist as far as this authority is concerned",
    );

    /* Another tenant's DEPARTMENT cannot be named. */
    const foreignDepartment = await recordWork(
      acmeCtx,
      { title: "Cross-tenant filing", departmentId: globexDepartmentId },
      baseDeps,
    );
    assert.equal(foreignDepartment.status, "refused");
    assert.equal(
      foreignDepartment.status === "refused" ? foreignDepartment.reason : null,
      "department-unresolved",
    );

    /* And the database refuses it too, independently of the writer. */
    await assert.rejects(
      () =>
        setup.query(
          `insert into work_items (tenant_id, title, department_id) values ($1, $2, $3)`,
          [acme.tenantId, "Raw cross-tenant", globexDepartmentId],
        ),
      /work_items_tenant_department_fk|violates foreign key/i,
      "PostgreSQL refuses a cross-tenant department reference on its own",
    );

    /* Another tenant's MEMBER cannot be made accountable. */
    const foreignAccountable = await setWorkAccountableHuman(
      acmeCtx,
      { workItemId, accountableUserId: globex.userId },
      baseDeps,
    );
    assert.equal(foreignAccountable.status, "refused");
    assert.equal(
      foreignAccountable.status === "refused" ? foreignAccountable.reason : null,
      "accountable-not-eligible-member",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. AN AGENT CANNOT BE ACCOUNTABLE — and not because the writer says so.
     * ═════════════════════════════════════════════════════════════════════ */
    await assert.rejects(
      () =>
        setup.query(
          `insert into work_items (tenant_id, title, accountable_actor_type, accountable_actor_id)
           values ($1, $2, 'agent', $3)`,
          [acme.tenantId, "Agent-owned work", acme.userId],
        ),
      /work_items_human_accountable_chk/i,
      "PostgreSQL rejects an agent as accountable, independently of application code",
    );
    await assert.rejects(
      () =>
        setup.query(
          `insert into work_items (tenant_id, title, accountable_actor_type) values ($1, $2, 'human')`,
          [acme.tenantId, "Half a pair"],
        ),
      /work_items_accountable_pair_chk/i,
      "a type with no id is not a state this table can hold",
    );
    await assert.rejects(
      () => setup.query(`insert into work_items (tenant_id, title) values ($1, '   ')`, [acme.tenantId]),
      /work_items_title_chk/i,
      "work whose title says nothing is not work",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. ELIGIBILITY IS THE FULL SHARED PREDICATE — the writer, not the UI.
     * ═════════════════════════════════════════════════════════════════════ */

    /*
     * A SECOND, REAL MEMBER OF ACME — created the way the seed helper creates one, because a
     * membership carries a composite `(tenant_id, role_id)` FK and moving one between tenants is a
     * state the database refuses. The point of this section is the eligibility rule, so the fixture
     * has to be a genuinely eligible member first.
     */
    const secondUser = await setup.query<{ id: string }>(
      `insert into users (email, name) values ($1, $1) returning id`,
      ["second@acme-work1.test"],
    );
    const secondUserId = secondUser.rows[0]!.id;
    const secondRole = await setup.query<{ id: string }>(
      `insert into roles (tenant_id, name, type) values ($1, 'Member', 'member') returning id`,
      [acme.tenantId],
    );
    await setup.query(
      `insert into memberships (tenant_id, user_id, role_id, status) values ($1, $2, $3, 'active')`,
      [acme.tenantId, secondUserId, secondRole.rows[0]!.id],
    );
    const revoked = { userId: secondUserId };

    const eligibleFirst = await setWorkAccountableHuman(
      acmeCtx,
      { workItemId, accountableUserId: revoked.userId },
      baseDeps,
    );
    assert.equal(eligibleFirst.status, "recorded", "an eligible member IS accepted");


    /*
     * FIVE WAYS TO STOP BEING ELIGIBLE, one at a time, each with the previous one undone first.
     *
     * Four end a membership and two end an identity, and the released writer used to check only ONE
     * of them — which is how an authority came to accept a human whose membership had been revoked.
     * Each case below is asserted separately so a single weakened condition cannot hide behind
     * another.
     */
    for (const [statements, label] of [
      [
        [`update memberships set status = 'revoked' where user_id = $1`],
        "membership status revoked",
      ],
      [
        [
          `update memberships set status = 'active' where user_id = $1`,
          `update memberships set revoked_at = now() where user_id = $1`,
        ],
        "membership revoked_at set",
      ],
      [
        [
          `update memberships set revoked_at = null where user_id = $1`,
          `update memberships set lifecycle_status = 'archived' where user_id = $1`,
        ],
        "membership archived",
      ],
      [
        [
          `update memberships set lifecycle_status = 'active' where user_id = $1`,
          `update users set deleted_at = now() where id = $1`,
        ],
        "identity soft-deleted",
      ],
      [
        [
          `update users set deleted_at = null where id = $1`,
          `update users set lifecycle_status = 'archived' where id = $1`,
        ],
        "identity archived",
      ],
    ] as const) {
      for (const statement of statements) await setup.query(statement, [revoked.userId]);
      const refused = await setWorkAccountableHuman(
        acmeCtx,
        { workItemId, accountableUserId: revoked.userId },
        baseDeps,
      );
      assert.equal(refused.status, "refused", `${label}: refused`);
      assert.equal(
        refused.status === "refused" ? refused.reason : null,
        "accountable-not-eligible-member",
        `${label}: refused for the right reason, by the WRITER`,
      );
    }

    /* Put the record back on the founder so the rest of the file reads a live accountable human. */
    const backToFounder = await setWorkAccountableHuman(
      acmeCtx,
      { workItemId, accountableUserId: acme.userId },
      baseDeps,
    );
    assert.equal(backToFounder.status, "recorded");

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. DECLARED STATE — every value, and re-declaring is a real act.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const state of WORK_DECLARED_STATES) {
      const declared = await setWorkDeclaredState(
        acmeCtx,
        { workItemId, declaredState: state },
        baseDeps,
      );
      assert.equal(declared.status, "recorded", `declared ${state}`);
      assert.equal(
        declared.status === "recorded" ? declared.workItem.declaredState : null,
        state,
      );
    }
    /* Any value may follow any other: there is no transition graph. */
    const backwards = await setWorkDeclaredState(
      acmeCtx,
      { workItemId, declaredState: "planned" },
      baseDeps,
    );
    assert.equal(backwards.status, "recorded", "complete -> planned is legal; nothing is inferred");

    const malformedState = await setWorkDeclaredState(
      acmeCtx,
      { workItemId, declaredState: "done" as never },
      baseDeps,
    );
    assert.equal(malformedState.status, "refused");
    assert.equal(
      malformedState.status === "refused" ? malformedState.reason : null,
      "malformed-declared-state",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. TITLE — accepted exactly as given, or refused. Never repaired.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const bad of ["", " padded", "padded ", "x".repeat(MAX_WORK_TITLE_LENGTH + 1)]) {
      const refused = await retitleWork(acmeCtx, { workItemId, title: bad }, baseDeps);
      assert.equal(refused.status, "refused", `title ${JSON.stringify(bad.slice(0, 12))} refused`);
      assert.equal(
        refused.status === "refused" ? refused.reason : null,
        "malformed-work-title",
      );
    }
    const retitled = await retitleWork(
      acmeCtx,
      { workItemId, title: "Q3 supplier audit (revised)" },
      baseDeps,
    );
    assert.equal(retitled.status, "recorded");

    /* Two work items MAY share a title. There is no slug and no uniqueness on what work is called. */
    const twin = await recordWork(acmeCtx, { title: "Q3 supplier audit (revised)" }, baseDeps);
    assert.equal(twin.status, "recorded", "two work items may legitimately share a title");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. THE READ — three states, a department name, an identifier and no invented name.
     * ═════════════════════════════════════════════════════════════════════ */
    const register = await readWorkRegister(acmeCtx, baseDeps);
    assert.equal(register.status, "available");
    if (register.status !== "available") throw new Error("unreachable");
    assert.equal(register.items.length, 2);
    const primary = register.items.find((item) => item.workItemId === workItemId)!;
    assert.equal(primary.title, "Q3 supplier audit (revised)");
    assert.equal(primary.declaredState, "planned");
    assert.equal(primary.inService, true);
    assert.equal(primary.department?.name, "Finance");
    assert.equal(primary.accountableActorId, acme.userId);
    assert.equal(primary.accountableCurrentlyActiveMember, true);
    assert.ok(
      !JSON.stringify(register).includes("director@acme-work1.test"),
      "the register carries an IDENTIFIER and never a human's email or name",
    );
    assert.match(
      register.detail,
      /DECLARED by a human/,
      "the read says the states are declared, not observed",
    );

    /* Globex sees its own register, and it is empty — a measured answer, not a failure. */
    const globexRegister = await readWorkRegister(globexCtx, baseDeps);
    assert.equal(globexRegister.status, "available");
    if (globexRegister.status !== "available") throw new Error("unreachable");
    assert.equal(globexRegister.items.length, 0, "another tenant's work is unreachable, not merged");

    /* An unresolved tenant is UNAVAILABLE, never an empty list. */
    const unavailable = await readWorkRegister(null, baseDeps);
    assert.equal(unavailable.status, "unavailable", "a failed read is not 'you have no work'");

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. AUTHORITY GATE — no Governance authority, no write.
     * ═════════════════════════════════════════════════════════════════════ */
    const unauthorized = await recordWork(
      acmeCtx,
      { title: "Should not exist" },
      { ...baseDeps, resolveAuthority: async () => ({ authorized: false }) },
    );
    assert.equal(unauthorized.status, "refused");
    assert.equal(
      unauthorized.status === "refused" ? unauthorized.reason : null,
      "not-authorized",
      "the authority gate is the tenant's existing Governance authority, and it fails closed",
    );
    const noContext = await recordWork(null, { title: "No session" }, baseDeps);
    assert.equal(noContext.status, "refused");
    assert.equal(
      noContext.status === "refused" ? noContext.reason : null,
      "no-authorized-tenant-context",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. RETIREMENT — in place, terminal, and nothing is deleted.
     * ═════════════════════════════════════════════════════════════════════ */
    const retire = await retireWork(acmeCtx, { workItemId }, baseDeps);
    assert.equal(retire.status, "recorded");

    const afterRetire = await setup.query<{
      title: string;
      declared_state: string;
      lifecycle_status: string;
      accountable_actor_id: string | null;
      department_id: string | null;
    }>(
      `select title, declared_state, lifecycle_status, accountable_actor_id, department_id
         from work_items where id = $1`,
      [workItemId],
    );
    const row = afterRetire.rows[0]!;
    assert.equal(row.lifecycle_status, "archived", "retired IN PLACE, using the shared enum");
    assert.equal(row.title, "Q3 supplier audit (revised)", "the title survives retirement");
    assert.equal(row.declared_state, "planned", "the last declared state survives retirement");
    assert.equal(row.accountable_actor_id, acme.userId, "the accountable human stays named");
    assert.equal(row.department_id, acmeDepartmentId, "the department reference stays");

    for (const [label, attempt] of [
      ["retitle", () => retitleWork(acmeCtx, { workItemId, title: "After" }, baseDeps)],
      [
        "declare",
        () => setWorkDeclaredState(acmeCtx, { workItemId, declaredState: "active" }, baseDeps),
      ],
      [
        "accountable",
        () => setWorkAccountableHuman(acmeCtx, { workItemId, accountableUserId: null }, baseDeps),
      ],
      ["retire again", () => retireWork(acmeCtx, { workItemId }, baseDeps)],
    ] as const) {
      const refused = await attempt();
      assert.equal(refused.status, "refused", `${label} on retired work is refused`);
      assert.equal(
        refused.status === "refused" ? refused.reason : null,
        "work-retired",
        `${label}: retirement is terminal for this authority`,
      );
    }

    /* Retired work is RETURNED by the read, not hidden — otherwise retirement looks like deletion. */
    const afterRetireRegister = await readWorkRegister(acmeCtx, baseDeps);
    assert.equal(afterRetireRegister.status, "available");
    if (afterRetireRegister.status !== "available") throw new Error("unreachable");
    const retiredView = afterRetireRegister.items.find((item) => item.workItemId === workItemId)!;
    assert.equal(retiredView.inService, false);
    assert.equal(retiredView.title, "Q3 supplier audit (revised)");

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. AUDIT — one row per act, atomic with the mutation, correctly attributed.
     * ═════════════════════════════════════════════════════════════════════ */
    const audit = await setup.query<{
      action: string;
      entity_type: string;
      entity_id: string;
      actor_type: string;
      actor_id: string;
      result: string;
      simulation: boolean;
      authority_source: string;
      metadata: Record<string, unknown> | null;
    }>(
      `select action, entity_type, entity_id, actor_type, actor_id, result, simulation,
              authority_source, metadata
         from audit_log where entity_type = $1 order by occurred_at, action`,
      [WORK_ITEM_ENTITY_TYPE],
    );
    assert.ok(audit.rows.length > 0, "work acts are audited");
    for (const event of audit.rows) {
      assert.equal(event.actor_type, "human", "a work act is always a human's");
      assert.equal(event.result, "committed");
      assert.equal(event.simulation, false);
      assert.equal(event.authority_source, "membership");
      assert.ok(
        [acme.userId, globex.userId].includes(event.actor_id),
        "the actor is the authenticated human, never accepted from input",
      );
    }
    const actions = new Set(audit.rows.map((event) => event.action));
    for (const expected of [
      WORK_AUDIT_RECORDED,
      WORK_AUDIT_RETITLED,
      WORK_AUDIT_STATE_DECLARED,
      WORK_AUDIT_ACCOUNTABLE_SET,
      WORK_AUDIT_RETIRED,
    ]) {
      assert.ok(actions.has(expected), `${expected} was recorded`);
    }
    /* The audit never keeps a copy of the title — history says THAT it changed, not what it said. */
    assert.ok(
      !JSON.stringify(audit.rows).includes("Q3 supplier audit"),
      "the audit ledger holds no shadow copy of the title",
    );

    /*
     * ATOMICITY. A refused mutation leaves NO audit row: the refusal happens inside the transaction
     * and nothing commits. Counted before and after a refusal that reaches the transaction.
     */
    const auditBefore = await count(setup, "audit_log");
    const refusedInTx = await recordWork(
      acmeCtx,
      { title: "Refused inside the transaction", accountableUserId: globex.userId },
      baseDeps,
    );
    assert.equal(refusedInTx.status, "refused");
    const auditAfter = await count(setup, "audit_log");
    assert.equal(auditAfter, auditBefore, "a refused mutation writes no audit row");
    const workAfterRefusal = await setup.query<{ n: number }>(
      `select count(*)::int as n from work_items where title = $1`,
      ["Refused inside the transaction"],
    );
    assert.equal(workAfterRefusal.rows[0]!.n, 0, "and no canonical row either");

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. NO GOVERNANCE DECISION, NO PERMIT, NO EXECUTION — the whole point.
     * ═════════════════════════════════════════════════════════════════════ */
    const decisionsAfter = await setup.query<{ n: number }>(
      `select count(*)::int as n from decision_records where bootstrap = false`,
    );
    assert.equal(
      decisionsAfter.rows[0]!.n,
      0,
      "recording work writes NO Governance decision — the two genesis bootstraps are all that exist",
    );
    assert.equal(
      await count(setup, "decision_records"),
      2,
      "exactly the two bootstraps this file established, and nothing WORK-1 added",
    );
    for (const table of [
      "heby_action_requests",
      "action_permits",
      "action_execution_attempts",
      "knowledge_nodes",
      "agent_mandates",
      "role_permissions",
    ]) {
      assert.equal(await count(setup, table), 0, `${table} is untouched by WORK-1`);
    }
    /* The dead work island stayed dead: not one row entered any of it. */
    for (const dead of ["tasks", "goals", "plans", "missions", "workflows", "commands", "executions"]) {
      assert.equal(await count(setup, dead), 0, `${dead} remains empty — WORK-1 activates nothing`);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 13. THE BOUNDARY MODEL IS A MEASUREMENT, NOT AN INTENTION.
     * ═════════════════════════════════════════════════════════════════════ */
    assert.deepEqual(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesTables, ["work_items"]);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesGovernanceDecision, false);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.writesActionAuthorization, false);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.agentAccountablePossible, false);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.deadWorkIslandActivated, false);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.recordsOutcome, false);
    assert.equal(ORGANIZATIONAL_WORK_AUTHORITY_MODEL.hebySourceClassAdded, false);

    console.log("PASS work1-organizational-work/work-postgres");
  } finally {
    await handle.dispose();
    await setup.end();
    await harness.dropDatabase();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
