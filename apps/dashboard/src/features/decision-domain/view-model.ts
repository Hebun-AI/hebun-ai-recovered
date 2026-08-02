import type { DecisionImpact, DecisionPriority, DecisionRisk, DecisionStatus } from "@/features/enterprise-projections";

export type DecisionDateRange = "All dates" | "Due today" | "Due this week" | "No deadline";

export interface DecisionFilterState {
  status: DecisionStatus | "All statuses";
  priority: DecisionPriority | "All priorities";
  impact: DecisionImpact | "All impacts";
  risk: DecisionRisk | "All risks";
  domain: string;
  owner: string;
  requestedBy: string;
  attention: "Any attention" | "Director attention" | "No attention required";
  date: DecisionDateRange;
}
