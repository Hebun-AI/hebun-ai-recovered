import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work/contracts";

export function createInMemoryUnitOfWork(repositories: EnterpriseRepositoryRegistry): EnterpriseUnitOfWork {
  return Object.freeze({
    execute: <Result>(work: (context: EnterpriseRepositoryRegistry) => Promise<Result>) => work(repositories),
  });
}
