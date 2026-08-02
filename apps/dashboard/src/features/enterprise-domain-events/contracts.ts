export type DomainEventId = string;
export type DomainEventName = string;
export type AggregateType = string;
export type AggregateId = string;
export type AggregateVersion = number;
export type OccurredAt = string;
export type CorrelationId = string;
export type CausationId = DomainEventId;

export interface ActorReference {
  readonly type: string;
  readonly id: string;
}

export type EventMetadataValue = string | number | boolean | null;
export type EventMetadata = Readonly<Record<string, EventMetadataValue>>;
export type EventPayload = Readonly<Record<string, unknown>>;

export interface DomainEvent<Payload extends EventPayload = EventPayload> {
  readonly eventId: DomainEventId;
  readonly eventName: DomainEventName;
  readonly aggregateType: AggregateType;
  readonly aggregateId: AggregateId;
  readonly aggregateVersion: AggregateVersion;
  readonly occurredAt: OccurredAt;
  /** Identifies the originating actor; it does not grant or prove authority. */
  readonly actor: ActorReference;
  /** Groups related activity; it is distinct from direct causation. */
  readonly correlationId?: CorrelationId;
  /** Identifies a direct predecessor; it does not represent authorization. */
  readonly causationId?: CausationId;
  readonly metadata: EventMetadata;
  readonly payload: Payload;
}

export interface CreateDomainEventInput<Payload extends EventPayload> {
  readonly eventName: DomainEventName;
  readonly aggregateType: AggregateType;
  readonly aggregateId: AggregateId;
  readonly aggregateVersion: AggregateVersion;
  readonly actor: ActorReference;
  readonly correlationId?: CorrelationId;
  readonly causationId?: CausationId;
  readonly metadata?: EventMetadata;
  readonly payload: Payload;
}
