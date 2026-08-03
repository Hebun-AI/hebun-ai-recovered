import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import { createDomainEventCollection } from "@/features/enterprise-domain-events";
import type { EventPublisher } from "@/features/enterprise-event-bus";
import type { EnterpriseUnitOfWork, UnitOfWorkContext, UnitOfWorkResult } from "@/features/enterprise-unit-of-work/contracts";

export function createInMemoryUnitOfWork(
  repositories: EnterpriseRepositoryRegistry,
  eventPublisher: EventPublisher,
): EnterpriseUnitOfWork {
  return Object.freeze({
    async execute<Result>(
      work: (context: UnitOfWorkContext<EnterpriseRepositoryRegistry>) => Promise<Result>,
    ): Promise<UnitOfWorkResult<Result>> {
      const events = createDomainEventCollection();
      try {
        const value = await work({ resources: repositories, events });
        const committedEvents = events.drain();
        await eventPublisher.publish(committedEvents);
        return Object.freeze({ value, committedEvents });
      } catch (error) {
        events.clear();
        throw error;
      }
    },
  });
}
