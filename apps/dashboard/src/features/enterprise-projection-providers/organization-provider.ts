import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getOrganizationProjection() {
  return getActiveEnterpriseProjectionProvider().getOrganizationProjection();
}
