/*
 * SCAN-FAILURE-LEGIBILITY-1 — the three scheduled routes against REAL databases that fail.
 *
 * Each route must keep its HTTP contract exactly (503, `{ status, reason }`) while its one warning
 * line names the closed cause. The healthy idle tick and a refused bearer still write nothing.
 *
 *   refused port            → connection      (Node errno ECONNREFUSED)
 *   database does not exist → connection      (SQLSTATE 3D000)
 *   empty, unmigrated       → query           (SQLSTATE 42P01)
 *   migrated, empty         → 200, no line
 *
 * Disposable local cluster only; databases dropped on exit; no provider, no executor reached.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { disposeControlPlaneDb } from "../../src/db/client.server";
import { CRON_SCAN_WARNING_EVENT } from "../../src/features/cron-scan-warning/warn-unsuccessful-scan";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const SECRET = "sfl1-route-secret-0123456789";
const ROUTES = [
  ["observation", "HEBUN_OBSERVATION_TRIGGER_SECRET"],
  ["machine-delivery", "HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET"],
  ["standing-issuance", "HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET"],
] as const;

type Get = (r: Request) => Promise<Response>;

async function routes(): Promise<Record<string, Get>> {
  const out: Record<string, Get> = {};
  for (const [path, env] of ROUTES) {
    process.env[env] = SECRET;
    out[path] = ((await import(`../../src/app/api/${path}/scan/route`)) as { GET: Get }).GET;
  }
  return out;
}

function request(path: string, bearer = SECRET): Request {
  return new Request(`https://hebun.test/api/${path}/scan`, { headers: { authorization: `Bearer ${bearer}` } });
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_sfl1_routes");
  const unmigrated = createDisposablePostgresHarness("hebun_sfl1_unmigrated");
  await harness.createDatabase();
  harness.migrateDatabase();
  const migratedUrl = harness.dbUrl;

  const warned: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => void warned.push(args.map(String).join(" "));
  const GET = await routes();

  async function failingCase(label: string, url: string, cause: string): Promise<void> {
    await disposeControlPlaneDb();
    process.env.DATABASE_URL = url;
    const host = new URL(url);
    for (const [path] of ROUTES) {
      warned.length = 0;
      const response = await GET[path]!(request(path));
      assert.equal(response.status, 503, `${label}/${path}: still 503`);
      const text = await response.text();
      assert.equal(text, JSON.stringify({ status: "unavailable", reason: "persistence-unavailable" }), `${label}/${path}: body byte-identical`);
      assert.equal(warned.length, 1, `${label}/${path}: exactly one line`);
      assert.deepEqual(JSON.parse(warned[0]!), { event: CRON_SCAN_WARNING_EVENT, scan: path, status: "unavailable", cause }, `${label}/${path}: ${cause}`);
      for (const leak of [host.hostname, host.port, host.pathname.slice(1), "postgres", "select", "from ", SECRET].filter(Boolean)) {
        assert.ok(!warned[0]!.includes(leak) && !text.includes(leak), `${label}/${path}: no ${leak} in line or body`);
      }
    }
  }

  try {
    await failingCase("refused port", "postgresql://postgres@127.0.0.1:1/hebun_sfl1_refused", "connection");

    const absent = new URL(harness.adminUrl);
    absent.pathname = `/hebun_sfl1_absent_${randomBytes(4).toString("hex")}`;
    await failingCase("absent database", absent.toString(), "connection");

    await disposeControlPlaneDb();
    await unmigrated.createDatabase();
    await failingCase("unmigrated database", unmigrated.dbUrl, "query");
    await disposeControlPlaneDb();
    await unmigrated.dropDatabase();

    /* Healthy idle tick and a refused bearer: unchanged silence. */
    await disposeControlPlaneDb();
    process.env.DATABASE_URL = migratedUrl;
    for (const [path] of ROUTES) {
      warned.length = 0;
      const refused = await GET[path]!(request(path, "wrong"));
      assert.equal(refused.status, 401, `${path}: 401 unchanged`);
      assert.equal(await refused.text(), "Unauthorized");
      const healthy = await GET[path]!(request(path));
      assert.equal(healthy.status, 200, `${path}: healthy idle tick is 200`);
      const body = (await healthy.json()) as Record<string, unknown>;
      assert.equal(body.status, "scanned");
      assert.equal(body.considered, 0, `${path}: empty tick`);
      assert.ok(!("cause" in body), `${path}: the body never carries a cause`);
      assert.deepEqual(warned, [], `${path}: 401 and a healthy empty tick write nothing`);
    }
  } finally {
    console.warn = original;
    await disposeControlPlaneDb().catch(() => {});
    process.env.DATABASE_URL = migratedUrl;
    await harness.dropDatabase();
  }
  console.log("scan-failure-legibility-1/routes-postgres: OK");
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
