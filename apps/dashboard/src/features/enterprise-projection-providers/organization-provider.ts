import { loadOrganizationProjection } from "@/features/enterprise-application-services/organization-service";

export function getOrganizationProjection() {
  return loadOrganizationProjection();
}
