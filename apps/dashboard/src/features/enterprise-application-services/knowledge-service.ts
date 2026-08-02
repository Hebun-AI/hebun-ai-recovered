import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { KnowledgeRepository } from "@/features/enterprise-persistence/ports";

export function loadKnowledgeProjection(repository: KnowledgeRepository) {
  return requirePersistenceSuccess(repository.loadKnowledge(), "Knowledge projection");
}
