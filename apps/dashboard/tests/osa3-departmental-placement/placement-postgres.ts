/*
 * DEPARTMENTAL PLACEMENT — against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization's Governance authority holder can record which department each of their own
 *    humans works in, move them, and withdraw it — each act atomic with exactly one audit row.
 *    Nobody else can record anything. No other organization's departments or people are reachable
 *    under any input. A human whose membership ends stays named with their standing derived. And
 *    being placed grants nobody anything, anywhere."
 *
 * The pins:
 *
 *   PLACEMENT != ROLE, AUTHORITY, PERMISSION      PLACED != STILL AN ACTIVE MEMBER
 *   PLACEMENT REGISTER != MEMBER ROSTER           UNPLACED != NOT A MEMBER
 *   TENANT SAFETY IS STRUCTURAL, NOT CHECKED
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
import { recordDepartment, retireDepartment } from "../../src/features/organization-authority/write-structure.server";
import {
  placeHumanInDepartment,
  withdrawPlacement,
} from "../../src/features/organization-authority/write-placement.server";
import { readPlacementRegister } from "../../src/features/organization-authority/read-placement.server";
import { readPlacementGroundingSource } from "../../src/features/organization-authority/heby-placement-source.server";
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

async function addMember(
  client: Client,
  tenant: { tenantId: string; roleId: string },
  input: {
    email: string;
    displayName?: string | null;
    membershipStatus?: "active" | "revoked";
    revoked?: boolean;
    userDeleted?: boolean;
    membershipLifecycle?: "active" | "archived";
  },
): Promise<string> {
  const user = await client.query<{ id: string }>(
    `insert into users (email, display_name, deleted_at) values ($1, $2, $3) returning id`,
    [input.email, input.displayName ?? null, input.userDeleted ? new Date() : null],
  );
  const userId = user.rows[0]!.id;
  await client.query(
    `insert into memberships (tenant_id, user_id, role_id, status, revoked_at, lifecycle_status)
     values ($1, $2, $3, $4, $5, $6)`,
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

/** Run a statement expected to be REFUSED by the database, and return the SQLSTATE it refused with. */
async function attemptedSqlstate(
  client: Client,
  [sql, params]: readonly [string, readonly unknown[]],
): Promise<string> {
  try {
    await client.query(sql, params as unknown[]);
    return "accepted";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_osa3_placement");
  await harness.createDatabase();
  harness.migrateDatabase();

  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  const handle = createControlPlaneDb(harness.dbUrl);
  const deps = { getDb: () => handle.db };

  try {
    /* ═══════════════════════════════════════════════════════════════════════
     * 1. TWO ORGANIZATIONS WITH AUTHORITY, AND ONE WITHOUT.
     * ═════════════════════════════════════════════════════════════════════ */
    const acme = await seedLocalIdentity(setup, {
      companyName: "Acme",
      companySlug: "acme-osa3",
      email: "director@acme-osa3.test",
      userName: "Acme Director",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-osa3",
      email: "director@globex-osa3.test",
      userName: "Globex Director",
    });
    const initech = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech-osa3",
      email: "director@initech-osa3.test",
      userName: "Initech Director",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "osa3-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "osa3-globex");
    const initechCtx = contextFor(initech, await sessionRowFor(setup, initech, "cccc"), "osa3-initech");

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
      const genesis = await establishGovernanceAuthority(ctx, { justification: GENESIS_JUSTIFICATION }, deps);
      assert.equal(genesis.status, "established", "the tenant holds Governance authority");
    }

    /* Acme's departments and people. */
    const engineering = await recordDepartment(acmeCtx, { name: "Engineering", slug: "engineering" }, deps);
    assert.equal(engineering.status, "recorded");
    if (engineering.status !== "recorded") throw new Error("unreachable");
    const engineeringId = engineering.department.departmentId;

    const finance = await recordDepartment(acmeCtx, { name: "Finance", slug: "finance" }, deps);
    assert.equal(finance.status, "recorded");
    if (finance.status !== "recorded") throw new Error("unreachable");
    const financeId = finance.department.departmentId;

    const globexDept = await recordDepartment(globexCtx, { name: "Ops", slug: "ops" }, deps);
    assert.equal(globexDept.status, "recorded");
    if (globexDept.status !== "recorded") throw new Error("unreachable");

    const pat = await addMember(setup, acme, { email: "pat@acme-osa3.test", displayName: "Pat Preferred" });
    const nameless = await addMember(setup, acme, { email: "nameless@acme-osa3.test" });
    /*
     * A HUMAN THIS TEST NEVER PLACES, used only by the structural probe below.
     *
     * The probe originally borrowed a human another section had placed, and a bite-proof exposed
     * the coupling: mutate withdrawal and that human keeps an ACTIVE placement, so the partial
     * unique index fires before the foreign key and the probe silently measures the wrong
     * constraint. A probe that depends on another section's outcome is not a probe.
     */
    const unplacedProbe = await addMember(setup, acme, { email: "probe@acme-osa3.test" });
    const revoked = await addMember(setup, acme, {
      email: "left@acme-osa3.test",
      displayName: "Former Person",
      membershipStatus: "revoked",
      revoked: true,
    });
    const deletedUser = await addMember(setup, acme, {
      email: "gone@acme-osa3.test",
      displayName: "Deleted Identity",
      userDeleted: true,
    });
    const globexMember = await addMember(setup, globex, {
      email: "someone@globex-osa3.test",
      displayName: "Globex Person",
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. AN EMPTY REGISTER IS A MEASURED ANSWER, BEFORE ANYTHING IS RECORDED.
     * ═════════════════════════════════════════════════════════════════════ */
    const beforeAny = await readPlacementRegister(acmeCtx, deps);
    assert.equal(beforeAny.status, "available", "the authority answered");
    if (beforeAny.status !== "available") throw new Error("unreachable");
    assert.equal(beforeAny.placements.length, 0);
    assert.match(beforeAny.detail, /never a statement that nobody works anywhere/);

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. RECORDING A PLACEMENT — ONE ROW, ONE AUDIT ROW, ONE TRANSACTION.
     * ═════════════════════════════════════════════════════════════════════ */
    const placed = await placeHumanInDepartment(
      acmeCtx,
      { userId: pat, departmentId: engineeringId },
      deps,
    );
    assert.equal(placed.status, "recorded", "an authorized caller records a placement");
    if (placed.status !== "recorded") throw new Error("unreachable");

    const row = await setup.query<{
      id: string;
      tenant_id: string;
      user_id: string;
      department_id: string;
      version: number;
      lifecycle_status: string;
      created_by: string | null;
      created_by_type: string | null;
      same_instant: boolean;
    }>(
      `select id, tenant_id, user_id, department_id, version, lifecycle_status,
              created_by, created_by_type, (created_at = updated_at) as same_instant
         from department_placements where id = $1`,
      [placed.placement.placementId],
    );
    const stored = row.rows[0]!;
    assert.equal(stored.tenant_id, acme.tenantId, "the row belongs to the caller's organization");
    assert.equal(stored.user_id, pat);
    assert.equal(stored.department_id, engineeringId);
    assert.equal(stored.version, 1, "written once");
    assert.equal(stored.same_instant, true, "and nothing touched it afterwards");
    assert.equal(stored.lifecycle_status, "active");
    assert.equal(stored.created_by, acme.userId, "attributed to the human who acted");
    assert.equal(stored.created_by_type, "human");

    const audit = await setup.query<{ action: string; entity_type: string; entity_id: string; metadata: unknown }>(
      `select action, entity_type, entity_id, metadata from audit_log
        where entity_type = 'department_placement' order by occurred_at`,
    );
    assert.equal(audit.rowCount, 1, "EXACTLY ONE audit row, in the same transaction");
    assert.equal(audit.rows[0]!.action, "organization.placement.set");
    assert.equal(audit.rows[0]!.entity_id, placed.placement.placementId, "the subject IS the placement");
    /* NO READABLE NAME IN THE AUDIT ROW. An export must not become a copy of the identity store. */
    const metadataText = JSON.stringify(audit.rows[0]!.metadata);
    assert.ok(!metadataText.includes("Pat Preferred"), "no human name enters an audit row");
    assert.ok(!metadataText.includes("@"), "and no address either");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE READ ANSWERS IT, WITH THE DEPARTMENT AND THE DERIVED STANDING.
     * ═════════════════════════════════════════════════════════════════════ */
    const register = await readPlacementRegister(acmeCtx, deps);
    assert.equal(register.status, "available");
    if (register.status !== "available") throw new Error("unreachable");
    assert.equal(register.placements.length, 1);
    const view = register.placements[0]!;
    assert.equal(view.userId, pat);
    assert.equal(view.departmentName, "Engineering");
    assert.equal(view.departmentSlug, "engineering");
    assert.equal(view.departmentInService, true);
    assert.equal(view.currentlyActiveMember, true, "an active member reads as one");
    /* NO NAME AND NO EMAIL IS PROJECTED BY THE AUTHORITY. Legibility is Identity's. */
    assert.deepEqual(
      Object.keys(view).sort(),
      [
        "currentlyActiveMember",
        "departmentId",
        "departmentInService",
        "departmentName",
        "departmentSlug",
        "placementId",
        "userId",
      ],
      "the view carries identifiers and the department, and nothing that describes a person",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. EVERY REFUSAL, AND THEY DO NOT LEAK.
     * ═════════════════════════════════════════════════════════════════════ */
    /* Already there. */
    assert.deepEqual(
      await placeHumanInDepartment(acmeCtx, { userId: pat, departmentId: engineeringId }, deps),
      { status: "refused", reason: "already-placed" },
      "placing somebody where they already are changes nothing, and says so",
    );

    /* Not an eligible member — four different causes, ONE reason. */
    const unknown = "00000000-0000-4000-8000-000000000000";
    for (const [id, why] of [
      [revoked, "a revoked membership"],
      [deletedUser, "a soft-deleted identity"],
      [globexMember, "another organization's human"],
      [unknown, "an identifier nobody holds"],
    ] as const) {
      assert.deepEqual(
        await placeHumanInDepartment(acmeCtx, { userId: id, departmentId: engineeringId }, deps),
        { status: "refused", reason: "human-not-active-member" },
        `${why} is refused, and with the SAME reason as every other cause — never an oracle`,
      );
    }

    /* Another organization's department is indistinguishable from one that never existed. */
    for (const [id, why] of [
      [globexDept.department.departmentId, "another organization's department"],
      [unknown, "a department nobody holds"],
    ] as const) {
      assert.deepEqual(
        await placeHumanInDepartment(acmeCtx, { userId: nameless, departmentId: id }, deps),
        { status: "refused", reason: "department-unresolved" },
        `${why} is refused identically`,
      );
    }

    /* An unauthorized caller learns nothing — and the gate runs BEFORE any subject is looked at. */
    assert.deepEqual(
      await placeHumanInDepartment(
        initechCtx,
        { userId: pat, departmentId: engineeringId },
        deps,
      ),
      { status: "refused", reason: "not-authorized" },
      "a caller without Governance authority records nothing, and is told only that",
    );
    assert.deepEqual(
      await placeHumanInDepartment(null, { userId: pat, departmentId: engineeringId }, deps),
      { status: "refused", reason: "no-authorized-tenant-context" },
      "no session, no act",
    );

    /* Withdrawal of somebody who was never placed. */
    assert.deepEqual(
      await withdrawPlacement(acmeCtx, { userId: nameless }, deps),
      { status: "refused", reason: "not-placed" },
      "withdrawing a placement that does not exist is refused, not silently accepted",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. A RETIRED DEPARTMENT ACCEPTS NOBODY NEW.
     * ═════════════════════════════════════════════════════════════════════ */
    const retiredDept = await recordDepartment(acmeCtx, { name: "Legacy", slug: "legacy" }, deps);
    assert.equal(retiredDept.status, "recorded");
    if (retiredDept.status !== "recorded") throw new Error("unreachable");
    assert.equal(
      (await retireDepartment(acmeCtx, { departmentId: retiredDept.department.departmentId }, deps)).status,
      "recorded",
    );
    assert.deepEqual(
      await placeHumanInDepartment(
        acmeCtx,
        { userId: nameless, departmentId: retiredDept.department.departmentId },
        deps,
      ),
      { status: "refused", reason: "department-retired" },
      "nobody is placed into a department out of service",
    );

    /*
     * AND A DEPARTMENT RETIRED WITH SOMEBODY IN IT KEEPS THEM, LABELLED.
     *
     * The refusal above is about placing somebody NEW. An existing placement must survive its
     * department's retirement, because retiring a department does not un-work the people who were
     * in it — and hiding them would make a retirement look like a deletion.
     */
    const occupied = await recordDepartment(acmeCtx, { name: "Support", slug: "support" }, deps);
    assert.equal(occupied.status, "recorded");
    if (occupied.status !== "recorded") throw new Error("unreachable");
    assert.equal(
      (await placeHumanInDepartment(
        acmeCtx,
        { userId: nameless, departmentId: occupied.department.departmentId },
        deps,
      )).status,
      "recorded",
    );
    assert.equal(
      (await retireDepartment(acmeCtx, { departmentId: occupied.department.departmentId }, deps)).status,
      "recorded",
    );
    const withRetired = await readPlacementRegister(acmeCtx, deps);
    assert.equal(withRetired.status, "available");
    if (withRetired.status !== "available") throw new Error("unreachable");
    const occupantView = withRetired.placements.find((p) => p.userId === nameless);
    assert.ok(occupantView, "the occupant of a retired department is STILL LISTED");
    assert.equal(
      occupantView!.departmentInService,
      false,
      "and the surface is told the department is out of service, rather than the row vanishing",
    );
    assert.equal(
      (await withdrawPlacement(acmeCtx, { userId: nameless }, deps)).status,
      "withdrawn",
      "and the placement can still be withdrawn afterwards",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. A MOVE IS THE SAME ROW, AND THE VERSION SAYS SO.
     * ═════════════════════════════════════════════════════════════════════ */
    const moved = await placeHumanInDepartment(acmeCtx, { userId: pat, departmentId: financeId }, deps);
    assert.equal(moved.status, "recorded");
    if (moved.status !== "recorded") throw new Error("unreachable");
    assert.equal(moved.placement.placementId, placed.placement.placementId, "the SAME row moved");

    const afterMove = await setup.query<{ version: number; department_id: string; moved: boolean }>(
      `select version, department_id, (updated_at > created_at) as moved
         from department_placements where id = $1`,
      [placed.placement.placementId],
    );
    assert.equal(afterMove.rows[0]!.version, 2, "the version moved with it");
    assert.equal(afterMove.rows[0]!.department_id, financeId);
    assert.equal(afterMove.rows[0]!.moved, true);

    /* Scoped to the human who MOVED. The claim is about them, not about the tenant's row count. */
    const rows = await setup.query<{ n: number }>(
      `select count(*)::int as n from department_placements where tenant_id = $1 and user_id = $2`,
      [acme.tenantId, pat],
    );
    assert.equal(rows.rows[0]!.n, 1, "a move creates NO second row — one active placement per human");

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. TENANT ISOLATION, IN BOTH DIRECTIONS.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexRegister = await readPlacementRegister(globexCtx, deps);
    assert.equal(globexRegister.status, "available");
    if (globexRegister.status !== "available") throw new Error("unreachable");
    assert.equal(globexRegister.placements.length, 0, "Acme's placement is invisible to Globex");

    assert.deepEqual(
      await withdrawPlacement(globexCtx, { userId: pat }, deps),
      { status: "refused", reason: "not-placed" },
      "and Globex cannot withdraw it either — the predicate is the tenant's, not the caller's word",
    );

    /*
     * TENANT SAFETY IS STRUCTURAL. Proved by asking PostgreSQL to accept the cross-tenant row the
     * writer refuses — the composite foreign key rejects it, so the guarantee does not rest on the
     * writer being correct.
     */
    /*
     * THE SUBJECT MUST BE A HUMAN WITH NO ACTIVE PLACEMENT. Written first with `pat`, who already
     * had one, and it came back `23505` — the partial unique index fired BEFORE the foreign key, so
     * the probe was measuring the wrong constraint and would have passed for the wrong reason had
     * the expectation been loose. One defence firing first hides the one being tested.
     */
    const crossTenant = await attemptedSqlstate(setup, [
      `insert into department_placements (tenant_id, user_id, department_id) values ($1,$2,$3)`,
      [acme.tenantId, unplacedProbe, globexDept.department.departmentId],
    ]);
    assert.equal(
      crossTenant,
      "23503",
      "the DATABASE refuses another organization's department — foreign_key_violation, not a check",
    );

    /* And the partial unique index is the OTHER structural guarantee, isolated from that one. */
    const duplicate = await attemptedSqlstate(setup, [
      `insert into department_placements (tenant_id, user_id, department_id) values ($1,$2,$3)`,
      [acme.tenantId, pat, engineeringId],
    ]);
    assert.equal(
      duplicate,
      "23505",
      "and refuses a SECOND active placement for one human — unique_violation, not a pre-check",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. A HUMAN WHO LEAVES STAYS NAMED, WITH THEIR STANDING DERIVED.
     * ═════════════════════════════════════════════════════════════════════ */
    await setup.query(`update memberships set status = 'revoked', revoked_at = now() where user_id = $1`, [pat]);
    const afterLeaving = await readPlacementRegister(acmeCtx, deps);
    assert.equal(afterLeaving.status, "available");
    if (afterLeaving.status !== "available") throw new Error("unreachable");
    assert.equal(afterLeaving.placements.length, 1, "the record survives their membership");
    assert.equal(
      afterLeaving.placements[0]!.currentlyActiveMember,
      false,
      "and their standing is DERIVED, not stored — the record still names them",
    );
    await setup.query(`update memberships set status = 'active', revoked_at = null where user_id = $1`, [pat]);

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. GROUNDING OVER REAL ROWS — PROVIDER-SAFE, AND NO ADDRESS.
     * ═════════════════════════════════════════════════════════════════════ */
    const grounding = await readPlacementGroundingSource(acmeCtx, {
      readRegister: (t) => readPlacementRegister(t, deps),
      resolveNames: async () => new Map([[pat, "Pat Preferred"]]),
    });
    assert.equal(grounding.state, "resolved");
    assert.equal(grounding.items.length, 1);
    assert.match(grounding.items[0]!.detail, /Pat Preferred/);
    assert.match(grounding.items[0]!.detail, /Finance/, "the department they MOVED to, not the old one");
    assert.ok(!grounding.items[0]!.detail.includes("@"), "no address reaches grounding");

    /* And with Identity declining to name them, over the same real rows. */
    const unnamedGrounding = await readPlacementGroundingSource(acmeCtx, {
      readRegister: (t) => readPlacementRegister(t, deps),
      resolveNames: async () => new Map(),
    });
    assert.match(unnamedGrounding.items[0]!.detail, /^name unavailable \(/);
    assert.ok(!unnamedGrounding.items[0]!.detail.includes("@"));

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. WITHDRAWAL IS A LIFECYCLE, NEVER A DELETE — AND FREES THE HUMAN.
     * ═════════════════════════════════════════════════════════════════════ */
    const withdrawn = await withdrawPlacement(acmeCtx, { userId: pat }, deps);
    assert.equal(withdrawn.status, "withdrawn");

    const archived = await setup.query<{ n: number; lifecycle: string }>(
      `select count(*)::int as n, min(lifecycle_status) as lifecycle
         from department_placements where tenant_id = $1 and user_id = $2`,
      [acme.tenantId, pat],
    );
    assert.equal(archived.rows[0]!.n, 1, "the row still exists — nothing was deleted");
    assert.equal(archived.rows[0]!.lifecycle, "archived", "it was archived");

    const afterWithdrawal = await readPlacementRegister(acmeCtx, deps);
    assert.equal(afterWithdrawal.status, "available");
    if (afterWithdrawal.status !== "available") throw new Error("unreachable");
    assert.ok(
      !afterWithdrawal.placements.some((p) => p.userId === pat),
      "and the register no longer lists it",
    );

    /* THE PARTIAL INDEX FREED THEM: the same human can be placed again. */
    const replaced = await placeHumanInDepartment(
      acmeCtx,
      { userId: pat, departmentId: engineeringId },
      deps,
    );
    assert.equal(replaced.status, "recorded", "a withdrawn placement does not reserve the person");
    assert.notEqual(
      replaced.placement.placementId,
      placed.placement.placementId,
      "and it is a NEW row — the archived one is history, not a slot to reuse",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 12. PLACED != AUTHORIZED. PLACEMENT GRANTED NOBODY ANYTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    const patCtx = contextFor(
      {
        tenantId: acme.tenantId,
        userId: pat,
        authIdentityId: acme.authIdentityId,
        membershipId: acme.membershipId,
        roleId: acme.roleId,
      },
      await sessionRowFor(setup, acme, "dddd"),
      "osa3-pat",
    );
    const patAuthority = await resolveGovernanceAuthority(patCtx, deps);
    assert.equal(
      patAuthority.authorized,
      false,
      "the placed human — recorded, named, in a department — holds no Governance authority",
    );
    assert.deepEqual(
      await placeHumanInDepartment(patCtx, { userId: nameless, departmentId: engineeringId }, deps),
      { status: "refused", reason: "not-authorized" },
      "and cannot place anybody else — placement is attribution, not authority",
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 13. NON-EFFECTS. NOTHING GOVERNANCE-SHAPED WAS WRITTEN BY ANY OF THIS.
     * ═════════════════════════════════════════════════════════════════════ */
    for (const [table, expected] of [
      ["action_permits", 0],
      ["action_execution_attempts", 0],
      ["work_items", 0],
    ] as const) {
      const r = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(r.rows[0]!.n, expected, `${table} is untouched by placement`);
    }
    const placementDecisions = await setup.query<{ n: number }>(
      `select count(*)::int as n from decision_records where subject_type = 'department_placement'`,
    );
    assert.equal(placementDecisions.rows[0]!.n, 0, "no Governance decision was written for a placement");

    /* MEMBERSHIPS WERE NEVER WRITTEN. The boundary that chose a table over a column. */
    const membershipVersions = await setup.query<{ n: number }>(
      `select count(*)::int as n from memberships where version <> 1 and tenant_id = $1`,
      [acme.tenantId],
    );
    assert.equal(
      membershipVersions.rows[0]!.n,
      0,
      "not one membership row was versioned by any placement act — the session's row is untouched",
    );

    console.log("OSA-3 departmental placement (postgres): all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
