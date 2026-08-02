import type {
  CreateDomainEventInput,
  DomainEvent,
  DomainEventId,
  EventPayload,
  OccurredAt,
} from "@/features/enterprise-domain-events/contracts";

export interface DomainEventFactoryDependencies {
  createEventId(): DomainEventId;
  now(): OccurredAt;
}

export interface DomainEventFactory {
  create<Payload extends EventPayload>(input: CreateDomainEventInput<Payload>): DomainEvent<Payload>;
}

export function createDomainEventFactory(dependencies: DomainEventFactoryDependencies): DomainEventFactory {
  return Object.freeze({
    create<Payload extends EventPayload>(input: CreateDomainEventInput<Payload>): DomainEvent<Payload> {
      const actor = Object.freeze({ ...input.actor });
      const metadata = Object.freeze({ ...(input.metadata ?? {}) });
      const payload = Object.freeze({ ...input.payload }) as Payload;

      return Object.freeze({
        eventId: dependencies.createEventId(),
        eventName: input.eventName,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        aggregateVersion: input.aggregateVersion,
        occurredAt: dependencies.now(),
        actor,
        correlationId: input.correlationId,
        causationId: input.causationId,
        metadata,
        payload,
      });
    },
  });
}
