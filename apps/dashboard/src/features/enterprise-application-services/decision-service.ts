import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { DecisionRepository } from "@/features/enterprise-persistence/ports";

export function loadDecisionProjection(repository: DecisionRepository) {
  return requirePersistenceSuccess(repository.loadDecisions(), "Decision projection");
}
