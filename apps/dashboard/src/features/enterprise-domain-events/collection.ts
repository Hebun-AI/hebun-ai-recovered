import type { DomainEvent } from "@/features/enterprise-domain-events/contracts";

export interface DomainEventCollection {
  record(event: DomainEvent): void;
  events(): readonly DomainEvent[];
  clear(): void;
  drain(): readonly DomainEvent[];
}

export function createDomainEventCollection(): DomainEventCollection {
  const recorded: DomainEvent[] = [];

  return Object.freeze({
    record(event: DomainEvent) {
      recorded.push(event);
    },
    events() {
      return Object.freeze([...recorded]);
    },
    clear() {
      recorded.length = 0;
    },
    drain() {
      const events = Object.freeze([...recorded]);
      recorded.length = 0;
      return events;
    },
  });
}
