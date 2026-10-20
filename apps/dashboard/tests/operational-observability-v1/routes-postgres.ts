/*
 * OPERATIONAL-OBSERVABILITY-V1 — the three scheduled routes against a REAL, EMPTY database.
 *
 * A migrated database with no authorization, permit or request is the healthy idle tick: each route
 * must answer 200 with its unchanged body shape, write NO warning line, and leave every row count
 * where it was. Disposable local database, dropped on exit; no provider, no executor reached.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const SECRET = "oov1-route-secret-0123456789";

async function counts(client: Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const table of ["action_permits", "action_execution_attempts", "audit_log", "provider_observations"]) {
    const { rows } = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
    out[table] = Number(rows[0]!.n);
  }
  return out;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_oov1_routes");
  await harness.createDatabase();
  harness.migrateDatabase();
  process.env.DATABASE_URL = harness.dbUrl;
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();

  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warned.push(args.map(String).join(" "));
  try {
    const before = await counts(client);
    for (const [path, env, keys] of [
      ["observation", "HEBUN_OBSERVATION_TRIGGER_SECRET", ["attempted", "considered", "outcomes", "recorded", "status"]],
      ["machine-delivery", "HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET", ["attempted", "considered", "delivered", "failed", "refusals", "status"]],
      ["standing-issuance", "HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET", ["attempted", "considered", "failed", "issued", "refusals", "status"]],
    ] as const) {
      process.env[env] = SECRET;
      const { GET } = (await import(`../../src/app/api/${path}/scan/route`)) as {
        GET: (r: Request) => Promise<Response>;
      };
      const response = await GET(
        new Request(`https://hebun.test/api/${path}/scan`, { headers: { authorization: `Bearer ${SECRET}` } }),
      );
      assert.equal(response.status, 200, `${path}: an idle tick is 200`);
      const body = (await response.json()) as Record<string, unknown>;
      assert.deepEqual(Object.keys(body).sort(), [...keys], `${path}: the body shape is unchanged`);
      assert.equal(body.status, "scanned");
      assert.equal(body.considered, 0);
    }
    assert.deepEqual(warned, [], "a healthy idle tick writes no warning line");
    assert.deepEqual(await counts(client), before, "and no row anywhere changed");
  } finally {
    console.warn = original;
    await client.end();
    await harness.dropDatabase();
  }
  console.log("operational-observability-v1/routes-postgres: OK");
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
