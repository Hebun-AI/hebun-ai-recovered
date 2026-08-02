import { DirectorWorkspaceHeader } from "@/components/director-workspace/director-workspace-header";
import { EnterpriseTimelinePanel, KnowledgeGraphPreview } from "@/components/director-workspace/enterprise-context-panels";
import { CrossDomainContextPanel, EnterpriseIntelligenceOverview, ExecutiveIntelligenceSignals, UnifiedEnterpriseHealth } from "@/components/director-workspace/enterprise-intelligence-integration";
import { ExecutiveDailyBrief } from "@/components/director-workspace/executive-daily-brief";
import { ExecutiveStatus } from "@/components/director-workspace/executive-status";
import { HebyAssistantPanel } from "@/components/director-workspace/heby-assistant-panel";
import { HebyRecommendationsPanel, PendingDecisionsPanel, PrioritiesPanel, QuickActionsPanel } from "@/components/director-workspace/operational-panels";
import { getDirectorWorkspaceProjection, getEnterpriseIntelligenceProjection, getHebyContextProjection } from "@/features/enterprise-projection-providers";

export default function DirectorWorkspacePage() {
  const workspace = getDirectorWorkspaceProjection();
  const intelligence = getEnterpriseIntelligenceProjection();
  const hebyContext = getHebyContextProjection();

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <EnterpriseIntelligenceOverview items={intelligence.domainHealth} overall={intelligence.overall} />
        <ExecutiveStatus items={workspace.statusMetrics} />
        <ExecutiveIntelligenceSignals items={intelligence.signals} />
        <DirectorWorkspaceHeader updatedAtIso={workspace.generatedAt} />
        <ExecutiveDailyBrief items={workspace.dailyBrief} />
        <UnifiedEnterpriseHealth items={intelligence.unifiedHealth} />
        <CrossDomainContextPanel items={intelligence.contexts} />
        <div className="grid gap-5 lg:grid-cols-2"><PrioritiesPanel items={workspace.priorities} /><PendingDecisionsPanel items={workspace.decisions} /></div>
        <EnterpriseTimelinePanel items={workspace.timeline} />
        <HebyRecommendationsPanel items={workspace.recommendations} />
        <KnowledgeGraphPreview items={workspace.knowledge} />
        <QuickActionsPanel items={workspace.quickActions} />
      </div>
      <HebyAssistantPanel awareness={workspace.advisorAwareness} context={hebyContext} />
    </div>
  );
}
