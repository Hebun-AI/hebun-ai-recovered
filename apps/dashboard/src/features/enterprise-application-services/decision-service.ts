import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { DecisionRepository } from "@/features/enterprise-persistence/ports";

export async function loadDecisionProjection(repository: DecisionRepository) {
  return requirePersistenceSuccess(await repository.loadDecisions(), "Decision projection");
}
