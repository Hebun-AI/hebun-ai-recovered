import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import { createDomainEventCollection } from "@/features/enterprise-domain-events";
import type { EnterpriseUnitOfWork, UnitOfWorkContext, UnitOfWorkResult } from "@/features/enterprise-unit-of-work/contracts";

export function createInMemoryUnitOfWork(repositories: EnterpriseRepositoryRegistry): EnterpriseUnitOfWork {
  return Object.freeze({
    async execute<Result>(
      work: (context: UnitOfWorkContext<EnterpriseRepositoryRegistry>) => Promise<Result>,
    ): Promise<UnitOfWorkResult<Result>> {
      const events = createDomainEventCollection();
      try {
        const value = await work({ resources: repositories, events });
        return Object.freeze({ value, committedEvents: events.drain() });
      } catch (error) {
        events.clear();
        throw error;
      }
    },
  });
}
