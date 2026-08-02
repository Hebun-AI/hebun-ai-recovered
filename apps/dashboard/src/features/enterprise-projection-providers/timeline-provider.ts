import { loadTimelineContextProjection, loadTimelineProjection } from "@/features/enterprise-application-services/timeline-service";

export function getTimelineProjection() {
  return loadTimelineProjection();
}

export function getTimelineContextProjection() {
  return loadTimelineContextProjection();
}
