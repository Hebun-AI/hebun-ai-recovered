import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadEnterpriseIntelligenceProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ enterpriseIntelligence }) =>
    requirePersistenceSuccess(await enterpriseIntelligence.loadEnterpriseIntelligence(), "Enterprise Intelligence projection"));
}
