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
