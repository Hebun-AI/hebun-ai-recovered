import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";

export interface UnitOfWork<Context> {
  execute<Result>(work: (context: Context) => Promise<Result>): Promise<Result>;
}

export type EnterpriseUnitOfWork = UnitOfWork<EnterpriseRepositoryRegistry>;
