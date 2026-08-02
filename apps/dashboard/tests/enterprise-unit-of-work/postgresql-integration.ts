import assert from "node:assert/strict";
import { Client, Pool } from "pg";
import { createPostgresUnitOfWork } from "../../src/features/enterprise-unit-of-work";
import type { PostgresTransactionClient } from "../../src/features/enterprise-unit-of-work";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

interface CounterContext {
  add(amount: number): Promise<void>;
  read(): Promise<number>;
}

function createCounterContext(client: PostgresTransactionClient): CounterContext {
  return {
    async add(amount) {
      await client.query("update unit_of_work_counter set value = value + $1 where id = $2", [amount, "counter"]);
    },
    async read() {
      const result = await client.query<{ value: number }>("select value from unit_of_work_counter where id = $1", ["counter"]);
      return result.rows[0]?.value ?? 0;
    },
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_unit_of_work");
  await harness.createDatabase();
  const pool = new Pool({ connectionString: harness.dbUrl, max: 2 });
  const observer = new Client({ connectionString: harness.dbUrl });

  try {
    await observer.connect();
    await observer.query("create table unit_of_work_counter (id text primary key, value integer not null)");
    await observer.query("insert into unit_of_work_counter (id, value) values ($1, $2)", ["counter", 0]);
    const unitOfWork = createPostgresUnitOfWork(pool, createCounterContext);

    await unitOfWork.execute(async ({ resources: counter }) => {
      await counter.add(3);
      assert.equal(await counter.read(), 3);
      const outside = await observer.query<{ value: number }>("select value from unit_of_work_counter where id = $1", ["counter"]);
      assert.equal(outside.rows[0]?.value, 0);
    });
    assert.equal((await observer.query<{ value: number }>("select value from unit_of_work_counter where id = $1", ["counter"])).rows[0]?.value, 3);

    await assert.rejects(
      unitOfWork.execute(async ({ resources: counter }) => {
        await counter.add(7);
        throw new Error("rollback requested");
      }),
      /rollback requested/,
    );
    assert.equal((await observer.query<{ value: number }>("select value from unit_of_work_counter where id = $1", ["counter"])).rows[0]?.value, 3);
    console.log("PostgreSQL UnitOfWork integration checks passed");
  } finally {
    await observer.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
