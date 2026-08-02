import type { EnterpriseIntelligenceApplicationProjection } from "@/features/enterprise-intelligence/view-model";
import type {
  DecisionOverviewProjection,
  DirectorWorkspaceProjection,
  HebyEnterpriseContextProjection,
  KnowledgeOverviewProjection,
  OrganizationOverviewProjection,
  TimelineOverviewProjection,
} from "@/features/enterprise-projections";
import type { PersistenceResult } from "@/features/enterprise-persistence/contracts";
import type { TimelineContextProjection } from "@/features/timeline-domain/view-model";

export interface OrganizationRepository {
  loadOrganization(): PersistenceResult<OrganizationOverviewProjection>;
}

export interface KnowledgeRepository {
  loadKnowledge(): PersistenceResult<KnowledgeOverviewProjection>;
}

export interface TimelineRepository {
  loadTimeline(): PersistenceResult<TimelineOverviewProjection>;
  loadRecentContext(): PersistenceResult<TimelineContextProjection>;
}

export interface DecisionRepository {
  loadDecisions(): PersistenceResult<DecisionOverviewProjection>;
}

export interface EnterpriseIntelligenceRepository {
  loadEnterpriseIntelligence(): PersistenceResult<EnterpriseIntelligenceApplicationProjection>;
  loadDirectorWorkspace(): PersistenceResult<DirectorWorkspaceProjection>;
}

export interface HebyContextRepository {
  loadHebyContext(): PersistenceResult<HebyEnterpriseContextProjection>;
}

export interface EnterpriseRepositoryRegistry {
  organization: OrganizationRepository;
  knowledge: KnowledgeRepository;
  timeline: TimelineRepository;
  decision: DecisionRepository;
  enterpriseIntelligence: EnterpriseIntelligenceRepository;
  hebyContext: HebyContextRepository;
}
