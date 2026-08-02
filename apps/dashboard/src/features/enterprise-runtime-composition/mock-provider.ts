import {
  loadDecisionProjection,
  loadDirectorWorkspaceProjection,
  loadEnterpriseIntelligenceProjection,
  loadHebyContextProjection,
  loadKnowledgeProjection,
  loadOrganizationProjection,
  loadTimelineContextProjection,
  loadTimelineProjection,
} from "@/features/enterprise-application-services";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence";
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";

export function createMockEnterpriseProjectionProvider(repositories: EnterpriseRepositoryRegistry): EnterpriseProjectionProvider {
  return Object.freeze({
    getDirectorWorkspaceProjection: () => loadDirectorWorkspaceProjection(repositories.enterpriseIntelligence),
    getOrganizationProjection: () => loadOrganizationProjection(repositories.organization),
    getKnowledgeProjection: () => loadKnowledgeProjection(repositories.knowledge),
    getTimelineProjection: () => loadTimelineProjection(repositories.timeline),
    getTimelineContextProjection: () => loadTimelineContextProjection(repositories.timeline),
    getDecisionProjection: () => loadDecisionProjection(repositories.decision),
    getEnterpriseIntelligenceProjection: () => loadEnterpriseIntelligenceProjection(repositories.enterpriseIntelligence),
    getHebyContextProjection: () => loadHebyContextProjection(repositories.hebyContext),
  });
}
