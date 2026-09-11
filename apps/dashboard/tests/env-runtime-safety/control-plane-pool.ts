/*
 * CONTROL-PLANE POOL SETTINGS — what the connection is given before it is opened.
 *
 * ── THE FAILURE THIS PINS ───────────────────────────────────────────────────
 *
 * On 2026-09-11 the hourly observation cron fired at 09:00:18Z and returned 503. `ScanResult` has
 * exactly two variants and the route returns 503 only for the non-`scanned` one, so the meaning is
 * not a guess: `{ status: "unavailable", reason: "persistence-unavailable" }` — "the authorization
 * register could not be read. Nothing was attempted." The scan aborted at its FIRST database
 * operation, on a freshly created pool, before the cadence gate, before any authorization was
 * resolved, before any provider was contacted.
 *
 * ── WHY 2000ms WAS THE WRONG BUDGET ─────────────────────────────────────────
 *
 * Measured against the production database on the same morning, six consecutive
 * connect-plus-`select 1` round trips: 1086, 461, 436, 419, 407, 354 ms. The FIRST connect cost
 * 1086ms against a database that was already awake — 54% of the entire 2000ms budget. Production is
 * a serverless Postgres that suspends when idle, and a genuinely cold wake is the tail beyond that
 * first sample. 2000ms was chosen when every target was a local Postgres, and the whole repository
 * still carries it.
 *
 * ── WHY 5000ms, AND NOT A NUMBER PICKED TO PASS A TEST ──────────────────────
 *
 * 5000ms is already this repository's constant for "a database operation may take this long":
 * `canonical-read/config.ts` sets `statementTimeoutMs: 5000`. A connection IS a database operation,
 * so the budget is borrowed rather than invented. It is ~4.6x the measured warm first connect, it
 * stays well inside the serverless function budget — the three released provider transports each
 * allow 10_000ms for a single network call, so a 5s connect cannot dominate an invocation — and it
 * elapses only on failure.
 *
 * ── WHY `idleTimeoutMillis` IS NOT CHANGED ──────────────────────────────────
 *
 * It was evaluated and deliberately left at 1000. The observed failure happened on the scan's FIRST
 * database operation, against a pool that had just been constructed — no connection had yet been
 * idle, so the idle window cannot have contributed. Raising it would address a different and so far
 * UNOBSERVED problem, and this phase fixes the failure that actually happened.
 */
import assert from "node:assert/strict";
import {
  CONTROL_PLANE_POOL_SETTINGS,
  CONTROL_PLANE_ALLOW_REMOTE_ENV,
  ControlPlaneUnavailableError,
  createControlPlaneDb,
} from "../../src/db/client.server";

/** The measured first connect against the production database, in ms. See the header. */
const MEASURED_WARM_FIRST_CONNECT_MS = 1086;

const SECRET = "sup3rs3cret-pw-do-not-leak";
const LOCAL_URL = `postgres://hebun:${SECRET}@127.0.0.1:55432/hebun_r1`;
const REMOTE_URL = `postgres://hebun:${SECRET}@db.example.invalid:5432/prod`;

interface CapturedPool {
  readonly configs: Record<string, unknown>[];
  readonly createPool: (config: Record<string, unknown>) => never;
}

/**
 * A pool factory that RECORDS its configuration and never opens a socket.
 *
 * The point of injecting it is not convenience: it makes "what was the connection given" an
 * observable fact rather than a token in a source file. It also proves the ENV-1 guard runs BEFORE
 * acquisition — a refused target must leave `configs` empty, which a source-scanning test could
 * never establish.
 */
function capturing(): CapturedPool {
  const configs: Record<string, unknown>[] = [];
  return {
    configs,
    createPool(config: Record<string, unknown>): never {
      configs.push(config);
      /* Stop before anything is dialled. The throw is the test's signal, not a product path. */
      throw new Error("POOL_CAPTURED");
    },
  };
}

function buildCapturing(url: string, env: Record<string, string | undefined>): CapturedPool {
  const captured = capturing();
  try {
    createControlPlaneDb(url, env, { createPool: captured.createPool as never });
  } catch (error) {
    /*
     * TWO outcomes are expected here and both are recorded in `configs`, not in the exception:
     * the capture signal (a pool WAS built) and a released refusal (a pool was NOT). Anything else
     * is a real failure and must surface.
     */
    const captureSignal = (error as Error).message === "POOL_CAPTURED";
    const releasedRefusal = error instanceof ControlPlaneUnavailableError;
    if (!captureSignal && !releasedRefusal) throw error;
  }
  return captured;
}

/* ── The fix ───────────────────────────────────────────────────────────────── */

function theConnectBudgetCoversARealisticColdConnection(): void {
  const budget = CONTROL_PLANE_POOL_SETTINGS.connectionTimeoutMillis;
  assert.ok(
    budget > MEASURED_WARM_FIRST_CONNECT_MS,
    `the budget must exceed the measured warm first connect (${MEASURED_WARM_FIRST_CONNECT_MS}ms)`,
  );
  /*
   * A budget that merely exceeds the WARM case is not a fix — the failure was a COLD one. Four times
   * the measured warm first connect is the margin this phase claims, and 2000ms does not reach it.
   */
  assert.ok(
    budget >= MEASURED_WARM_FIRST_CONNECT_MS * 4,
    `the budget (${budget}ms) must leave room for a cold wake, not just the measured warm connect`,
  );
  assert.equal(budget, 5000, "the borrowed statementTimeoutMs budget, not an invented number");
}

function theConnectBudgetStaysInsideAnInvocation(): void {
  /*
   * The released provider transports each allow 10_000ms for ONE network call. A connect budget at
   * or above that could let a single failing connect dominate a serverless invocation that still has
   * three authorizations and their provider calls to make.
   */
  assert.ok(
    CONTROL_PLANE_POOL_SETTINGS.connectionTimeoutMillis < 10_000,
    "a connect budget must stay below the released provider call budget",
  );
}

function theIdleWindowIsUnchangedAndThatIsDeliberate(): void {
  assert.equal(
    CONTROL_PLANE_POOL_SETTINGS.idleTimeoutMillis,
    1000,
    "idle is unchanged: the observed failure was on a fresh pool's FIRST connect, so no connection " +
      "had been idle and the idle window cannot have contributed",
  );
}

function theSettingsReachTheActualPool(): void {
  /*
   * The constant existing is not the same claim as the connection receiving it. This asserts the
   * configuration handed to `pg`, which is the only thing that governs a real connect.
   */
  const captured = buildCapturing(LOCAL_URL, {});
  assert.equal(captured.configs.length, 1, "a permitted target constructs exactly one pool");
  const config = captured.configs[0]!;
  assert.equal(config.connectionTimeoutMillis, CONTROL_PLANE_POOL_SETTINGS.connectionTimeoutMillis);
  assert.equal(config.idleTimeoutMillis, CONTROL_PLANE_POOL_SETTINGS.idleTimeoutMillis);
  assert.equal(config.max, CONTROL_PLANE_POOL_SETTINGS.max);
  assert.equal(config.connectionString, LOCAL_URL, "the target is passed through unrewritten");
}

/* ── ENV-1 remains intact ──────────────────────────────────────────────────── */

function aRefusedTargetNeverReachesAPool(): void {
  /*
   * ENV-1's invariant, re-proved at the acquisition boundary rather than restated: a refusal must
   * happen BEFORE a pool exists. An empty `configs` is that proof.
   */
  for (const [label, env] of [
    ["unauthorized local process", {}],
    ["NODE_ENV=production", { NODE_ENV: "production" }],
    ["VERCEL=1", { VERCEL: "1", VERCEL_ENV: "production" }],
    ["pulled snapshot with the flag true", {
      [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true",
      HEBUN_AUTH_SESSION_DIGEST_SECRET: "[SENSITIVE]",
    }],
  ] as const) {
    const captured = buildCapturing(REMOTE_URL, env as Record<string, string | undefined>);
    assert.equal(captured.configs.length, 0, `${label}: no pool may be constructed`);
  }
}

function anAuthorizedDeployedRuntimeStillGetsAPool(): void {
  const captured = buildCapturing(REMOTE_URL, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true" });
  assert.equal(captured.configs.length, 1, "the real deployment still opens its connection");
  assert.equal(
    captured.configs[0]!.connectionTimeoutMillis,
    CONTROL_PLANE_POOL_SETTINGS.connectionTimeoutMillis,
    "and gets the same budget",
  );
}

function refusalsStaySecretSafe(): void {
  for (const env of [{}, { [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "[SENSITIVE]" }]) {
    try {
      createControlPlaneDb(REMOTE_URL, env as Record<string, string | undefined>);
      assert.fail("expected a refusal");
    } catch (error) {
      assert.ok(error instanceof ControlPlaneUnavailableError);
      const serialized = `${(error as Error).message}${(error as Error).stack ?? ""}`;
      assert.ok(!serialized.includes(SECRET), "no credential in the refusal");
      assert.ok(!serialized.includes("db.example.invalid"), "no host in the refusal");
    }
  }
}

function main(): void {
  theConnectBudgetCoversARealisticColdConnection();
  theConnectBudgetStaysInsideAnInvocation();
  theIdleWindowIsUnchangedAndThatIsDeliberate();
  theSettingsReachTheActualPool();
  aRefusedTargetNeverReachesAPool();
  anAuthorizedDeployedRuntimeStillGetsAPool();
  refusalsStaySecretSafe();
  console.log("control-plane pool settings checks passed");
}

main();
