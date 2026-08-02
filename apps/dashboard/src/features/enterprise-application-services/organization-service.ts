import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadOrganizationProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { organization } }) =>
    requirePersistenceSuccess(await organization.loadOrganization(), "Organization projection"));
  return execution.value;
}
