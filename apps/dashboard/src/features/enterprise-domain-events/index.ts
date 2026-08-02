export { createDomainEventCollection } from "@/features/enterprise-domain-events/collection";
export type { DomainEventCollection } from "@/features/enterprise-domain-events/collection";
export { createDomainEventFactory } from "@/features/enterprise-domain-events/factory";
export type { DomainEventFactory, DomainEventFactoryDependencies } from "@/features/enterprise-domain-events/factory";
export type {
  ActorReference,
  AggregateId,
  AggregateType,
  AggregateVersion,
  CausationId,
  CorrelationId,
  CreateDomainEventInput,
  DomainEvent,
  DomainEventId,
  DomainEventName,
  EventMetadata,
  EventMetadataValue,
  EventPayload,
  OccurredAt,
} from "@/features/enterprise-domain-events/contracts";
