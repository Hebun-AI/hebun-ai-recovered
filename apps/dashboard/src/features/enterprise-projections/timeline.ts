import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type TimelineEventType = "Decision" | "Knowledge" | "Organization" | "Review" | "Publication" | "Approval" | "Meeting" | "Risk" | "Agent" | "System" | "Work" | "Policy";
export type TimelineImpact = "Low" | "Medium" | "High" | "Critical";
export type TimelineStatus = "Recorded" | "Needs Review" | "Pending" | "Resolved" | "Published";
export type TimelineProvenance = "Verified" | "Attributed" | "Incomplete";
export type TimelineArea = "Enterprise" | "Finance" | "Knowledge" | "Operations" | "Organization" | "Risk" | "Sales";

export interface TimelineSourceProjection {
  name: string;
  kind: "Director" | "Department" | "System" | "Agent";
}

export interface TimelineActorProjection {
  name: string;
  role: string;
}

export interface TimelineRelationshipProjection {
  kind: "Organization" | "Knowledge" | "Decision" | "Policy" | "Work" | "Agent" | "System";
  label: string;
  relationship: string;
}

export interface TimelineEventProjection {
  id: string;
  occurredAt: string;
  displayTime: string;
  dateWindow: "Today" | "Last 7 days" | "Last 30 days";
  title: string;
  type: TimelineEventType;
  summary: string;
  source: TimelineSourceProjection;
  actor: TimelineActorProjection;
  areas: TimelineArea[];
  impact: TimelineImpact;
  status: TimelineStatus;
  provenance: TimelineProvenance;
  directorAttention: boolean;
  relationships: TimelineRelationshipProjection[];
  relatedDecisions: string[];
  relatedKnowledge: string[];
  relatedOrganization: string[];
  followUp: string;
}

export interface TimelineIntegrityProjection {
  label: string;
  value: string;
  detail: string;
  state: "Healthy" | "Watch" | "Attention";
}

export type TimelineAttentionSignal = TimelineIntegrityProjection;
export type TimelineOverviewMetricProjection = TimelineIntegrityProjection;

export interface TimelineOverviewProjection extends ProjectionMetadata {
  overview: TimelineOverviewMetricProjection[];
  events: TimelineEventProjection[];
  integrity: TimelineIntegrityProjection[];
}
