import type { TimelineOverviewProjection } from "@/features/enterprise-projections";
import { hebyTimelineSuggestions, recentTimelineDecisions, recentTimelineKnowledge, timelineProjection } from "@/features/timeline-domain/mock";

export interface TimelineContextProjection {
  recentDecisions: typeof recentTimelineDecisions;
  recentKnowledge: typeof recentTimelineKnowledge;
  hebySuggestions: typeof hebyTimelineSuggestions;
}

export function loadTimelineProjection(): TimelineOverviewProjection {
  return timelineProjection;
}

export function loadTimelineContextProjection(): TimelineContextProjection {
  return {
    recentDecisions: recentTimelineDecisions,
    recentKnowledge: recentTimelineKnowledge,
    hebySuggestions: hebyTimelineSuggestions,
  };
}
