export const ENTERPRISE_PROJECTION_VERSION = "1.0" as const;

export type ProjectionId = string;
export type ProjectionVersion = typeof ENTERPRISE_PROJECTION_VERSION;
export type ProjectionTimestamp = string;
export type ProjectionStatus = "Ready" | "Partial" | "Unavailable";
export type ProjectionFreshness = "Current" | "Stale" | "Unknown";
export type ProjectionConfidence = number;

export interface ProjectionSource {
  kind: "Mock Adapter" | "Runtime" | "API" | "Application Service";
  name: string;
}

export interface EnterpriseAreaReference {
  area: string;
  label: string;
}

export interface EntityReference {
  id: string;
  type: string;
  label: string;
}

export interface ProvenanceReference {
  source: string;
  reference?: string;
  trust: "Verified" | "Reviewed" | "Incomplete" | "Unverified";
}

/** Additive fields may be introduced within version 1; breaking changes require a new version. */
export interface ProjectionMetadata {
  projectionId: ProjectionId;
  version: ProjectionVersion;
  generatedAt: ProjectionTimestamp;
  source: ProjectionSource;
  freshness: ProjectionFreshness;
  status: ProjectionStatus;
}
