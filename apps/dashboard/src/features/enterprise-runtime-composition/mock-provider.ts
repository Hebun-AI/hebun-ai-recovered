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

export const mockEnterpriseProjectionProvider: EnterpriseProjectionProvider = {
  getDirectorWorkspaceProjection: loadDirectorWorkspaceProjection,
  getOrganizationProjection: loadOrganizationProjection,
  getKnowledgeProjection: loadKnowledgeProjection,
  getTimelineProjection: loadTimelineProjection,
  getTimelineContextProjection: loadTimelineContextProjection,
  getDecisionProjection: loadDecisionProjection,
  getEnterpriseIntelligenceProjection: loadEnterpriseIntelligenceProjection,
  getHebyContextProjection: loadHebyContextProjection,
};
