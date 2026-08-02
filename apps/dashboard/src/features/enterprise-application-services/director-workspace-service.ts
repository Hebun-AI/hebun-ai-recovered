import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadDirectorWorkspaceProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { enterpriseIntelligence } }) =>
    requirePersistenceSuccess(await enterpriseIntelligence.loadDirectorWorkspace(), "Director Workspace projection"));
  return execution.value;
}
