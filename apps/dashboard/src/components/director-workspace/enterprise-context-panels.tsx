import { ArrowRight, Bot, Brain, Building2, FileText, GitBranch, ScrollText, Waypoints } from "lucide-react";
import type { KnowledgeEntity, TimelineEvent } from "@/features/director-workspace/mock";
import { cn } from "@/lib/utils";
import { WorkspaceCard } from "./workspace-card";

const entityIcons: Record<KnowledgeEntity["label"], typeof Brain> = {
  Decision: GitBranch,
  Policy: ScrollText,
  Department: Building2,
  Document: FileText,
  Workflow: Waypoints,
  Agent: Bot,
  Knowledge: Brain,
};

const timelineStatusStyles: Record<TimelineEvent["status"], string> = {
  Complete: "bg-success-subtle text-success",
  Review: "bg-warning-subtle text-warning",
  Published: "bg-info-subtle text-info",
};

export function EnterpriseTimelinePanel({ items }: { items: TimelineEvent[] }) {
  return (
    <WorkspaceCard title="Enterprise memory" description="Time, impact, status, and source across the enterprise record." action={<span className="rounded-full bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">5 recorded events</span>} className="border-primary/20">
      <div className="hidden grid-cols-[5rem_minmax(14rem,1.4fr)_minmax(10rem,1fr)_6rem_8rem] gap-4 border-b border-border px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted 2xl:grid">
        <span>Time</span><span>Event</span><span>Impact</span><span>Status</span><span>Source</span>
      </div>
      <ol className="divide-y divide-border">
        {items.map((item) => (
          <li key={`${item.type}-${item.title}`} className="grid gap-3 px-3 py-4 2xl:grid-cols-[5rem_minmax(14rem,1.4fr)_minmax(10rem,1fr)_6rem_8rem] 2xl:items-center 2xl:gap-4">
            <time className="text-xs font-semibold text-fg">{item.time}</time>
            <div><p className="text-[0.65rem] font-semibold uppercase tracking-wider text-primary">{item.type}</p><p className="mt-1 text-sm font-medium text-fg">{item.title}</p></div>
            <p className="text-xs leading-5 text-fg-secondary"><span className="mr-1 font-semibold text-fg-muted 2xl:hidden">Impact:</span>{item.impact}</p>
            <span className={cn("w-fit rounded-full px-2 py-1 text-[0.65rem] font-semibold", timelineStatusStyles[item.status])}>{item.status}</span>
            <p className="text-xs text-fg-secondary"><span className="mr-1 font-semibold text-fg-muted 2xl:hidden">Source:</span>{item.source}</p>
          </li>
        ))}
      </ol>
    </WorkspaceCard>
  );
}

function RelationshipNode({ item, reversed = false }: { item: KnowledgeEntity; reversed?: boolean }) {
  const Icon = entityIcons[item.label];
  return (
    <article className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary"><Icon className="size-4" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-fg">{item.label} · {item.value}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-fg-secondary">{reversed ? "Decision" : item.relationship}<ArrowRight className="size-3 text-primary" />{reversed ? item.relationship : "Decision"}</p>
        </div>
      </div>
    </article>
  );
}

export function KnowledgeGraphPreview({ items }: { items: KnowledgeEntity[] }) {
  const decision = items.find((item) => item.label === "Decision");
  const related = items.filter((item) => item.label !== "Decision");

  return (
    <WorkspaceCard title="Enterprise knowledge relationships" description="Visual intelligence preview · evidence and operating context connected to a decision">
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_minmax(0,1fr)] lg:items-center">
        <span aria-hidden="true" className="absolute left-[16%] right-[16%] top-1/2 hidden h-px bg-primary/25 lg:block" />
        <div className="relative z-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{related.slice(0, 3).map((item) => <RelationshipNode key={item.label} item={item} />)}</div>
        {decision ? <article className="relative z-20 flex flex-col items-center justify-center rounded-xl border border-primary/30 bg-primary-subtle p-7 text-center shadow-sm lg:aspect-square lg:rounded-full"><span className="flex size-11 items-center justify-center rounded-full bg-primary text-on-primary"><GitBranch className="size-5" /></span><p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-wider text-primary">Decision intelligence</p><p className="mt-1 text-lg font-semibold text-fg">{decision.value}</p><p className="mt-1 text-xs text-fg-secondary">Enterprise launch readiness</p></article> : null}
        <div className="relative z-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">{related.slice(3).map((item) => <RelationshipNode key={item.label} item={item} reversed />)}</div>
      </div>
      <p className="mt-4 text-xs leading-5 text-fg-muted">Visual preview only. Relationships are illustrative and do not represent graph infrastructure.</p>
    </WorkspaceCard>
  );
}
