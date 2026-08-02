import { Pool } from "pg";
import { createPostgresEnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/postgresql";
import type { PostgresQueryExecutor } from "@/features/enterprise-persistence/postgresql";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import type { EnterpriseUnitOfWork, UnitOfWork } from "@/features/enterprise-unit-of-work/contracts";

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
): UnitOfWork<Context> {
  return Object.freeze({
    async execute<Result>(work: (context: Context) => Promise<Result>): Promise<Result> {
      const client = await pool.connect();
      let outcome: ExecutionOutcome<Result> | undefined;
      let transactionStarted = false;
      try {
        await client.query("begin");
        transactionStarted = true;
        try {
          const value = await work(createContext(client));
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
      if (!outcome.succeeded) throw outcome.error;
      return outcome.value;
    },
  });
}

export function createPostgresEnterpriseUnitOfWork(options: PostgresUnitOfWorkOptions): PostgresUnitOfWorkSet {
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
    unitOfWork: createPostgresUnitOfWork(pool, createPostgresEnterpriseRepositoryRegistry),
    close: () => pool.end(),
  });
}
