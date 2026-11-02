/*
 * SCAN-FAILURE-LEGIBILITY-1 — the closed persistence-failure cause, from the error to the log line.
 *
 * 1. The classifier reads structured codes only, and every answer is one of five words.
 * 2. Each of the three scans carries the cause of an unreadable register, and nothing else.
 * 3. The warning line names the cause; SQL, parameters and messages never reach it.
 * 4. The source reads no message or stack.
 * No database: the register's `getDb` is replaced by one whose query throws.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  classifyPersistenceFailure,
  PERSISTENCE_FAILURE_CAUSES,
} from "../../src/features/cron-scan-warning/classify-persistence-failure";
import { CRON_SCAN_WARNING_EVENT, warnUnsuccessfulScan } from "../../src/features/cron-scan-warning/warn-unsuccessful-scan";
import { scanDueObservations } from "../../src/features/observation-trigger/scan-due-observations.server";
import { scanDeliverablePermits } from "../../src/features/machine-delivery-trigger/scan-deliverable-permits.server";
import { scanIssuableRequests } from "../../src/features/standing-issuance-trigger/scan-issuable-requests.server";

/* Values that must never be written anywhere: a tenant id in query params, a SQL fragment, a message. */
const TENANT = "tenant-4f2a9c1e-secret";
const SQL_FRAGMENT = "standing_observation_authorizations";
const MESSAGE = "password authentication failed for user hebun_secret_user";

/* The shape of `pg`'s DatabaseError: a message, a severity and a SQLSTATE `code`. The routes test
 * exercises real `pg` errors end to end. */
function pgError(code: string, message = MESSAGE): Error {
  return Object.assign(new Error(message), { severity: "ERROR", code, detail: `Key (tenant_id)=(${TENANT})` });
}

function drizzleWrapping(cause: unknown): DrizzleQueryError {
  return new DrizzleQueryError(`select * from ${SQL_FRAGMENT} where tenant_id = $1`, [TENANT], cause as Error);
}

function errno(code: string): Error {
  return Object.assign(new Error(`connect ${code} 10.0.0.1:5432 ${MESSAGE}`), { code });
}

function classification(): void {
  const cases: [string, unknown, string][] = [
    ["connection exception 08006", pgError("08006"), "connection"],
    ["no such database 3D000", pgError("3D000"), "connection"],
    ["too many connections 53300", pgError("53300"), "connection"],
    ["cannot connect now 57P03", pgError("57P03"), "connection"],
    ["system error 58000", pgError("58000"), "connection"],
    ["refused login 28P01", pgError("28P01"), "authentication"],
    ["undefined table 42P01", pgError("42P01"), "query"],
    ["unique violation 23505", pgError("23505"), "query"],
    ["serialization failure 40001", pgError("40001"), "query"],
    ["ECONNREFUSED", errno("ECONNREFUSED"), "connection"],
    ["ETIMEDOUT", errno("ETIMEDOUT"), "connection"],
    ["ENOTFOUND", errno("ENOTFOUND"), "connection"],
    ["EPIPE is errno, not a SQLSTATE", errno("EPIPE"), "connection"],
    ["drizzle wrapping a refused login", drizzleWrapping(pgError("28P01")), "authentication"],
    ["drizzle wrapping a socket error", drizzleWrapping(errno("ECONNRESET")), "connection"],
    ["nested two levels", new Error("outer", { cause: drizzleWrapping(pgError("42703")) }), "query"],
    /* No structured code — pg-pool's connect timeout is exactly this shape. */
    ["pg-pool connect timeout", new Error("timeout exceeded when trying to connect"), "unknown"],
    ["pg-pool terminated by timeout", new Error("Connection terminated due to connection timeout", { cause: new Error("Connection terminated unexpectedly") }), "unknown"],
    ["drizzle wrapping a codeless error", drizzleWrapping(new Error(MESSAGE)), "unknown"],
    ["lower-case code is not a SQLSTATE", pgError("08p01"), "unknown"],
    ["six characters is not a SQLSTATE", pgError("080060"), "unknown"],
    ["unknown errno", errno("EWHATEVER"), "unknown"],
    ["numeric code", Object.assign(new Error("x"), { code: 8006 }), "unknown"],
    ["a string", "connection refused", "unknown"],
    ["null", null, "unknown"],
    ["undefined", undefined, "unknown"],
  ];
  for (const [label, error, expected] of cases) {
    assert.equal(classifyPersistenceFailure(error), expected, label);
  }

  /* The cause chain is bounded: a code buried below the bound is not reached. */
  let deep: unknown = pgError("08006");
  for (let i = 0; i < 10; i += 1) deep = new Error(`level ${i}`, { cause: deep });
  assert.equal(classifyPersistenceFailure(deep), "unknown", "the cause chain is followed a bounded depth only");

  /* A cyclic cause chain terminates. */
  const cyclic = new Error("a") as Error & { cause?: unknown };
  cyclic.cause = cyclic;
  assert.equal(classifyPersistenceFailure(cyclic), "unknown");

  /* A message that LOOKS like a code decides nothing. */
  assert.equal(classifyPersistenceFailure(new Error("08006 ECONNREFUSED 28P01")), "unknown");

  assert.deepEqual([...PERSISTENCE_FAILURE_CAUSES].sort(), ["authentication", "connection", "not-configured", "query", "unknown"]);
}

type Scan = "observation" | "machine-delivery" | "standing-issuance";

function throwingDb(error: unknown): never {
  const fail = () => {
    throw error;
  };
  return { select: fail, selectDistinct: fail, execute: fail, transaction: fail } as never;
}

async function scanWith(scan: Scan, getDb: () => unknown): Promise<unknown> {
  const deps = { getDb: getDb as never };
  if (scan === "observation") return scanDueObservations(deps);
  if (scan === "machine-delivery") return scanDeliverablePermits(deps);
  return scanIssuableRequests(deps);
}

async function threeScansCarryTheCause(): Promise<void> {
  for (const scan of ["observation", "machine-delivery", "standing-issuance"] as const) {
    for (const [error, cause] of [
      [drizzleWrapping(pgError("08006")), "connection"],
      [drizzleWrapping(pgError("28P01")), "authentication"],
      [drizzleWrapping(pgError("42P01")), "query"],
      [drizzleWrapping(new Error(MESSAGE)), "unknown"],
    ] as const) {
      const result = await scanWith(scan, () => throwingDb(error));
      assert.deepEqual(result, { status: "unavailable", reason: "persistence-unavailable", cause }, `${scan}: ${cause}`);
      const serialized = JSON.stringify(result);
      for (const leak of [TENANT, SQL_FRAGMENT, MESSAGE, "select", "params"]) {
        assert.ok(!serialized.includes(leak), `${scan}: the scan result carries no ${leak}`);
      }
    }
    assert.deepEqual(
      await scanWith(scan, () => null),
      { status: "unavailable", reason: "persistence-unavailable", cause: "not-configured" },
      `${scan}: no database handle is not-configured`,
    );
  }
}

function warningLine(): void {
  for (const scan of ["observation", "machine-delivery", "standing-issuance"] as const) {
    for (const cause of PERSISTENCE_FAILURE_CAUSES) {
      const lines: string[] = [];
      assert.equal(warnUnsuccessfulScan(scan, { status: "unavailable", cause }, (l) => lines.push(l)), true);
      assert.equal(lines.length, 1);
      assert.deepEqual(JSON.parse(lines[0]!), { event: CRON_SCAN_WARNING_EVENT, scan, status: "unavailable", cause });
    }
    /* Whatever arrives at the boundary, only a closed word is written. */
    for (const bogus of [MESSAGE, `${SQL_FRAGMENT} ${TENANT}`, 42, null, { code: "08006" }, "__proto__", "toString"]) {
      const lines: string[] = [];
      warnUnsuccessfulScan(scan, { status: "unavailable", cause: bogus as never }, (l) => lines.push(l));
      assert.deepEqual(
        JSON.parse(lines[0]!),
        { event: CRON_SCAN_WARNING_EVENT, scan, status: "unavailable", cause: "unknown" },
        `${scan}: a cause outside the closed set is written as unknown`,
      );
      for (const leak of [TENANT, SQL_FRAGMENT, MESSAGE]) assert.ok(!lines[0]!.includes(leak), `${scan}: no ${leak}`);
    }
  }
}

function sourceReadsNoText(): void {
  const classifier = readFileSync("src/features/cron-scan-warning/classify-persistence-failure.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const banned of [".message", ".stack", ".query", ".params", "String(", "toString", "JSON.stringify", "console.", "import "]) {
    assert.ok(!classifier.includes(banned), `the classifier code contains no ${banned}`);
  }
  for (const file of [
    "src/features/standing-observation-authority/read-standing-observations.server.ts",
    "src/features/action-authorization/read-machine-deliverable-permits.server.ts",
    "src/features/action-authorization/read-standing-issuable-requests.server.ts",
  ]) {
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("cause: classifyPersistenceFailure(error)"), `${file} classifies its failure`);
    assert.ok(!/error\.(message|stack|query|params)/.test(src), `${file} reads no text from the error`);
    assert.ok(!src.includes("console."), `${file} logs nothing itself`);
  }
}

async function main(): Promise<void> {
  classification();
  await threeScansCarryTheCause();
  warningLine();
  sourceReadsNoText();
  console.log("scan-failure-legibility-1/classifier-and-contracts: OK");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
