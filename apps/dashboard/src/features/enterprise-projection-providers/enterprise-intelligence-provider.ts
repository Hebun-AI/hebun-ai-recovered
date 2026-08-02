import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getEnterpriseIntelligenceProjection() {
  return getActiveEnterpriseProjectionProvider().getEnterpriseIntelligenceProjection();
}
