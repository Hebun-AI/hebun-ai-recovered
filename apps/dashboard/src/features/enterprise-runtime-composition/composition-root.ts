import { createInMemoryEnterpriseRepositories } from "@/features/enterprise-persistence";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence";
import { createInProcessEventBus } from "@/features/enterprise-event-bus";
import type { EventBus } from "@/features/enterprise-event-bus";
import { createInMemoryMemoryPersistence, createPostgresMemoryPersistence } from "@/features/enterprise-memory-persistence";
import type { MemoryPersistenceComposition } from "@/features/enterprise-memory-persistence";
import { resolveEnterpriseRepositoryMode } from "@/features/enterprise-runtime-composition/configuration";
import { createEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/projection-provider";
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";
import { createInMemoryUnitOfWork, createPostgresEnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export interface EnterpriseRuntimeCompositionOptions {
  repositoryMode?: unknown;
  postgresConnectionString?: string;
}

export interface EnterpriseRuntimeComposition {
  projectionProvider: EnterpriseProjectionProvider;
  repositories: EnterpriseRepositoryRegistry;
  unitOfWork: EnterpriseUnitOfWork;
  eventBus: EventBus;
  memoryPersistence: MemoryPersistenceComposition;
  close(): Promise<void>;
}

const repositories = createInMemoryEnterpriseRepositories();
const eventBus = createInProcessEventBus();
const unitOfWork = createInMemoryUnitOfWork(repositories, eventBus);
const projectionProvider = createEnterpriseProjectionProvider(unitOfWork);
const memoryPersistence = createInMemoryMemoryPersistence(eventBus);
const activeEnterpriseRuntimeComposition: EnterpriseRuntimeComposition = Object.freeze({
  projectionProvider,
  repositories,
  unitOfWork,
  eventBus,
  memoryPersistence,
  close: async () => {
    await memoryPersistence.close();
  },
});

export function composeEnterpriseRuntime(options: EnterpriseRuntimeCompositionOptions = {}): EnterpriseRuntimeComposition {
  const resolvedMode = resolveEnterpriseRepositoryMode(options.repositoryMode);

  switch (resolvedMode) {
    case "in-memory":
      return activeEnterpriseRuntimeComposition;
    case "postgresql": {
      if (!options.postgresConnectionString) {
        throw new Error("PostgreSQL enterprise repositories require a connection string.");
      }
      const eventBus = createInProcessEventBus();
      const postgres = createPostgresEnterpriseUnitOfWork(
        { connectionString: options.postgresConnectionString },
        eventBus,
      );
      const postgresMemoryPersistence = createPostgresMemoryPersistence(options.postgresConnectionString, eventBus);
      return Object.freeze({
        projectionProvider: createEnterpriseProjectionProvider(postgres.unitOfWork),
        repositories: postgres.repositories,
        unitOfWork: postgres.unitOfWork,
        eventBus,
        memoryPersistence: postgresMemoryPersistence,
        close: async () => {
          await postgres.close();
          await postgresMemoryPersistence.close();
        },
      });
    }
  }
}

export function composeEnterpriseProjectionProvider(options?: EnterpriseRuntimeCompositionOptions): EnterpriseProjectionProvider {
  return composeEnterpriseRuntime(options).projectionProvider;
}

export function getActiveEnterpriseProjectionProvider(): EnterpriseProjectionProvider {
  return activeEnterpriseRuntimeComposition.projectionProvider;
}

export function getActiveEnterpriseRepositories(): EnterpriseRepositoryRegistry {
  return activeEnterpriseRuntimeComposition.repositories;
}

export function getActiveEnterpriseUnitOfWork(): EnterpriseUnitOfWork {
  return activeEnterpriseRuntimeComposition.unitOfWork;
}

export function getActiveEnterpriseEventBus(): EventBus {
  return activeEnterpriseRuntimeComposition.eventBus;
}

export function getActiveEnterpriseMemoryPersistence(): MemoryPersistenceComposition {
  return activeEnterpriseRuntimeComposition.memoryPersistence;
}
