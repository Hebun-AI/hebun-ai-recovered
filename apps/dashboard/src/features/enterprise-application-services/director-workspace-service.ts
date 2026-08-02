import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseIntelligenceRepository } from "@/features/enterprise-persistence/ports";

export async function loadDirectorWorkspaceProjection(repository: EnterpriseIntelligenceRepository) {
  return requirePersistenceSuccess(await repository.loadDirectorWorkspace(), "Director Workspace projection");
}
