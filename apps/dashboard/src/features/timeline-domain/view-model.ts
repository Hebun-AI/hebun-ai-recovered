import type { TimelineArea, TimelineEventType, TimelineImpact, TimelineStatus } from "@/features/enterprise-projections";

export type TimelineDateRange = "All time" | "Today" | "Last 7 days" | "Last 30 days";

export interface TimelineFilterState {
  dateRange: TimelineDateRange;
  eventType: TimelineEventType | "All types";
  impact: TimelineImpact | "All impacts";
  status: TimelineStatus | "All statuses";
  area: TimelineArea | "All areas";
  source: string;
  attention: "Any attention" | "Director attention" | "No attention required";
}

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
