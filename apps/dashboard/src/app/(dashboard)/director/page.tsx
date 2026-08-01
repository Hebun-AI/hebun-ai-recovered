import { DirectorWorkspaceHeader } from "@/components/director-workspace/director-workspace-header";
import { EnterpriseHealthGrid } from "@/components/director-workspace/enterprise-health-grid";
import { EnterpriseTimelinePanel, KnowledgeGraphPreview } from "@/components/director-workspace/enterprise-context-panels";
import { HebyAssistantPanel } from "@/components/director-workspace/heby-assistant-panel";
import { HebyRecommendationsPanel, PendingDecisionsPanel, PrioritiesPanel, QuickActionsPanel } from "@/components/director-workspace/operational-panels";
import { decisions, healthSummaries, knowledgeEntities, lastUpdatedAtIso, priorities, quickActions, recommendations, timelineEvents } from "@/features/director-workspace/mock";

export default function DirectorWorkspacePage() {
  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        <DirectorWorkspaceHeader updatedAtIso={lastUpdatedAtIso} />
        <EnterpriseHealthGrid items={healthSummaries} />
        <div className="grid gap-5 lg:grid-cols-2"><PrioritiesPanel items={priorities} /><PendingDecisionsPanel items={decisions} /></div>
        <HebyRecommendationsPanel items={recommendations} />
        <div className="grid gap-5 lg:grid-cols-2"><EnterpriseTimelinePanel items={timelineEvents} /><KnowledgeGraphPreview items={knowledgeEntities} /></div>
        <QuickActionsPanel items={quickActions} />
      </div>
      <HebyAssistantPanel />
    </div>
  );
}
