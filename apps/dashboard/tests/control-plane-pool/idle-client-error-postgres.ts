/**
 * PACKAGE 3 M2-R9 — A SERVER-TERMINATED IDLE CONNECTION DOES NOT KILL THE PROCESS.
 *
 * pg-pool re-emits an idle client's error on the pool, and an EventEmitter "error" with no listener
 * throws. The control-plane pool had none, so any backend the server terminated while idle — an admin
 * shutdown (57P01), a failover, a disposable test database being dropped — was an uncaught exception.
 * In CI it surfaced as l2b-agent-suspension S10 dying on 57P01 before its assertion was printed.
 *
 *   1. An idle client terminated by the server: no uncaught exception, one closed-value log line that
 *      names the code and nothing else, and the handle keeps working on a fresh connection.
 *   2. An ACTIVE query whose backend is terminated still rejects to its caller with 57P01.
 *   3. A transaction whose backend is terminated rejects and commits nothing, and its checked-out
 *      client (which pg-pool does not listen on) is not an uncaught exception either.
 *   4. dispose() still ends the pool: later use is refused.
 *   5. The log line: a known code is classified, anything else is "unrecognized", never silent.
 *
 * Every termination is targeted at a backend this file opened, on its own disposable database.
 */
import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { sql } from "drizzle-orm";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, controlPlanePoolErrorLogLine } from "../../src/db/client.server";

const until = async (probe: () => Promise<boolean>, what: string): Promise<void> => {
  for (let i = 0; i < 200; i++) {
    if (await probe()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`timed out waiting for ${what}`);
};

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_pool_idle_error");
  await harness.createDatabase();
  const admin = new Client({ connectionString: harness.dbUrl });
  await admin.connect();

  let pool: Pool | undefined;
  const handle = createControlPlaneDb(harness.dbUrl, process.env, {
    createPool: (config) => (pool = new Pool(config)),
  });

  const uncaught: unknown[] = [];
  const onUncaught = (error: unknown) => uncaught.push(error);
  process.on("uncaughtException", onUncaught);
  const logged: string[] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));

  const backends = async (state?: string): Promise<number[]> =>
    (
      await admin.query<{ pid: number }>(
        `select pid from pg_stat_activity
          where datname = current_database() and application_name = 'hebun-control-plane'
            and ($1::text is null or state = $1)`,
        [state ?? null],
      )
    ).rows.map((r) => r.pid);
  const terminate = async (pids: number[]) => {
    for (const pid of pids) await admin.query(`select pg_terminate_backend($1)`, [pid]);
  };

  try {
    assert.ok(pool, "the pool was built through the seam");
    await admin.query(`create table pool_probe (id int primary key)`);

    /* ── 1. AN IDLE CLIENT TERMINATED BY THE SERVER ── */
    await handle.db.execute(sql`select 1`);
    assert.equal((pool as unknown as { idleCount: number }).idleCount, 1, "one idle client");
    const idle = await backends("idle");
    assert.equal(idle.length, 1);
    await terminate(idle);
    await until(async () => (pool as unknown as { idleCount: number }).idleCount === 0, "pg-pool to drop the dead client");
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(uncaught, [], "a terminated idle connection is not an uncaught exception");
    assert.deepEqual(
      logged.map((l) => JSON.parse(l)),
      [{ event: "control-plane-pool-client-error", code: "57P01", class: "server-terminated" }],
      "exactly one closed-value log line",
    );
    for (const secret of [harness.dbUrl, "127.0.0.1", "postgres@", "terminating connection"]) {
      assert.ok(!logged.join("\n").includes(secret), `the log line carries no ${secret}`);
    }
    assert.deepEqual((await handle.db.execute(sql`select 2 as n`)).rows, [{ n: 2 }], "the handle keeps working");

    /* ── 2. AN ACTIVE QUERY STILL REJECTS TO ITS CALLER ── */
    const active = handle.db.execute(sql`select pg_sleep(30)`).then(
      () => ({ settled: "resolved" as const }),
      (error: unknown) => ({ settled: "rejected" as const, code: (error as { cause?: { code?: unknown } }).cause?.code }),
    );
    await until(async () => (await backends("active")).length === 1, "the query to be running");
    await terminate(await backends("active"));
    assert.deepEqual(await active, { settled: "rejected", code: "57P01" }, "an active query's error reaches its caller");

    /* ── 3. A TERMINATED TRANSACTION REJECTS AND COMMITS NOTHING ── */
    const tx = handle.db
      .transaction(async (t) => {
        await t.execute(sql`insert into pool_probe values (1)`);
        await t.execute(sql`select pg_sleep(30)`);
      })
      .then(() => "committed", () => "rejected");
    await until(async () => (await backends("active")).length === 1, "the transaction to be running");
    await terminate(await backends("active"));
    assert.equal(await tx, "rejected", "a terminated transaction is a failure, not a success");
    assert.equal((await admin.query(`select count(*)::int n from pool_probe`)).rows[0].n, 0, "and it committed nothing");
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(uncaught, [], "a transaction's lost client is not an uncaught exception either");
    assert.ok(
      logged.slice(1).some((l) => JSON.parse(l).class === "connection-lost"),
      "the checked-out client's lost connection is recorded, not swallowed",
    );
    for (const l of logged) assert.ok(JSON.parse(l).class !== "unrecognized", `every observed error is classified: ${l}`);

    /* ── 4. dispose() STILL ENDS THE POOL ── */
    await handle.dispose();
    await assert.rejects(() => handle.db.execute(sql`select 1`), "a disposed handle refuses work");

    /* ── 5. THE LOG LINE IS CLOSED-VALUE AND NEVER SILENT ── */
    const line = (e: unknown) => JSON.parse(controlPlanePoolErrorLogLine(e));
    assert.equal(line({ code: "57P01" }).class, "server-terminated");
    assert.equal(line(Object.assign(new Error("read ECONNRESET 10.0.0.1:5432"), { code: "ECONNRESET" })).class, "connection-lost");
    assert.deepEqual(line(new Error("Connection terminated unexpectedly")), { event: "control-plane-pool-client-error", code: null, class: "connection-lost" });
    assert.ok(!controlPlanePoolErrorLogLine(Object.assign(new Error("read ECONNRESET 10.0.0.1:5432"), { code: "ECONNRESET" })).includes("10.0.0.1"), "no address");
    for (const unknown of [{ code: "XX000", message: "secret payload" }, { code: "not a code; drop table" }, new Error("no code"), null, "57P01"]) {
      const parsed = line(unknown);
      assert.equal(parsed.class, "unrecognized", `unrecognized: ${JSON.stringify(unknown)}`);
      assert.ok(!JSON.stringify(parsed).includes("secret") && !JSON.stringify(parsed).includes("drop table"), "no free text");
    }
    assert.equal(line({ code: "XX000" }).code, "XX000", "an unrecognized but well-formed code is still named");
    assert.equal(line({ code: "not a code; drop table" }).code, null, "a malformed code is not echoed");
  } finally {
    console.error = realError;
    process.off("uncaughtException", onUncaught);
    await handle.dispose().catch(() => undefined);
    await admin.end().catch(() => undefined);
    await harness.dropDatabase();
  }
  console.log("control-plane-pool/idle-client-error-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
