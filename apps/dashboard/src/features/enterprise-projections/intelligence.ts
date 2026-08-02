import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type IntelligenceState = "Healthy" | "Watch" | "Attention";

export interface EnterpriseHealthProjection {
  domain: "Organization" | "Knowledge" | "Timeline" | "Decision" | "Executive Readiness";
  label?: string;
  value: string;
  detail?: string;
  contribution?: string;
  relationship: string;
  state: IntelligenceState;
  href?: string;
}

export interface EnterpriseIntelligenceSignal {
  label: string;
  value: string;
  explanation: string;
  domains: string[];
  state: IntelligenceState;
}

export interface CrossDomainContextProjection {
  title: string;
  organization: string;
  knowledge: string;
  timeline: string;
  decision: string;
  outcome: string;
}

export interface CrossDomainRelationshipProjection {
  source: string;
  relationship: string;
  target: string;
}

export interface ExecutiveAttentionProjection {
  label: string;
  value: string;
  detail: string;
  state: IntelligenceState;
}

export type EnterpriseReadinessProjection = ExecutiveAttentionProjection;

export interface EnterpriseIntelligenceOverviewProjection extends ProjectionMetadata {
  overall: EnterpriseReadinessProjection;
  domainHealth: EnterpriseHealthProjection[];
  signals: EnterpriseIntelligenceSignal[];
  contexts: CrossDomainContextProjection[];
  unifiedHealth: EnterpriseHealthProjection[];
}
