import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadOrganizationProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ organization }) =>
    requirePersistenceSuccess(await organization.loadOrganization(), "Organization projection"));
}
