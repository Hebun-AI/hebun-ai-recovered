import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { TimelineOverview } from "@/components/timeline-domain/timeline-overview";
import { TimelineWorkspace } from "@/components/timeline-domain/timeline-workspace";
import { RecentTimelineContext, TimelineIntegrityPanel } from "@/components/timeline-domain/timeline-context";
import { hebyTimelineSuggestions, recentTimelineDecisions, recentTimelineKnowledge, timelineEvents, timelineIntegrity, timelineOverview } from "@/features/timeline-domain/mock";

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="Enterprise Timeline"
        context="The chronological enterprise record — activity, decisions, changes, provenance, impact, and required attention understood in context."
        action={<><Badge variant="primary">Timeline foundation</Badge><Badge variant="success">Mock projection</Badge></>}
      />
      <div className="space-y-6">
        <TimelineOverview items={timelineOverview} />
        <TimelineWorkspace events={timelineEvents} />
        <TimelineIntegrityPanel items={timelineIntegrity} />
        <RecentTimelineContext decisions={recentTimelineDecisions} knowledge={recentTimelineKnowledge} prompts={hebyTimelineSuggestions} />
        <p className="text-xs leading-5 text-fg-muted">Enterprise Timeline presents local conceptual events only. It is not Enterprise Memory and does not provide persistence, event sourcing, audit infrastructure, or memory admission.</p>
      </div>
    </>
  );
}
