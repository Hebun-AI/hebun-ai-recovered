import type { EnterpriseIntelligenceApplicationProjection } from "@/features/enterprise-application-services/enterprise-intelligence-service";
import type { TimelineContextProjection } from "@/features/enterprise-application-services/timeline-service";
import type {
  DecisionOverviewProjection,
  DirectorWorkspaceProjection,
  HebyEnterpriseContextProjection,
  KnowledgeOverviewProjection,
  OrganizationOverviewProjection,
  TimelineOverviewProjection,
} from "@/features/enterprise-projections";

export interface EnterpriseProjectionProvider {
  getDirectorWorkspaceProjection(): DirectorWorkspaceProjection;
  getOrganizationProjection(): OrganizationOverviewProjection;
  getKnowledgeProjection(): KnowledgeOverviewProjection;
  getTimelineProjection(): TimelineOverviewProjection;
  getTimelineContextProjection(): TimelineContextProjection;
  getDecisionProjection(): DecisionOverviewProjection;
  getEnterpriseIntelligenceProjection(): EnterpriseIntelligenceApplicationProjection;
  getHebyContextProjection(): HebyEnterpriseContextProjection;
}
