import assert from "node:assert/strict";
import { createDomainEventFactory } from "../../src/features/enterprise-domain-events";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";

const factory = createDomainEventFactory({
  createEventId: (() => {
    let sequence = 0;
    return () => `event-${++sequence}`;
  })(),
  now: () => "2026-08-02T12:00:00.000Z",
});
const first = factory.create({
  eventName: "organization.reviewed",
  aggregateType: "organization",
  aggregateId: "enterprise-1",
  aggregateVersion: 1,
  actor: { type: "director", id: "director-1" },
  payload: { order: 1 },
});
const second = factory.create({
  eventName: "organization.reviewed",
  aggregateType: "organization",
  aggregateId: "enterprise-1",
  aggregateVersion: 2,
  actor: { type: "director", id: "director-1" },
  payload: { order: 2 },
});

async function main(): Promise<void> {
  const bus = createInProcessEventBus();
  const deliveries: string[] = [];
  const firstSubscription = bus.subscribe("organization.reviewed", async (event, context) => {
    assert.equal(Object.isFrozen(event), true);
    assert.equal(Object.isFrozen(context), true);
    deliveries.push(`first:${event.eventId}:${context.eventName}`);
  });
  const secondSubscription = bus.subscribe("organization.reviewed", (event) => {
    deliveries.push(`second:${event.eventId}`);
  });
  const unrelatedSubscription = bus.subscribe("knowledge.reviewed", () => {
    deliveries.push("unrelated");
  });

  assert.equal(Object.isFrozen(bus), true);
  assert.equal(Object.isFrozen(firstSubscription), true);
  await bus.publish(Object.freeze([first, second]));
  assert.deepEqual(deliveries, [
    "first:event-1:organization.reviewed",
    "second:event-1",
    "first:event-2:organization.reviewed",
    "second:event-2",
  ]);

  firstSubscription.unsubscribe();
  firstSubscription.unsubscribe();
  deliveries.length = 0;
  await bus.publish([first]);
  assert.deepEqual(deliveries, ["second:event-1"]);

  secondSubscription.unsubscribe();
  unrelatedSubscription.unsubscribe();
  deliveries.length = 0;
  await bus.publish([first]);
  assert.deepEqual(deliveries, []);

  console.log("in-process Event Bus delivery checks passed");
}

void main();
