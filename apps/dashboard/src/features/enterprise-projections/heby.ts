import type { EnterpriseAreaReference, EntityReference, ProjectionMetadata, ProvenanceReference } from "@/features/enterprise-projections/shared";

export interface HebySuggestionProjection {
  label: string;
}

export interface HebyEvidenceReference extends ProvenanceReference {
  summary: string;
}

export type HebyAffectedAreaReference = EnterpriseAreaReference;
export type HebyDecisionReference = EntityReference;
export type HebyTimelineReference = EntityReference;

export interface HebyConfidenceProjection {
  value: number;
}

export interface HebySimulationDisclosure {
  simulated: true;
  authoritative: false;
  executionAllowed: false;
  authority: "Director";
}

export interface HebyRecommendationProjection {
  recommendation: string;
  evidence: string[];
  confidence: number;
  affectedDomains: string[];
  relatedDecision: string;
  timelineReference: string;
}

export interface HebyEnterpriseContextProjection extends ProjectionMetadata {
  prompts: readonly string[];
  recommendation: string;
  evidence: string[];
  confidence: number;
  affectedDomains: string[];
  relatedDecision: string;
  timelineReference: string;
  disclosure: HebySimulationDisclosure;
}
