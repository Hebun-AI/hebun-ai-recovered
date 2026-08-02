import { decisionProjection } from "@/features/decision-domain/mock";
import type { DecisionOverviewProjection } from "@/features/enterprise-projections";

export function loadDecisionProjection(): DecisionOverviewProjection {
  return decisionProjection;
}
