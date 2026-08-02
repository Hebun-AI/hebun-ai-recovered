import assert from "node:assert/strict";
import type { DomainEventCollection } from "../../src/features/enterprise-domain-events";
import { createInMemoryEnterpriseRepositories } from "../../src/features/enterprise-persistence";
import { createInMemoryUnitOfWork } from "../../src/features/enterprise-unit-of-work";

async function main(): Promise<void> {
const repositories = createInMemoryEnterpriseRepositories();
const unitOfWork = createInMemoryUnitOfWork(repositories);

assert.equal(Object.isFrozen(unitOfWork), true);
const compatibility = await unitOfWork.execute(async ({ resources }) => resources);
assert.equal(compatibility.value, repositories);
assert.deepEqual(compatibility.committedEvents, []);
assert.equal(
  (await unitOfWork.execute(async ({ resources: { organization } }) => (await organization.loadOrganization()).status)).value,
  "Success",
);
const successful = await unitOfWork.execute(async ({ events }) => {
  events.record(Object.freeze({
    eventId: "event-1",
    eventName: "organization.reviewed",
    aggregateType: "organization",
    aggregateId: "enterprise-1",
    aggregateVersion: 1,
    occurredAt: "2026-08-02T12:00:00.000Z",
    actor: Object.freeze({ type: "director", id: "director-1" }),
    metadata: Object.freeze({}),
    payload: Object.freeze({}),
  }));
  return "complete";
});
assert.equal(successful.value, "complete");
assert.equal(successful.committedEvents.length, 1);
let failedEvents: DomainEventCollection | undefined;
await assert.rejects(
  unitOfWork.execute(async ({ events }) => {
    failedEvents = events;
    events.record(successful.committedEvents[0]!);
    throw new Error("business failure");
  }),
  /business failure/,
);
assert.deepEqual(failedEvents?.events(), []);

console.log("in-memory UnitOfWork compatibility checks passed");
}

void main();
