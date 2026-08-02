import assert from "node:assert/strict";
import type { QueryResult } from "pg";
import { createPostgresUnitOfWork } from "../../src/features/enterprise-unit-of-work";
import type { PostgresTransactionClient, PostgresTransactionPool } from "../../src/features/enterprise-unit-of-work";

function createHarness(failures: readonly string[] = []) {
  const commands: string[] = [];
  let releases = 0;
  const client: PostgresTransactionClient = {
    async query<Row>(sql: string): Promise<QueryResult<Row>> {
      commands.push(sql);
      if (failures.includes(sql)) throw new Error(`${sql} failure`);
      return { rows: [], rowCount: 0 };
    },
    release() {
      releases += 1;
      if (failures.includes("release")) throw new Error("release failure");
    },
  };
  const pool: PostgresTransactionPool = {
    async connect() {
      return client;
    },
  };
  return { commands, get releases() { return releases; }, pool };
}

async function main(): Promise<void> {
const success = createHarness();
const successUnitOfWork = createPostgresUnitOfWork(success.pool, () => ({ value: 42 }));
assert.equal(await successUnitOfWork.execute(async ({ value }) => value), 42);
assert.deepEqual(success.commands, ["begin", "commit"]);
assert.equal(success.releases, 1);

const failure = createHarness();
const failureUnitOfWork = createPostgresUnitOfWork(failure.pool, () => ({}));
await assert.rejects(
  failureUnitOfWork.execute(async () => {
    throw new Error("failed work");
  }),
  /failed work/,
);
assert.deepEqual(failure.commands, ["begin", "rollback"]);
assert.equal(failure.releases, 1);

const rollbackAndCleanupFailure = createHarness(["rollback", "release"]);
const rollbackAndCleanupUnitOfWork = createPostgresUnitOfWork(rollbackAndCleanupFailure.pool, () => ({}));
await assert.rejects(
  rollbackAndCleanupUnitOfWork.execute(async () => {
    throw new Error("original repository failure");
  }),
  /original repository failure/,
);
assert.deepEqual(rollbackAndCleanupFailure.commands, ["begin", "rollback"]);
assert.equal(rollbackAndCleanupFailure.releases, 1);

const commitAndRollbackFailure = createHarness(["commit", "rollback"]);
const commitAndRollbackUnitOfWork = createPostgresUnitOfWork(commitAndRollbackFailure.pool, () => ({}));
await assert.rejects(
  commitAndRollbackUnitOfWork.execute(async () => "result"),
  /commit failure/,
);
assert.deepEqual(commitAndRollbackFailure.commands, ["begin", "commit", "rollback"]);
assert.equal(commitAndRollbackFailure.releases, 1);

const cleanupFailure = createHarness(["release"]);
const cleanupFailureUnitOfWork = createPostgresUnitOfWork(cleanupFailure.pool, () => ({}));
await assert.rejects(cleanupFailureUnitOfWork.execute(async () => "result"), /release failure/);
assert.deepEqual(cleanupFailure.commands, ["begin", "commit"]);
assert.equal(cleanupFailure.releases, 1);

console.log("PostgreSQL UnitOfWork lifecycle checks passed");
}

void main();
