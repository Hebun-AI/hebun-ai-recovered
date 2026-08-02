import { createInMemoryEnterpriseRepositories } from "@/features/enterprise-persistence";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence";
import { resolveEnterpriseProjectionProviderMode } from "@/features/enterprise-runtime-composition/configuration";
import { createMockEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/mock-provider";
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";

export interface EnterpriseRuntimeComposition {
  projectionProvider: EnterpriseProjectionProvider;
  repositories: EnterpriseRepositoryRegistry;
}

const repositories = createInMemoryEnterpriseRepositories();
const projectionProvider = createMockEnterpriseProjectionProvider(repositories);
const activeEnterpriseRuntimeComposition: EnterpriseRuntimeComposition = Object.freeze({ projectionProvider, repositories });

export function composeEnterpriseRuntime(mode?: unknown): EnterpriseRuntimeComposition {
  const resolvedMode = resolveEnterpriseProjectionProviderMode(mode);

  switch (resolvedMode) {
    case "mock":
      return activeEnterpriseRuntimeComposition;
  }
}

export function composeEnterpriseProjectionProvider(mode?: unknown): EnterpriseProjectionProvider {
  return composeEnterpriseRuntime(mode).projectionProvider;
}

export function getActiveEnterpriseProjectionProvider(): EnterpriseProjectionProvider {
  return activeEnterpriseRuntimeComposition.projectionProvider;
}

export function getActiveEnterpriseRepositories(): EnterpriseRepositoryRegistry {
  return activeEnterpriseRuntimeComposition.repositories;
}
