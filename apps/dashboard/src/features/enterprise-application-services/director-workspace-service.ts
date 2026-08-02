import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseIntelligenceRepository } from "@/features/enterprise-persistence/ports";

export function loadDirectorWorkspaceProjection(repository: EnterpriseIntelligenceRepository) {
  return requirePersistenceSuccess(repository.loadDirectorWorkspace(), "Director Workspace projection");
}
