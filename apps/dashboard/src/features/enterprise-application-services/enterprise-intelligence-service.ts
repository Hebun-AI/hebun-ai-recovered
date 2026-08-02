import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseIntelligenceRepository } from "@/features/enterprise-persistence/ports";

export async function loadEnterpriseIntelligenceProjection(repository: EnterpriseIntelligenceRepository) {
  return requirePersistenceSuccess(await repository.loadEnterpriseIntelligence(), "Enterprise Intelligence projection");
}
