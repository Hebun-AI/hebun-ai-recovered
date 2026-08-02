import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadEnterpriseIntelligenceProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { enterpriseIntelligence } }) =>
    requirePersistenceSuccess(await enterpriseIntelligence.loadEnterpriseIntelligence(), "Enterprise Intelligence projection"));
  return execution.value;
}
