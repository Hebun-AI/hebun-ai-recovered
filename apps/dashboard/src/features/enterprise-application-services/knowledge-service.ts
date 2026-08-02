import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadKnowledgeProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ knowledge }) =>
    requirePersistenceSuccess(await knowledge.loadKnowledge(), "Knowledge projection"));
}
