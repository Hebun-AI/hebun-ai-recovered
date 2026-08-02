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
  getDirectorWorkspaceProjection(): Promise<DirectorWorkspaceProjection>;
  getOrganizationProjection(): Promise<OrganizationOverviewProjection>;
  getKnowledgeProjection(): Promise<KnowledgeOverviewProjection>;
  getTimelineProjection(): Promise<TimelineOverviewProjection>;
  getTimelineContextProjection(): Promise<TimelineContextProjection>;
  getDecisionProjection(): Promise<DecisionOverviewProjection>;
  getEnterpriseIntelligenceProjection(): Promise<EnterpriseIntelligenceApplicationProjection>;
  getHebyContextProjection(): Promise<HebyEnterpriseContextProjection>;
}
