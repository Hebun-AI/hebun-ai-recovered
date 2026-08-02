import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type KnowledgeHealth = "Healthy" | "Watch" | "Attention";
export type KnowledgeTrustProjection = "Verified" | "Reviewed" | "Unverified";
export type KnowledgeSourceType = "Books" | "PDFs" | "YouTube" | "Internal Documents" | "Policies" | "SOPs" | "Enterprise Wiki";

export interface KnowledgeHealthProjection {
  label: string;
  value: string;
  detail: string;
  state: KnowledgeHealth;
}

export interface KnowledgeSourceProjection {
  type: KnowledgeSourceType;
  assets: number;
  trustedPercent: number;
  freshness: string;
  state: KnowledgeHealth;
  purpose: string;
}

export interface KnowledgeCategoryProjection {
  name: string;
  assets: number;
  coverage: number;
  gap: string;
}

export type KnowledgeGapProjection = KnowledgeCategoryProjection;

export interface KnowledgeChangeProjection {
  title: string;
  source: KnowledgeSourceType;
  category: string;
  added: string;
  owner: string;
  trust: KnowledgeTrustProjection;
}

export interface KnowledgeRelationshipProjection {
  source: string;
  relationship: string;
  target: string;
  context: string;
  strength: "Strong" | "Developing" | "Gap";
}

export interface KnowledgeFreshnessProjection {
  value: string;
  reviewRequired: number;
}

export interface KnowledgeOverviewProjection extends ProjectionMetadata {
  health: KnowledgeHealthProjection[];
  sources: KnowledgeSourceProjection[];
  categories: KnowledgeCategoryProjection[];
  recentChanges: KnowledgeChangeProjection[];
  relationships: KnowledgeRelationshipProjection[];
}
