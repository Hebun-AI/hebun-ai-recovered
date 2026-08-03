import type { DomainEvent, DomainEventName } from "@/features/enterprise-domain-events";
import type { EventBus, EventHandler, EventSubscription } from "@/features/enterprise-event-bus/contracts";

interface HandlerRegistration {
  readonly eventName: DomainEventName;
  readonly handler: EventHandler;
}

export function createInProcessEventBus(): EventBus {
  const registrations: HandlerRegistration[] = [];

  return Object.freeze({
    subscribe(eventName: DomainEventName, handler: EventHandler): EventSubscription {
      const registration = Object.freeze({ eventName, handler });
      registrations.push(registration);
      let active = true;

      return Object.freeze({
        eventName,
        unsubscribe() {
          if (!active) return;
          active = false;
          const index = registrations.indexOf(registration);
          if (index >= 0) registrations.splice(index, 1);
        },
      });
    },
    async publish(events: readonly DomainEvent[]): Promise<void> {
      const deliveryBatch = Object.freeze([...events]);
      for (const event of deliveryBatch) {
        const context = Object.freeze({ eventName: event.eventName });
        const matchingHandlers = registrations.filter(({ eventName }) => eventName === event.eventName);
        for (const { handler } of matchingHandlers) {
          await handler(event, context);
        }
      }
    },
  });
}
