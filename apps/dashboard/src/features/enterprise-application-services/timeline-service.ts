import type { TimelineOverviewProjection } from "@/features/enterprise-projections";
import { hebyTimelineSuggestions, recentTimelineDecisions, recentTimelineKnowledge, timelineProjection } from "@/features/timeline-domain/mock";

export interface TimelineContextProjection {
  recentDecisions: readonly {
    id: string;
    title: string;
    state: string;
    relationship: string;
  }[];
  recentKnowledge: readonly {
    title: string;
    source: string;
    change: string;
  }[];
  hebySuggestions: readonly string[];
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
