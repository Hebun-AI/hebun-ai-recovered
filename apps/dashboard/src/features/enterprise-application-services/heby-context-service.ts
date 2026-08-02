import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadHebyContextProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { hebyContext } }) =>
    requirePersistenceSuccess(await hebyContext.loadHebyContext(), "Heby context projection"));
  return execution.value;
}
