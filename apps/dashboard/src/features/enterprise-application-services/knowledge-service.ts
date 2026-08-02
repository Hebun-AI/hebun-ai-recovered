import type { KnowledgeOverviewProjection } from "@/features/enterprise-projections";
import { knowledgeProjection } from "@/features/knowledge-domain/mock";

export function loadKnowledgeProjection(): KnowledgeOverviewProjection {
  return knowledgeProjection;
}
