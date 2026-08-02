import { decisionProjection } from "@/features/decision-domain/mock";
import { directorWorkspaceProjection } from "@/features/director-workspace/mock";
import { enterpriseIntelligenceOverview, enterpriseIntelligenceProjection, hebyEnterpriseContext, unifiedEnterpriseHealth } from "@/features/enterprise-intelligence/mock";
import { knowledgeProjection } from "@/features/knowledge-domain/mock";
import { organizationProjection } from "@/features/organization-domain/mock";
import { persistenceSuccess } from "@/features/enterprise-persistence/contracts";
import type { EnterpriseRepositoryRegistry } from "@/features/enterprise-persistence/ports";
import { hebyTimelineSuggestions, recentTimelineDecisions, recentTimelineKnowledge, timelineProjection } from "@/features/timeline-domain/mock";

export function createInMemoryEnterpriseRepositories(): EnterpriseRepositoryRegistry {
  return Object.freeze({
    organization: Object.freeze({
      loadOrganization: () => persistenceSuccess(organizationProjection),
    }),
    knowledge: Object.freeze({
      loadKnowledge: () => persistenceSuccess(knowledgeProjection),
    }),
    timeline: Object.freeze({
      loadTimeline: () => persistenceSuccess(timelineProjection),
      loadRecentContext: () => persistenceSuccess({
        recentDecisions: recentTimelineDecisions,
        recentKnowledge: recentTimelineKnowledge,
        hebySuggestions: hebyTimelineSuggestions,
      }),
    }),
    decision: Object.freeze({
      loadDecisions: () => persistenceSuccess(decisionProjection),
    }),
    enterpriseIntelligence: Object.freeze({
      loadEnterpriseIntelligence: () => persistenceSuccess({
        ...enterpriseIntelligenceProjection,
        domainHealth: enterpriseIntelligenceOverview,
        unifiedHealth: unifiedEnterpriseHealth,
      }),
      loadDirectorWorkspace: () => persistenceSuccess(directorWorkspaceProjection),
    }),
    hebyContext: Object.freeze({
      loadHebyContext: () => persistenceSuccess(hebyEnterpriseContext),
    }),
  });
}
