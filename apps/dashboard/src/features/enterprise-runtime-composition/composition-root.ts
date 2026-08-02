import { resolveEnterpriseProjectionProviderMode } from "@/features/enterprise-runtime-composition/configuration";
import { mockEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/mock-provider";
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";

export function composeEnterpriseProjectionProvider(mode?: unknown): EnterpriseProjectionProvider {
  const resolvedMode = resolveEnterpriseProjectionProviderMode(mode);

  switch (resolvedMode) {
    case "mock":
      return mockEnterpriseProjectionProvider;
  }
}

const activeEnterpriseProjectionProvider = composeEnterpriseProjectionProvider();

export function getActiveEnterpriseProjectionProvider(): EnterpriseProjectionProvider {
  return activeEnterpriseProjectionProvider;
}
