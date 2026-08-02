import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { OrganizationRepository } from "@/features/enterprise-persistence/ports";

export function loadOrganizationProjection(repository: OrganizationRepository) {
  return requirePersistenceSuccess(repository.loadOrganization(), "Organization projection");
}
