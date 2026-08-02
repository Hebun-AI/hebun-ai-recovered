import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export async function loadTimelineProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { timeline } }) =>
    requirePersistenceSuccess(await timeline.loadTimeline(), "Timeline projection"));
  return execution.value;
}

export async function loadTimelineContextProjection(unitOfWork: EnterpriseUnitOfWork) {
  const execution = await unitOfWork.execute(async ({ resources: { timeline } }) =>
    requirePersistenceSuccess(await timeline.loadRecentContext(), "Timeline context projection"));
  return execution.value;
}
