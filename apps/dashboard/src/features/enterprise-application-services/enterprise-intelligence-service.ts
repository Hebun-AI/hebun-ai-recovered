import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseIntelligenceRepository } from "@/features/enterprise-persistence/ports";

export function loadEnterpriseIntelligenceProjection(repository: EnterpriseIntelligenceRepository) {
  return requirePersistenceSuccess(repository.loadEnterpriseIntelligence(), "Enterprise Intelligence projection");
}
