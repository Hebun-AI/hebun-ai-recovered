import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadDecisionProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { decision } }) =>
    requirePersistenceSuccess(await decision.loadDecisions(), "Decision projection"));
  return execution.value;
}
