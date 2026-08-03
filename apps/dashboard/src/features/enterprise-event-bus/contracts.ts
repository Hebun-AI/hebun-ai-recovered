import type { DomainEvent, DomainEventName } from "@/features/enterprise-domain-events";

export interface EventHandlerContext {
  readonly eventName: DomainEventName;
}

export type EventHandler = (
  event: DomainEvent,
  context: EventHandlerContext,
) => void | Promise<void>;

export interface EventSubscription {
  readonly eventName: DomainEventName;
  unsubscribe(): void;
}

export interface EventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe(eventName: DomainEventName, handler: EventHandler): EventSubscription;
}

export interface EventBus extends EventPublisher, EventSubscriber {}
