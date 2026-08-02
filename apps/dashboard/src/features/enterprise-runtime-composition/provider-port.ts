import type { EnterpriseIntelligenceApplicationProjection } from "@/features/enterprise-intelligence/view-model";
import type {
  DecisionOverviewProjection,
  DirectorWorkspaceProjection,
  HebyEnterpriseContextProjection,
  KnowledgeOverviewProjection,
  OrganizationOverviewProjection,
  TimelineOverviewProjection,
} from "@/features/enterprise-projections";
import type { TimelineContextProjection } from "@/features/timeline-domain/view-model";

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
