import type { OrganizationOverviewProjection } from "@/features/enterprise-projections";
import { organizationProjection } from "@/features/organization-domain/mock";

export function loadOrganizationProjection(): OrganizationOverviewProjection {
  return organizationProjection;
}
