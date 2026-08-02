import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadDecisionProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ decision }) =>
    requirePersistenceSuccess(await decision.loadDecisions(), "Decision projection"));
}
