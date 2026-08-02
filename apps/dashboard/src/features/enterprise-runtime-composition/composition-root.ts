import { createInMemoryEnterpriseRepositories, createPostgresEnterpriseRepositories } from "@/features/enterprise-persistence";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence";
import { resolveEnterpriseRepositoryMode } from "@/features/enterprise-runtime-composition/configuration";
import { createEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/projection-provider";
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";

export interface EnterpriseRuntimeCompositionOptions {
  repositoryMode?: unknown;
  postgresConnectionString?: string;
}

export interface EnterpriseRuntimeComposition {
  projectionProvider: EnterpriseProjectionProvider;
  repositories: EnterpriseRepositoryRegistry;
  close(): Promise<void>;
}

const repositories = createInMemoryEnterpriseRepositories();
const projectionProvider = createEnterpriseProjectionProvider(repositories);
const activeEnterpriseRuntimeComposition: EnterpriseRuntimeComposition = Object.freeze({
  projectionProvider,
  repositories,
  close: async () => undefined,
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
      const postgres = createPostgresEnterpriseRepositories({ connectionString: options.postgresConnectionString });
      return Object.freeze({
        projectionProvider: createEnterpriseProjectionProvider(postgres.repositories),
        repositories: postgres.repositories,
        close: postgres.close,
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
