/*
 * TENANT-ARM-1 production-target pin — the arming ceremony proves WHICH database it writes to
 * before it reads an application row, through the one released G4 authority, and reaches a remote
 * control plane only through a handle opened from that proof.
 *
 *   1. The ceremony-scoped environment: remote reach is added ONLY for a ready PRODUCTION verdict,
 *      never to `process.env`, and the remote guard stays fail-closed without it — including the
 *      pulled-snapshot refusal, which still wins over the flag.
 *   2. The CLI refuses, before connecting: an unsignalled remote URL, a malformed signal, an
 *      unpinned production posture, a production posture pointed at loopback.
 *   3. Against a real (disposable) cluster: a wrong pin is refused by `preflight`; the correct pin
 *      yields a ready verdict whose handle reads the arming authority; the CLI, correctly targeted,
 *      reaches the human confirmation boundary and — refused there — writes nothing.
 *   4. Source order: posture → preflight → verified handle → first application read → writers.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import {
  assertControlPlaneTargetAllowed,
  CONTROL_PLANE_ALLOW_REMOTE_ENV,
} from "../../src/db/client.server";
import { readEffectiveTenantExternalSend } from "../../src/features/tenant-external-send-authority/read-tenant-external-send.server";
import { ceremonyControlPlaneEnv, openCeremonyControlPlane } from "../../scripts/lib/ceremony-control-plane";
import { preflight, type PreflightOk } from "../../scripts/lib/ceremony-preflight";
import {
  PRODUCTION_CEREMONY_ENV,
  PRODUCTION_CEREMONY_SIGNAL,
  PRODUCTION_TARGET_DATABASE_ENV,
  PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV,
  resolveCeremonyPosture,
} from "../../scripts/lib/production-possession";

const ROOT = process.cwd();
const SCRIPT = "scripts/tenant-arm-external-send.ts";
const REMOTE = "postgres://ceremony:unused@db.invalid:5432/hebun";

function productionPosture(sid: string, db: string) {
  const posture = resolveCeremonyPosture({
    [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL,
    [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: sid,
    [PRODUCTION_TARGET_DATABASE_ENV]: db,
  });
  assert.equal(posture.mode, "production");
  return posture as Exclude<typeof posture, { mode: "refused" | "local" }>;
}

function runCli(env: Record<string, string>, args: readonly string[] = ["--tenant=tenant-pin-arm1"]) {
  const r = spawnSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
    cwd: ROOT,
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
    input: "",
    timeout: 60_000,
  });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/* ═════════════════════════════════════════════════════════════════════════
 * 1. THE CEREMONY-SCOPED ENVIRONMENT
 * ═══════════════════════════════════════════════════════════════════════ */
function environmentScope(): void {
  const base = Object.freeze({ PATH: "/bin" }) as Record<string, string | undefined>;
  const prodReady: PreflightOk = { status: "ready", posture: productionPosture("7000000000000000001", "neondb"), banner: "b" };
  const local = resolveCeremonyPosture({});
  assert.equal(local.mode, "local");
  const localReady: PreflightOk = { status: "ready", posture: local as PreflightOk["posture"], banner: "b" };

  const prodEnv = ceremonyControlPlaneEnv(prodReady, base);
  assert.equal(prodEnv[CONTROL_PLANE_ALLOW_REMOTE_ENV], "true", "a ready PRODUCTION verdict grants remote reach to its handle");
  assert.equal(base[CONTROL_PLANE_ALLOW_REMOTE_ENV], undefined, "the base environment is never mutated");
  assert.equal(ceremonyControlPlaneEnv(localReady, base), base, "a LOCAL verdict passes the environment through unchanged");
  assert.throws(
    () => ceremonyControlPlaneEnv({ status: "refused" } as unknown as PreflightOk, base),
    /ready preflight verdict/,
    "no verdict, no handle",
  );

  const before = process.env[CONTROL_PLANE_ALLOW_REMOTE_ENV];
  ceremonyControlPlaneEnv(prodReady);
  assert.equal(process.env[CONTROL_PLANE_ALLOW_REMOTE_ENV], before, "process.env is never touched");

  /* The guard itself is unchanged and fail-closed. */
  assert.throws(() => assertControlPlaneTargetAllowed(REMOTE, base), /not authorized to reach a remote/, "no flag → refused");
  assert.doesNotThrow(() => assertControlPlaneTargetAllowed(REMOTE, prodEnv), "the verified ceremony handle may reach it");
  assert.throws(
    () => assertControlPlaneTargetAllowed(REMOTE, ceremonyControlPlaneEnv(prodReady, { ...base, SOME_SECRET: "[SENSITIVE]" })),
    /vercel env pull/,
    "a pulled snapshot is still refused even with the ceremony's flag — the snapshot check wins",
  );
}

/* ═════════════════════════════════════════════════════════════════════════
 * 2. THE CLI REFUSES BEFORE CONNECTING
 * ═══════════════════════════════════════════════════════════════════════ */
function cliRefusesBeforeConnecting(): void {
  const cases: ReadonlyArray<readonly [string, Record<string, string>, RegExp]> = [
    ["an unsignalled remote URL (the pre-fix production path)", { DATABASE_URL: REMOTE }, /local|loopback|localhost/i],
    ["a malformed production signal", { DATABASE_URL: REMOTE, [PRODUCTION_CEREMONY_ENV]: "true" }, /not the exact production signal/],
    ["an unpinned production posture", { DATABASE_URL: REMOTE, [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL }, /must pin its target/],
    [
      "a production posture pointed at loopback",
      {
        DATABASE_URL: "postgres://u:p@127.0.0.1:5432/hebun",
        [PRODUCTION_CEREMONY_ENV]: PRODUCTION_CEREMONY_SIGNAL,
        [PRODUCTION_TARGET_SYSTEM_IDENTIFIER_ENV]: "7000000000000000001",
        [PRODUCTION_TARGET_DATABASE_ENV]: "hebun",
      },
      /loopback|local/i,
    ],
    ["no DATABASE_URL", {}, /DATABASE_URL is not set/],
  ];
  for (const [label, env, pattern] of cases) {
    const r = runCli(env);
    assert.equal(r.status, 1, `${label}: exits non-zero`);
    assert.match(r.out, pattern, `${label}: refused by the shared preflight — got: ${r.out.trim()}`);
    assert.ok(!/ENOTFOUND|ECONNREFUSED|getaddrinfo/.test(r.out), `${label}: refused before any connection was attempted`);
    assert.ok(!r.out.includes("EXTERNAL-SEND ARMING CEREMONY"), `${label}: no ceremony was shown`);
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * 3. AGAINST A REAL CLUSTER
 * ═══════════════════════════════════════════════════════════════════════ */
async function againstACluster(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_tenant_arm_pin");
  await harness.createDatabase();
  harness.migrateDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  await setup.connect();
  try {
    const seeded = await seedLocalIdentity(setup, {
      companyName: "Tenant Pin",
      companySlug: "tenant-pin-arm1",
      email: "director@pin.test",
      roleType: "owner",
    });
    const id = (
      await setup.query<{ sid: string; db: string }>(
        `select system_identifier::text as sid, current_database() as db from pg_control_system()`,
      )
    ).rows[0]!;
    const counts = async () =>
      (
        await setup.query<{ a: number; d: number }>(
          `select (select count(*)::int from tenant_external_send_authorizations) a,
                  (select count(*)::int from decision_records) d`,
        )
      ).rows[0]!;
    const start = await counts();

    /* Wrong pin → refused by the released verifier; no verdict, so no handle can be opened. */
    const wrong = await preflight(setup, productionPosture(String(BigInt(id.sid) + BigInt(1)), id.db), { provenance: "none" });
    assert.equal(wrong.status, "refused", "a wrong system identifier is refused");
    const wrongDb = await preflight(setup, productionPosture(id.sid, `${id.db}_other`), { provenance: "none" });
    assert.equal(wrongDb.status, "refused", "a wrong database name is refused");

    /* Correct pin → ready; the handle opened from it reads the arming authority. */
    const ready = await preflight(setup, productionPosture(id.sid, id.db), { provenance: "none" });
    assert.equal(ready.status, "ready", "the pinned cluster is accepted");
    const handle = openCeremonyControlPlane(ready as PreflightOk, harness.dbUrl);
    try {
      const read = await readEffectiveTenantExternalSend(seeded.tenantId, { getDb: () => handle.db });
      assert.equal(read.status, "absent", "the verified handle reaches the arming authority (never armed)");
    } finally {
      await handle.dispose();
    }

    /* The CLI, correctly targeted (local posture, loopback), reaches the human boundary and stops. */
    const r = runCli({ DATABASE_URL: harness.dbUrl }, ["--tenant=tenant-pin-arm1", "--director=director@pin.test"]);
    assert.equal(r.status, 1, "without a terminal the ceremony cannot be confirmed");
    assert.ok(r.out.includes("TENANT EXTERNAL-SEND ARMING CEREMONY"), `the ceremony is shown — got: ${r.out.trim()}`);
    assert.ok(r.out.includes("no revision (never armed)"), "the current state was read through the verified handle");
    assert.match(r.out, /interactive terminal/, "it stopped at the human confirmation");

    /* Nothing written by any refusal in this file. */
    assert.deepEqual(await counts(), start, "no arming revision and no Governance decision were written");
  } finally {
    await setup.end().catch(() => {});
    await harness.dropDatabase();
  }
}

/* ═════════════════════════════════════════════════════════════════════════
 * 4. SOURCE ORDER
 * ═══════════════════════════════════════════════════════════════════════ */
function sourceOrder(): void {
  const source = readFileSync(path.join(ROOT, SCRIPT), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const at = (needle: string): number => {
    const i = code.indexOf(needle);
    assert.ok(i >= 0, `${SCRIPT} contains ${needle}`);
    return i;
  };
  const order = [
    "resolveCeremonyPosture(process.env)",
    "preflightEnvironment(posture, databaseUrl)",
    "new Client(",
    "await preflight(client, environment.posture",
    "openCeremonyControlPlane(ready, databaseUrl!)",
    "await client.query",
    "readEffectiveTenantExternalSend(w.tenant_id, { getDb })",
    "armTenantExternalSend(tenant, input, { getDb })",
  ];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(at(order[i - 1]!) < at(order[i]!), `${order[i - 1]} precedes ${order[i]}`);
  }
  assert.ok(code.includes("disarmTenantExternalSend(tenant, input, { getDb })"), "disarm writes through the verified handle");
  assert.ok(code.includes("repo: createProviderConnectivityControlRepository(handle.db)"), "the root read uses the verified handle");
  assert.ok(!/process\.env\[?\.?\s*["']?HEBUN_CONTROL_PLANE_ALLOW_REMOTE/.test(code), "the ceremony never sets the remote flag on process.env");
  assert.ok(!code.includes("HEBUN_CONTROL_PLANE_ALLOW_REMOTE"), "nor names it — reach comes only from the verdict");
  assert.match(code, /isTTY/, "the confirmation still refuses a piped answer");
}

async function main(): Promise<void> {
  environmentScope();
  sourceOrder();
  cliRefusesBeforeConnecting();
  await againstACluster();
  console.log("TENANT-ARM-1 production-target pin: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
