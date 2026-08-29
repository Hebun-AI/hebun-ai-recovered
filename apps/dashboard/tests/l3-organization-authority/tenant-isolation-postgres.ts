/*
 * L3 — TENANT ISOLATION, PROVED AGAINST A REAL POSTGRESQL DATABASE.
 *
 * The injected-handle suite proves the branches. It cannot prove the SQL. This runs the actual
 * queries against the actual migrated schema with two real organizations and real memberships, so
 * "tenant A never sees tenant B" is a property of the statements rather than of a fake.
 *
 * It also proves the two things a fake can always be made to say and a database cannot:
 *   - a member count is scoped to the reader's own organization, so a bigger neighbour cannot
 *     inflate it;
 *   - the reads WROTE NOTHING — the row counts are identical afterwards.
 *
 * Uses a disposable local database, dropped on exit. No production data is touched.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { readOrganizationAuthority } from "../../src/features/organization-authority/read-organization.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const TENANT_RETIRED = "10000000-0000-4000-8000-00000000c001";

const ctx = (tenantId: string): TenantContext =>
  ({ tenantId, userId: "20000000-0000-4000-8000-00000000f001" }) as unknown as TenantContext;

async function seed(client: Client): Promise<void> {
  await client.query(
    `insert into companies (id, name, slug, provisioning_source)
     values ($1, 'Acme Operating Company', 'acme', 'production-operator-ceremony'),
            ($2, 'Globex Holdings', 'globex', 'local-operator-ceremony')`,
    [TENANT_A, TENANT_B],
  );
  /* A soft-deleted organization. A live session naming it must get `organization-not-found`. */
  await client.query(
    `insert into companies (id, name, slug, lifecycle_status)
     values ($1, 'Retired Co', 'retired', 'archived')`,
    [TENANT_RETIRED],
  );

  /* Three humans in A, one in B — so a leak would be visible as a WRONG NUMBER, not just a wrong row. */
  const users: string[] = [];
  for (let i = 0; i < 4; i += 1) {
    const row = await client.query<{ id: string }>(
      `insert into users (email, display_name) values ($1, $2) returning id`,
      [`person-${i}@example.test`, `Person ${i}`],
    );
    users.push(row.rows[0]!.id);
  }
  await client.query(
    `insert into memberships (tenant_id, user_id) values ($1,$2),($1,$3),($1,$4),($5,$6)`,
    [TENANT_A, users[0], users[1], users[2], TENANT_B, users[3]],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_l3_organization");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    await seed(client);

    const handle = createControlPlaneDb(harness.dbUrl);
    const deps = { getDb: () => handle.db };

    try {
      /* ── 1 · EACH ORGANIZATION SEES ITSELF, AND ONLY ITSELF ─────────────── */
      const a = await readOrganizationAuthority(ctx(TENANT_A), deps);
      assert.equal(a.status, "available", "A's own organization is readable");
      if (a.status !== "available") throw new Error("unreachable");
      assert.equal(a.organization.name, "Acme Operating Company");
      assert.equal(a.organization.slug, "acme");
      assert.equal(a.organization.provenance, "production-operator-ceremony");
      assert.equal(a.organization.humanMemberCount, 3, "A counts its own three members");

      const b = await readOrganizationAuthority(ctx(TENANT_B), deps);
      assert.equal(b.status, "available", "B's own organization is readable");
      if (b.status !== "available") throw new Error("unreachable");
      assert.equal(b.organization.name, "Globex Holdings");
      assert.equal(b.organization.provenance, "local-operator-ceremony");
      assert.equal(
        b.organization.humanMemberCount,
        1,
        "B counts ONE — a neighbour's three members never inflate it",
      );

      /* Nothing of A's appears in B's answer, checked on the serialized value. */
      assert.ok(
        !JSON.stringify(b).includes("Acme") && !JSON.stringify(b).includes("acme"),
        "no trace of another organization reaches this one",
      );

      /* ── 2 · PROVENANCE IS ABSENT, NOT INVENTED ────────────────────────── */
      const retiredRow = await client.query<{ provisioning_source: string | null }>(
        `select provisioning_source from companies where id = $1`,
        [TENANT_RETIRED],
      );
      assert.equal(retiredRow.rows[0]?.provisioning_source, null, "the fixture records no origin");

      /* ── 3 · A SOFT-DELETED ORGANIZATION IS NOT FOUND, NOT EMPTY ───────── */
      const retired = await readOrganizationAuthority(ctx(TENANT_RETIRED), deps);
      assert.equal(
        retired.status,
        "unavailable",
        "an archived organization is organization-not-found, never a live answer",
      );
      if (retired.status !== "unavailable") throw new Error("unreachable");
      assert.equal(retired.reason, "organization-not-found");

      /* ── 4 · AN UNKNOWN TENANT IS REFUSED, NOT ANSWERED WITH SOMEBODY ELSE ─ */
      const unknown = await readOrganizationAuthority(
        ctx("10000000-0000-4000-8000-00000000dead"),
        deps,
      );
      assert.equal(
        unknown.status,
        "unavailable",
        "an unknown tenant id is organization-not-found, never somebody else's organization",
      );
      if (unknown.status !== "unavailable") throw new Error("unreachable");
      assert.equal(unknown.reason, "organization-not-found");

      /* A malformed tenant id is a failed read, never a match. */
      const malformed = await readOrganizationAuthority(ctx("not-a-uuid"), deps);
      assert.equal(malformed.status, "unavailable", "a malformed tenant id matches nothing");

      /* ── 5 · L3 WROTE NOTHING ──────────────────────────────────────────── */
      const counts = await client.query<{ companies: string; memberships: string; orgs: string; depts: string }>(
        `select (select count(*)::text from companies)   as companies,
                (select count(*)::text from memberships) as memberships,
                (select count(*)::text from organizations) as orgs,
                (select count(*)::text from departments)   as depts`,
      );
      assert.equal(counts.rows[0]?.companies, "3", "no organization was created or removed by the reads");
      assert.equal(counts.rows[0]?.memberships, "4", "no membership was created or removed");
      /*
       * AND THE STRUCTURE TABLES ARE STILL EMPTY. L3 did not activate them, and the seam that
       * reports them unavailable is telling the truth about this database too.
       */
      assert.equal(counts.rows[0]?.orgs, "0", "organizations remains unwritten");
      assert.equal(counts.rows[0]?.depts, "0", "departments remains unwritten");
    } finally {
      await handle.dispose();
      await client.end().catch(() => {});
    }

    console.log("l3 organization authority — tenant-isolation-postgres checks passed");
  } finally {
    await harness.dropDatabase();
  }
}

void main();
