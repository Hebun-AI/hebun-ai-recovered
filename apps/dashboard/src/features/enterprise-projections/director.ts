import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type DirectorHealthStatus = "Healthy" | "Watch" | "Stable";

export interface DirectorHealthProjection {
  label: string;
  status: DirectorHealthStatus;
  value: string;
  supportingText: string;
  progress: number;
  trend: string;
}

export interface DirectorPriorityProjection {
  rank: number;
  title: string;
  domain: string;
  dueState: string;
  severity: "Critical" | "High" | "Medium";
}

export interface DirectorDecisionSummaryProjection {
  title: string;
  impact: string;
  deadline: string;
  status: "Review today" | "Due soon" | "Draft";
}

export interface DirectorRecommendationProjection {
  priority: "Critical" | "High" | "Medium";
  recommendation: string;
  reason: string;
  businessImpact: string;
  affectedDomains: string[];
  confidence: number;
  directorAction: string;
}

export interface DirectorTimelineEventProjection {
  type: "Meeting" | "Decision" | "Architecture" | "Review" | "Publication";
  title: string;
  time: string;
  impact: string;
  status: "Complete" | "Review" | "Published";
  source: string;
}

export interface DirectorExecutiveIntelligenceProjection {
  label: "Critical Today" | "Enterprise Risks" | "Top Opportunity" | "Pending Approvals" | "Knowledge Changes" | "Recent Decisions" | "Strategic Recommendation";
  value: string;
  insight: string;
  tone: "critical" | "attention" | "positive" | "neutral";
}

export interface DirectorStatusMetricProjection {
  label: string;
  value: string;
  context: string;
  state: "Healthy" | "Attention" | "Ready" | "Pending";
}

export interface DirectorDailyBriefProjection {
  label: string;
  value: string;
  detail: string;
  direction: "positive" | "neutral" | "attention";
}

export interface DirectorAdvisorAwarenessProjection {
  label: string;
  value: string;
  detail: string;
}

export interface DirectorKnowledgeEntityProjection {
  label: "Decision" | "Policy" | "Department" | "Document" | "Workflow" | "Agent" | "Knowledge";
  value: string;
  relationship: string;
}

export interface DirectorQuickActionProjection {
  label: string;
  href: string;
}

export interface DirectorWorkspaceProjection extends ProjectionMetadata {
  statusMetrics: DirectorStatusMetricProjection[];
  dailyBrief: DirectorDailyBriefProjection[];
  advisorAwareness: DirectorAdvisorAwarenessProjection[];
  intelligence: DirectorExecutiveIntelligenceProjection[];
  health: DirectorHealthProjection[];
  priorities: DirectorPriorityProjection[];
  decisions: DirectorDecisionSummaryProjection[];
  recommendations: DirectorRecommendationProjection[];
  timeline: DirectorTimelineEventProjection[];
  knowledge: DirectorKnowledgeEntityProjection[];
  quickActions: readonly DirectorQuickActionProjection[];
}
