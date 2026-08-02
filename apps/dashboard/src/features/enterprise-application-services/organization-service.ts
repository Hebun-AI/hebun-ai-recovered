import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { OrganizationRepository } from "@/features/enterprise-persistence/ports";

export async function loadOrganizationProjection(repository: OrganizationRepository) {
  return requirePersistenceSuccess(await repository.loadOrganization(), "Organization projection");
}
