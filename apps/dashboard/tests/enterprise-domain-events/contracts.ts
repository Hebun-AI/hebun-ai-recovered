import assert from "node:assert/strict";
import { createDomainEventCollection, createDomainEventFactory } from "../../src/features/enterprise-domain-events";

const factory = createDomainEventFactory({
  createEventId: () => "event-001",
  now: () => "2026-08-02T12:00:00.000Z",
});

const event = factory.create({
  eventName: "organization.department.updated",
  aggregateType: "department",
  aggregateId: "finance",
  aggregateVersion: 4,
  actor: { type: "director", id: "director-1" },
  correlationId: "correlation-1",
  causationId: "event-000",
  metadata: { simulation: true, source: "test" },
  payload: { readiness: 91 },
});

assert.deepEqual(event, {
  eventId: "event-001",
  eventName: "organization.department.updated",
  aggregateType: "department",
  aggregateId: "finance",
  aggregateVersion: 4,
  occurredAt: "2026-08-02T12:00:00.000Z",
  actor: { type: "director", id: "director-1" },
  correlationId: "correlation-1",
  causationId: "event-000",
  metadata: { simulation: true, source: "test" },
  payload: { readiness: 91 },
});
assert.equal(Object.isFrozen(event), true);
assert.equal(Object.isFrozen(event.actor), true);
assert.equal(Object.isFrozen(event.metadata), true);
assert.equal(Object.isFrozen(event.payload), true);

const second = factory.create({
  eventName: "knowledge.source.reviewed",
  aggregateType: "knowledge-source",
  aggregateId: "policy-1",
  aggregateVersion: 2,
  actor: { type: "reviewer", id: "reviewer-1" },
  payload: { trust: "verified" },
});
const collection = createDomainEventCollection();
collection.record(event);
collection.record(second);
assert.deepEqual(collection.events(), [event, second]);
assert.equal(Object.isFrozen(collection.events()), true);
assert.deepEqual(collection.drain(), [event, second]);
assert.deepEqual(collection.events(), []);
collection.record(event);
collection.clear();
assert.deepEqual(collection.events(), []);

console.log("Domain Event contract, factory, and collection checks passed");
