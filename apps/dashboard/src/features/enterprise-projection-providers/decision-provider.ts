import { loadDecisionProjection } from "@/features/enterprise-application-services/decision-service";

export function getDecisionProjection() {
  return loadDecisionProjection();
}
