import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { TimelineRepository } from "@/features/enterprise-persistence/ports";

export function loadTimelineProjection(repository: TimelineRepository) {
  return requirePersistenceSuccess(repository.loadTimeline(), "Timeline projection");
}

export function loadTimelineContextProjection(repository: TimelineRepository) {
  return requirePersistenceSuccess(repository.loadRecentContext(), "Timeline context projection");
}
