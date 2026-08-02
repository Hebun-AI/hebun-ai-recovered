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
import type { EnterpriseProjectionProvider } from "@/features/enterprise-runtime-composition/provider-port";
import type { EnterpriseUnitOfWork } from "@/features/enterprise-unit-of-work";

export function createEnterpriseProjectionProvider(unitOfWork: EnterpriseUnitOfWork): EnterpriseProjectionProvider {
  return Object.freeze({
    getDirectorWorkspaceProjection: () => loadDirectorWorkspaceProjection(unitOfWork),
    getOrganizationProjection: () => loadOrganizationProjection(unitOfWork),
    getKnowledgeProjection: () => loadKnowledgeProjection(unitOfWork),
    getTimelineProjection: () => loadTimelineProjection(unitOfWork),
    getTimelineContextProjection: () => loadTimelineContextProjection(unitOfWork),
    getDecisionProjection: () => loadDecisionProjection(unitOfWork),
    getEnterpriseIntelligenceProjection: () => loadEnterpriseIntelligenceProjection(unitOfWork),
    getHebyContextProjection: () => loadHebyContextProjection(unitOfWork),
  });
}
