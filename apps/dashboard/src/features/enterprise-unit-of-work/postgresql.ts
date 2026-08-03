import { Pool } from "pg";
import { createDomainEventCollection } from "@/features/enterprise-domain-events";
import type { EventPublisher } from "@/features/enterprise-event-bus";
import { createPostgresEnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/postgresql";
import type { PostgresQueryExecutor } from "@/features/enterprise-persistence/postgresql";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import type { EnterpriseUnitOfWork, UnitOfWork, UnitOfWorkContext, UnitOfWorkResult } from "@/features/enterprise-unit-of-work/contracts";

export interface PostgresUnitOfWorkOptions {
  connectionString: string;
}

export interface PostgresUnitOfWorkSet {
  repositories: EnterpriseRepositoryRegistry;
  unitOfWork: EnterpriseUnitOfWork;
  close(): Promise<void>;
}

export interface PostgresTransactionClient extends PostgresQueryExecutor {
  release(): void;
}

export interface PostgresTransactionPool {
  connect(): Promise<PostgresTransactionClient>;
}

type ExecutionOutcome<Result> =
  | { succeeded: true; value: Result }
  | { succeeded: false; error: unknown };

export function createPostgresUnitOfWork<Context>(
  pool: PostgresTransactionPool,
  createContext: (client: PostgresTransactionClient) => Context,
  eventPublisher: EventPublisher,
): UnitOfWork<Context> {
  return Object.freeze({
    async execute<Result>(work: (context: UnitOfWorkContext<Context>) => Promise<Result>): Promise<UnitOfWorkResult<Result>> {
      const client = await pool.connect();
      const events = createDomainEventCollection();
      let outcome: ExecutionOutcome<Result> | undefined;
      let transactionStarted = false;
      try {
        await client.query("begin");
        transactionStarted = true;
        try {
          const value = await work({ resources: createContext(client), events });
          await client.query("commit");
          transactionStarted = false;
          outcome = { succeeded: true, value };
        } catch (error) {
          outcome = { succeeded: false, error };
          if (transactionStarted) {
            try {
              await client.query("rollback");
            } catch {
              // Preserve the original work or commit failure.
            }
          }
        }
      } catch (error) {
        outcome = { succeeded: false, error };
      } finally {
        try {
          client.release();
        } catch (error) {
          if (!outcome || outcome.succeeded) outcome = { succeeded: false, error };
        }
      }

      if (!outcome) throw new Error("UnitOfWork completed without an outcome.");
      if (!outcome.succeeded) {
        events.clear();
        throw outcome.error;
      }
      const committedEvents = events.drain();
      await eventPublisher.publish(committedEvents);
      return Object.freeze({ value: outcome.value, committedEvents });
    },
  });
}

export function createPostgresEnterpriseUnitOfWork(
  options: PostgresUnitOfWorkOptions,
  eventPublisher: EventPublisher,
): PostgresUnitOfWorkSet {
  const pool = new Pool({
    connectionString: options.connectionString,
    application_name: "hebun-enterprise-unit-of-work",
    max: 4,
    idleTimeoutMillis: 1000,
  });
  const repositories = createPostgresEnterpriseRepositoryRegistry({
    async query<Row>(sql: string, params?: readonly unknown[]) {
      const client = await pool.connect();
      try {
        return await client.query<Row>(sql, params);
      } finally {
        client.release();
      }
    },
  });

  return Object.freeze({
    repositories,
    unitOfWork: createPostgresUnitOfWork(pool, createPostgresEnterpriseRepositoryRegistry, eventPublisher),
    close: () => pool.end(),
  });
}
