/*
 * THE ORGANIZATIONAL PEOPLE REGISTER — against a REAL PostgreSQL database.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "An organization's Governance authority holder can read who is in their OWN organization, and
 *    nobody else can read anything. No other organization's people are reachable under any input.
 *    The register lists exactly the humans the SHARED eligibility rule admits — a revoked
 *    membership, an archived membership and a soft-deleted identity each disappear from it — and
 *    reading it writes nothing, anywhere."
 *
 * The pins:
 *
 *   MEMBER REGISTER != PLACEMENT REGISTER      LISTED != AUTHORIZED
 *   NOT AUTHORIZED  != NOBODY IS A MEMBER      ABSENT != NEVER A MEMBER
 *   A READ WRITES NOTHING
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
import { readPeopleRegister } from "../../src/features/auth-runtime/people-register-read.server";
import { readPeopleGroundingSource } from "../../src/features/auth-runtime/heby-people-source.server";
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

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_osa4_people");
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
      companySlug: "acme-osa4",
      email: "director@acme-osa4.test",
      userName: "Acme Director",
    });
    const globex = await seedLocalIdentity(setup, {
      companyName: "Globex",
      companySlug: "globex-osa4",
      email: "director@globex-osa4.test",
      userName: "Globex Director",
    });
    const initech = await seedLocalIdentity(setup, {
      companyName: "Initech",
      companySlug: "initech-osa4",
      email: "director@initech-osa4.test",
      userName: "Initech Director",
    });

    const acmeCtx = contextFor(acme, await sessionRowFor(setup, acme, "aaaa"), "osa4-acme");
    const globexCtx = contextFor(globex, await sessionRowFor(setup, globex, "bbbb"), "osa4-globex");
    const initechCtx = contextFor(initech, await sessionRowFor(setup, initech, "cccc"), "osa4-initech");

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

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. ACME'S PEOPLE — AND THE FOUR WAYS A HUMAN IS NOT ONE.
     * ═════════════════════════════════════════════════════════════════════ */
    const acmeTenant = { tenantId: acme.tenantId, roleId: acme.roleId };
    const engineer = await addMember(setup, acmeTenant, {
      email: "engineer@acme-osa4.test",
      displayName: "Pat Engineer",
    });
    const leaver = await addMember(setup, acmeTenant, {
      email: "leaver@acme-osa4.test",
      displayName: "Sam Leaver",
      membershipStatus: "revoked",
      revoked: true,
    });
    const archived = await addMember(setup, acmeTenant, {
      email: "archived@acme-osa4.test",
      displayName: "Alex Archived",
      membershipLifecycle: "archived",
    });
    const deletedIdentity = await addMember(setup, acmeTenant, {
      email: "gone@acme-osa4.test",
      displayName: "Chris Gone",
      userDeleted: true,
    });
    /* A member of ANOTHER organization. Not reachable from Acme under any input. */
    const globexPerson = await addMember(
      setup,
      { tenantId: globex.tenantId, roleId: globex.roleId },
      { email: "person@globex-osa4.test", displayName: "Globex Person" },
    );

    const register = await readPeopleRegister(acmeCtx, deps);
    assert.equal(register.status, "available", "the authority holder can read their own people");
    if (register.status !== "available") throw new Error("unreachable");

    const listed = register.people.map((p) => p.userId).sort();
    assert.deepEqual(
      listed,
      [acme.userId, engineer].sort(),
      "exactly the eligible members: the director and the engineer",
    );
    for (const [who, id] of [
      ["a revoked membership", leaver],
      ["an archived membership", archived],
      ["a soft-deleted identity", deletedIdentity],
      ["another organization's member", globexPerson],
    ] as const) {
      assert.ok(!listed.includes(id), `${who} is not in this organization's register`);
    }
    assert.equal(register.truncated, false, "and the bound was not reached");
    assert.match(register.detail, /2 people/, "the count is measured, not guessed");
    assert.match(register.detail, /is not employment/, "and the sentence carries its own boundary");

    /* EVERY PERSON CARRIES A MEMBERSHIP ROW AND A TIMESTAMP, AND NO NAME. */
    for (const person of register.people) {
      assert.match(person.membershipId, /^[0-9a-f-]{36}$/, "the record is the membership row");
      assert.ok(!Number.isNaN(Date.parse(person.membershipRecordedAt)), "the timestamp is real");
      assert.ok(
        !JSON.stringify(person).includes("@"),
        "no address is in the register — it selects no column of `users`",
      );
      assert.ok(
        !JSON.stringify(person).toLowerCase().includes("pat"),
        "and no name either: legibility is composed by the caller",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. TENANT ISOLATION, AND THE GATE.
     * ═════════════════════════════════════════════════════════════════════ */
    const globexRegister = await readPeopleRegister(globexCtx, deps);
    assert.equal(globexRegister.status, "available");
    if (globexRegister.status !== "available") throw new Error("unreachable");
    const globexListed = globexRegister.people.map((p) => p.userId).sort();
    assert.deepEqual(
      globexListed,
      [globex.userId, globexPerson].sort(),
      "Globex sees exactly its own two people",
    );
    for (const id of [acme.userId, engineer]) {
      assert.ok(!globexListed.includes(id), "and none of Acme's — isolation is by predicate");
    }

    /*
     * INITECH HOLDS NO GOVERNANCE AUTHORITY. It has a real member — itself — and the register
     * refuses rather than returning an empty list, because an empty list would be a lie about the
     * organization and a refusal is a fact about the caller.
     */
    const refused = await readPeopleRegister(initechCtx, deps);
    assert.equal(refused.status, "unavailable", "an unauthorized caller gets no directory");
    assert.equal(refused.status === "unavailable" && refused.reason, "not-authorized");
    assert.match(refused.detail, /Governance authority/);
    assert.match(refused.detail, /nothing here says who does or does not belong/,
      "NOT AUTHORIZED != NOBODY IS A MEMBER");

    const noTenant = await readPeopleRegister(null, deps);
    assert.equal(noTenant.status, "unavailable");
    assert.equal(noTenant.status === "unavailable" && noTenant.reason, "no-authorized-tenant-context");

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE GROUNDING PROJECTION, OVER REAL ROWS.
     * ═════════════════════════════════════════════════════════════════════ */
    const grounded = await readPeopleGroundingSource(acmeCtx, {
      readRegister: (tenant) => readPeopleRegister(tenant, deps),
      resolveNames: async (tenant, ids) => {
        const rows = await setup.query<{ id: string; display_name: string | null }>(
          `select id, display_name from users where id = any($1::uuid[])`,
          [ids as string[]],
        );
        return new Map(
          rows.rows
            .filter((r): r is { id: string; display_name: string } => r.display_name !== null)
            .map((r) => [r.id, r.display_name]),
        );
      },
    });
    assert.equal(grounded.state, "resolved");
    assert.equal(grounded.items.length, 2, "two real members reach grounding");
    const groundedText = JSON.stringify(grounded);
    assert.ok(groundedText.includes("Pat Engineer"), "the provider-safe name reaches grounding");
    assert.ok(!groundedText.includes("@"), "and no address does, from a REAL row");
    assert.ok(!groundedText.includes("Sam Leaver"), "a revoked member is not grounded on");

    /* An unauthorized session grounds on NOTHING, and says why — it never grounds on a directory. */
    const groundedRefused = await readPeopleGroundingSource(initechCtx, {
      readRegister: (tenant) => readPeopleRegister(tenant, deps),
    });
    assert.equal(groundedRefused.state, "unavailable");
    assert.equal(groundedRefused.items.length, 0);
    assert.match(groundedRefused.unavailableReason ?? "", /UNAVAILABLE IS NOT NONE/);

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. A READ WRITES NOTHING. MEASURED, NOT ASSERTED.
     * ═════════════════════════════════════════════════════════════════════ */
    const before = await setup.query<{ n: number }>(`select count(*)::int as n from audit_log`);
    const versions = await setup.query<{ n: number }>(
      `select count(*)::int as n from memberships where version <> 1`,
    );
    await readPeopleRegister(acmeCtx, deps);
    await readPeopleGroundingSource(acmeCtx, { readRegister: (t) => readPeopleRegister(t, deps) });
    const after = await setup.query<{ n: number }>(`select count(*)::int as n from audit_log`);
    assert.equal(after.rows[0]!.n, before.rows[0]!.n, "reading the register writes no audit row");
    const versionsAfter = await setup.query<{ n: number }>(
      `select count(*)::int as n from memberships where version <> 1`,
    );
    assert.equal(
      versionsAfter.rows[0]!.n,
      versions.rows[0]!.n,
      "and no membership row was versioned — the session's own row is untouched",
    );
    for (const [table, expected] of [
      ["decision_records", 2],
      ["action_permits", 0],
      ["action_execution_attempts", 0],
      ["department_placements", 0],
      ["departments", 0],
      ["work_items", 0],
    ] as const) {
      const r = await setup.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      assert.equal(r.rows[0]!.n, expected, `${table} is untouched by the people register`);
    }

    console.log("OSA-4 people register (postgres): all assertions passed.");
  } finally {
    await setup.end().catch(() => {});
    await handle.dispose().catch(() => {});
    await harness.dropDatabase();
  }
}

void main();
