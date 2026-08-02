import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { TimelineOverview } from "@/components/timeline-domain/timeline-overview";
import { TimelineWorkspace } from "@/components/timeline-domain/timeline-workspace";
import { RecentTimelineContext, TimelineIntegrityPanel } from "@/components/timeline-domain/timeline-context";
import { getTimelineContextProjection, getTimelineProjection } from "@/features/enterprise-projection-providers";

export default async function EventsPage() {
  const [timeline, timelineContext] = await Promise.all([
    getTimelineProjection(),
    getTimelineContextProjection(),
  ]);

  return (
    <>
      <PageHeader
        title="Enterprise Timeline"
        context="The chronological enterprise record — activity, decisions, changes, provenance, impact, and required attention understood in context."
        action={<><Badge variant="primary">Timeline foundation</Badge><Badge variant="success">Mock projection</Badge></>}
      />
      <div className="space-y-6">
        <TimelineOverview items={timeline.overview} />
        <TimelineWorkspace events={timeline.events} />
        <TimelineIntegrityPanel items={timeline.integrity} />
        <RecentTimelineContext decisions={timelineContext.recentDecisions} knowledge={timelineContext.recentKnowledge} prompts={timelineContext.hebySuggestions} />
        <p className="text-xs leading-5 text-fg-muted">Enterprise Timeline presents local conceptual events only. It is not Enterprise Memory and does not provide persistence, event sourcing, audit infrastructure, or memory admission.</p>
      </div>
    </>
  );
}
