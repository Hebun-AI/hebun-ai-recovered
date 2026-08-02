import type { ProjectionMetadata } from "@/features/enterprise-projections/shared";

export type OrganizationHealth = "Healthy" | "Watch" | "Attention";

export interface OrganizationReadinessProjection {
  label: string;
  value: string;
  detail: string;
  state: OrganizationHealth;
}

export type OrganizationAttentionSignal = OrganizationReadinessProjection;

export interface TeamProjection {
  name: string;
  lead: string;
  responsibility: string;
}

export interface DepartmentProjection {
  name: string;
  executive: string;
  purpose: string;
  headcount: number;
  health: OrganizationHealth;
  attention: string;
  teams: TeamProjection[];
}

export interface RoleProjection {
  title: string;
  owner: string;
  scope: string;
  accountabilities: string[];
  coverage: "Clear" | "Shared" | "Gap";
}

export interface ResponsibilityProjection {
  responsibility: string;
  owners: string[];
  impact: string;
  status: "Clarify" | "Coordinated";
}

export interface ReportingRelationshipProjection {
  level: string;
  members: string[];
  purpose: string;
}

export interface BusinessUnitProjection {
  name: string;
  leader: string;
  mandate: string;
  departments: string[];
  readiness: number;
}

export interface OrganizationRelationshipProjection {
  source: string;
  relationship: string;
  target: string;
  context: string;
  strength: "Strong" | "Developing" | "At Risk";
}

export interface OrganizationOverviewProjection extends ProjectionMetadata {
  readiness: OrganizationReadinessProjection[];
  departments: DepartmentProjection[];
  roles: RoleProjection[];
  responsibilities: ResponsibilityProjection[];
  reportingRelationships: ReportingRelationshipProjection[];
  businessUnits: BusinessUnitProjection[];
  relationships: OrganizationRelationshipProjection[];
}
