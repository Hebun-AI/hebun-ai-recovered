import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadKnowledgeProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { knowledge } }) =>
    requirePersistenceSuccess(await knowledge.loadKnowledge(), "Knowledge projection"));
  return execution.value;
}
