import { getActiveEnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition";

export function getDecisionProjection() {
  return getActiveEnterpriseProjectionProvider().getDecisionProjection();
}
