import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import type { DomainEvent, DomainEventCollection } from "@/features/enterprise-domain-events";

export interface UnitOfWorkContext<Context> {
  readonly resources: Context;
  readonly events: DomainEventCollection;
}

export interface UnitOfWorkResult<Result> {
  readonly value: Result;
  readonly committedEvents: readonly DomainEvent[];
}

export interface UnitOfWork<Context> {
  execute<Result>(work: (context: UnitOfWorkContext<Context>) => Promise<Result>): Promise<UnitOfWorkResult<Result>>;
}

export type EnterpriseUnitOfWork = UnitOfWork<EnterpriseRepositoryRegistry>;
