import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { TimelineRepository } from "@/features/enterprise-persistence/ports";

export async function loadTimelineProjection(repository: TimelineRepository) {
  return requirePersistenceSuccess(await repository.loadTimeline(), "Timeline projection");
}

export async function loadTimelineContextProjection(repository: TimelineRepository) {
  return requirePersistenceSuccess(await repository.loadRecentContext(), "Timeline context projection");
}
