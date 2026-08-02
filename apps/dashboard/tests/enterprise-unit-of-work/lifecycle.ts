import assert from "node:assert/strict";
import type { QueryResult } from "pg";
import type { DomainEventCollection } from "../../src/features/enterprise-domain-events";
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

const recordedEvent = Object.freeze({
  eventId: "event-transaction-1",
  eventName: "decision.reviewed",
  aggregateType: "decision",
  aggregateId: "decision-1",
  aggregateVersion: 1,
  occurredAt: "2026-08-02T12:00:00.000Z",
  actor: Object.freeze({ type: "director", id: "director-1" }),
  metadata: Object.freeze({}),
  payload: Object.freeze({}),
});

async function main(): Promise<void> {
const success = createHarness();
const successUnitOfWork = createPostgresUnitOfWork(success.pool, () => ({ value: 42 }));
const successResult = await successUnitOfWork.execute(async ({ resources: { value }, events }) => {
  events.record(recordedEvent);
  return value;
});
assert.equal(successResult.value, 42);
assert.deepEqual(successResult.committedEvents, [recordedEvent]);
assert.deepEqual(success.commands, ["begin", "commit"]);
assert.equal(success.releases, 1);

const failure = createHarness();
const failureUnitOfWork = createPostgresUnitOfWork(failure.pool, () => ({}));
let failedEvents: DomainEventCollection | undefined;
await assert.rejects(
  failureUnitOfWork.execute(async ({ events }) => {
    failedEvents = events;
    events.record(recordedEvent);
    throw new Error("failed work");
  }),
  /failed work/,
);
assert.deepEqual(failure.commands, ["begin", "rollback"]);
assert.equal(failure.releases, 1);
assert.deepEqual(failedEvents?.events(), []);

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
let commitFailedEvents: DomainEventCollection | undefined;
await assert.rejects(
  commitAndRollbackUnitOfWork.execute(async ({ events }) => {
    commitFailedEvents = events;
    events.record(recordedEvent);
    return "result";
  }),
  /commit failure/,
);
assert.deepEqual(commitAndRollbackFailure.commands, ["begin", "commit", "rollback"]);
assert.equal(commitAndRollbackFailure.releases, 1);
assert.deepEqual(commitFailedEvents?.events(), []);

const cleanupFailure = createHarness(["release"]);
const cleanupFailureUnitOfWork = createPostgresUnitOfWork(cleanupFailure.pool, () => ({}));
let cleanupFailedEvents: DomainEventCollection | undefined;
await assert.rejects(cleanupFailureUnitOfWork.execute(async ({ events }) => {
  cleanupFailedEvents = events;
  events.record(recordedEvent);
  return "result";
}), /release failure/);
assert.deepEqual(cleanupFailure.commands, ["begin", "commit"]);
assert.equal(cleanupFailure.releases, 1);
assert.deepEqual(cleanupFailedEvents?.events(), []);

console.log("PostgreSQL UnitOfWork lifecycle checks passed");
}

void main();
