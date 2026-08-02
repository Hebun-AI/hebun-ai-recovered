import { DirectorWorkspaceHeader } from "@/components/director-workspace/director-workspace-header";
import { EnterpriseTimelinePanel, KnowledgeGraphPreview } from "@/components/director-workspace/enterprise-context-panels";
import { CrossDomainContextPanel, EnterpriseIntelligenceOverview, ExecutiveIntelligenceSignals, UnifiedEnterpriseHealth } from "@/components/director-workspace/enterprise-intelligence-integration";
import { ExecutiveDailyBrief } from "@/components/director-workspace/executive-daily-brief";
import { ExecutiveStatus } from "@/components/director-workspace/executive-status";
import { HebyAssistantPanel } from "@/components/director-workspace/heby-assistant-panel";
import { HebyRecommendationsPanel, PendingDecisionsPanel, PrioritiesPanel, QuickActionsPanel } from "@/components/director-workspace/operational-panels";
import { advisorAwareness, dailyBrief, decisions, executiveStatus, knowledgeEntities, lastUpdatedAtIso, priorities, quickActions, recommendations, timelineEvents } from "@/features/director-workspace/mock";
import { crossDomainContexts, enterpriseIntelligenceOverview, enterpriseIntelligenceSignals, hebyEnterpriseContext, overallEnterpriseIntelligence, unifiedEnterpriseHealth } from "@/features/enterprise-intelligence/mock";

export default function DirectorWorkspacePage() {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <EnterpriseIntelligenceOverview items={enterpriseIntelligenceOverview} overall={overallEnterpriseIntelligence} />
        <ExecutiveStatus items={executiveStatus} />
        <ExecutiveIntelligenceSignals items={enterpriseIntelligenceSignals} />
        <DirectorWorkspaceHeader updatedAtIso={lastUpdatedAtIso} />
        <ExecutiveDailyBrief items={dailyBrief} />
        <UnifiedEnterpriseHealth items={unifiedEnterpriseHealth} />
        <CrossDomainContextPanel items={crossDomainContexts} />
        <div className="grid gap-5 lg:grid-cols-2"><PrioritiesPanel items={priorities} /><PendingDecisionsPanel items={decisions} /></div>
        <EnterpriseTimelinePanel items={timelineEvents} />
        <HebyRecommendationsPanel items={recommendations} />
        <KnowledgeGraphPreview items={knowledgeEntities} />
        <QuickActionsPanel items={quickActions} />
      </div>
      <HebyAssistantPanel awareness={advisorAwareness} context={hebyEnterpriseContext} />
    </div>
  );
}
