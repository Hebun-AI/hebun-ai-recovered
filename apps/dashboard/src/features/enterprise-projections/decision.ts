import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type DecisionStatus = "Waiting Review" | "Evidence Required" | "Deferred" | "Approved" | "Rejected";
export type DecisionPriority = "Critical" | "High" | "Medium" | "Low";
export type DecisionRisk = "Critical" | "High" | "Medium" | "Low";
export type DecisionImpact = "Transformational" | "High" | "Medium" | "Low";

export interface DecisionOwnerProjection {
  name: string;
  role: string;
  domain: string;
}

export interface DecisionEvidenceProjection {
  title: string;
  source: string;
  trust: "Verified" | "Reviewed" | "Incomplete";
  summary: string;
}

export interface DecisionAlternativeProjection {
  description: string;
}

export interface DecisionRelationshipProjection {
  kind: "Organization" | "Knowledge" | "Timeline" | "Policy" | "Project" | "Agent" | "System";
  label: string;
  relationship: string;
}

export interface DecisionFollowUpProjection {
  recommendation: string;
}

export interface DecisionProjection {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  category: string;
  priority: DecisionPriority;
  impact: DecisionImpact;
  confidence: number;
  status: DecisionStatus;
  owner: DecisionOwnerProjection;
  requestedBy: string;
  decisionDate: string;
  dueDate: string;
  dateRange: "Due today" | "Due this week" | "No deadline";
  domains: string[];
  directorAttention: boolean;
  risk: DecisionRisk;
  expectedImpact: string;
  risks: string[];
  alternatives: string[];
  evidence: DecisionEvidenceProjection[];
  relatedOrganization: string[];
  relatedKnowledge: string[];
  relatedTimeline: string[];
  relatedPolicies: string[];
  followUp: string[];
  relationships: DecisionRelationshipProjection[];
}

export interface DecisionOverviewMetricProjection {
  label: string;
  value: string;
  detail: string;
  state: "Healthy" | "Watch" | "Attention";
}

export interface DecisionAttentionSignal extends DecisionOverviewMetricProjection {
  type: "Missing evidence" | "Review age" | "High risk" | "Conflict" | "Duplicate" | "Ownership" | "Knowledge gap";
}

export interface DecisionOverviewProjection extends ProjectionMetadata {
  overview: DecisionOverviewMetricProjection[];
  decisions: DecisionProjection[];
  attentionSignals: DecisionAttentionSignal[];
  relationships: DecisionRelationshipProjection[];
  suggestions: readonly string[];
  authority: "Director";
  executionAllowed: false;
}
