import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadHebyContextProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ hebyContext }) =>
    requirePersistenceSuccess(await hebyContext.loadHebyContext(), "Heby context projection"));
}
