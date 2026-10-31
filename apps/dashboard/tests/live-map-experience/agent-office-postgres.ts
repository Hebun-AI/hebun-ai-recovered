/*
 * LIVE MAP PHASE 4B — THE ROUTE PARAMETER CANNOT CROSS A TENANT, PROVED AGAINST A REAL POSTGRESQL.
 *
 * The office seam compares the parameter against the list this tenant's own authority returned, so
 * another organization's agent is not refused: it is simply not there to find. A fake could not
 * prove that, because the tenant predicate lives in the released SQL.
 *
 * A disposable local database, dropped on exit. No production data.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { readLiveMapAgentOffice } from "../../src/features/live-map/read-live-map.server";

const TENANT_A = "10000000-0000-4000-8000-0000000b4b01";
const TENANT_B = "10000000-0000-4000-8000-0000000b4b02";
const OWNER_A = "20000000-0000-4000-8000-0000000b4b01";
const OWNER_B = "20000000-0000-4000-8000-0000000b4b02";
const DEPARTMENT_A = "40000000-0000-4000-8000-0000000b4b01";
const AGENT_A = "30000000-0000-4000-8000-0000000b4b01";
const AGENT_A_SUSPENDED = "30000000-0000-4000-8000-0000000b4b02";
const AGENT_A_RETIRED = "30000000-0000-4000-8000-0000000b4b03";
const AGENT_A_DISPUTED = "30000000-0000-4000-8000-0000000b4b04";
const AGENT_B = "30000000-0000-4000-8000-0000000b4b0b";
const ABSENT = "30000000-0000-4000-8000-00000000dead";

function tenantContext(tenantId: string, userId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: "auth-identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "agent-office-postgres",
    authenticatedAt: "2026-10-31T00:00:00.000Z",
  });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("live_map_agent_office");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug) values ($1, 'Tenant A', 'office-a'), ($2, 'Tenant B', 'office-b')`,
        [TENANT_A, TENANT_B],
      );
      await seed.query(
        `insert into users (id, email, name)
         values ($1, 'owner-a@example.com', 'Owner A'), ($2, 'owner-b@example.com', 'Owner B')`,
        [OWNER_A, OWNER_B],
      );
      await seed.query(
        `insert into departments (id, tenant_id, name, slug) values ($1, $2, 'Engineering', 'engineering')`,
        [DEPARTMENT_A, TENANT_A],
      );
      await seed.query(
        `insert into agents (id, tenant_id, name, department_id, agent_lifecycle_status, suspended_at, retired_at)
         values ($1, $5, 'Atlas Writer', $8::uuid, null, null, null),
                ($2, $5, 'Paused Scout', null, 'suspended', now(), null),
                ($3, $5, 'Legacy Drafter', $8::uuid, 'retired', null, now()),
                ($4, $5, 'Disputed Clerk', null, 'retired', null, null),
                ($6, $7, 'Tenant B Only', null, null, null, null)`,
        [AGENT_A, AGENT_A_SUSPENDED, AGENT_A_RETIRED, AGENT_A_DISPUTED, TENANT_A, AGENT_B, TENANT_B, DEPARTMENT_A],
      );
    } finally {
      await seed.end();
    }

    const tenantA = tenantContext(TENANT_A, OWNER_A);
    const tenantB = tenantContext(TENANT_B, OWNER_B);

    /* A reads its own agent, through the released reads and nothing else. */
    const own = await readLiveMapAgentOffice(tenantA, AGENT_A);
    assert.equal(own.status, "found", "tenant A reads its own agent");
    assert.equal(own.status === "found" && own.node.label, "Atlas Writer");
    assert.equal(own.status === "found" && own.node.status?.tone, "active");
    assert.equal(own.status === "found" && own.placement.status, "available");
    assert.equal(
      own.status === "found" && own.placement.status === "available" && own.placement.department?.slug,
      "engineering",
      "and its real department",
    );

    /* THE PROOF. Another organization's real id and a nonexistent id get the same answer. */
    const crossing = await readLiveMapAgentOffice(tenantA, AGENT_B);
    const absent = await readLiveMapAgentOffice(tenantA, ABSENT);
    assert.deepEqual(crossing, { status: "not-found" }, "tenant B's agent does not exist for tenant A");
    assert.deepEqual(absent, { status: "not-found" }, "neither does an id nobody holds");
    assert.deepEqual(crossing, absent, "and the two absences are indistinguishable");
    assert.deepEqual(await readLiveMapAgentOffice(tenantB, AGENT_A), { status: "not-found" }, "the other way too");
    assert.equal((await readLiveMapAgentOffice(tenantB, AGENT_B)).status, "found", "B still reads its own");

    /* The parameter is never cast by the database, so a malformed id is not an outage. */
    assert.deepEqual(await readLiveMapAgentOffice(tenantA, "not-a-uuid"), { status: "not-found" });

    /* Every lifecycle state, read off real rows. */
    const tone = async (agentId: string): Promise<string | undefined> => {
      const read = await readLiveMapAgentOffice(tenantA, agentId);
      return read.status === "found" ? read.node.status?.tone : read.status;
    };
    assert.equal(await tone(AGENT_A_SUSPENDED), "suspended");
    assert.equal(await tone(AGENT_A_RETIRED), "retired");
    assert.equal(await tone(AGENT_A_DISPUTED), "indeterminate");

    const historical = await readLiveMapAgentOffice(tenantA, AGENT_A_RETIRED);
    assert.equal(
      historical.status === "found" && historical.placement.status === "available" && historical.placement.state,
      "historical",
      "a retired agent's preserved department is not a current placement",
    );

    /* It wrote nothing. */
    const check = new Client({ connectionString: harness.dbUrl });
    await check.connect();
    try {
      const { rows } = await check.query<{ count: string }>("select count(*) from agents");
      assert.equal(rows[0]!.count, "5", "five agents before and after: reads create nothing");
      const audit = await check.query<{ count: string }>("select count(*) from audit_log");
      assert.equal(audit.rows[0]!.count, "0", "and no audit row");
    } finally {
      await check.end();
    }

    console.log("live-map-experience — agent office Postgres proof passed");
  } finally {
    await harness.dropDatabase();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
