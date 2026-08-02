import { requirePersistenceSuccess } from "@/features/enterprise-application-services/load-result";
import type { KnowledgeRepository } from "@/features/enterprise-persistence/ports";

export async function loadKnowledgeProjection(repository: KnowledgeRepository) {
  return requirePersistenceSuccess(await repository.loadKnowledge(), "Knowledge projection");
}
