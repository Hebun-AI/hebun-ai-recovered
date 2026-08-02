import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function loadTimelineProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ timeline }) =>
    requirePersistenceSuccess(await timeline.loadTimeline(), "Timeline projection"));
}

export function loadTimelineContextProjection(unitOfWork: EnterpriseUnitOfWork) {
  return unitOfWork.execute(async ({ timeline }) =>
    requirePersistenceSuccess(await timeline.loadRecentContext(), "Timeline context projection"));
}
