import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadDirectorWorkspaceProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ enterpriseIntelligence }) =>
    requirePersistenceSuccess(await enterpriseIntelligence.loadDirectorWorkspace(), "Director Workspace projection"));
}
