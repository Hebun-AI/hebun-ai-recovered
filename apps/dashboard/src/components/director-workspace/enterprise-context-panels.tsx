import { BookOpen, Building2, Circle, FileText, GitBranch, UserRound } from "lucide-react";
import type { TimelineEvent } from "@/features/director-workspace/mock";
import { WorkspaceCard } from "./workspace-card";

const entityIcons = [UserRound, GitBranch, FileText, BookOpen, Building2, Circle];

export function EnterpriseTimelinePanel({ items }: { items: TimelineEvent[] }) {
  return (
    <WorkspaceCard title="Enterprise timeline" description="Recent events across the enterprise.">
      <ol className="relative ml-2 border-l border-border pl-6">
        {items.map((item) => (
          <li key={`${item.type}-${item.title}`} className="relative pb-5 last:pb-0">
            <span className="absolute -left-[1.72rem] top-1.5 size-2.5 rounded-full border-2 border-surface bg-primary" />
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{item.type}</p><p className="mt-1 text-sm font-medium text-fg">{item.title}</p></div><time className="shrink-0 text-xs text-fg-muted">{item.time}</time></div>
          </li>
        ))}
      </ol>
    </WorkspaceCard>
  );
}

export function KnowledgeGraphPreview({ items }: { items: readonly { label: string; count: number }[] }) {
  return (
    <WorkspaceCard title="Knowledge graph overview" description="Product preview · connected enterprise entities">
      <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3">
        <span aria-hidden="true" className="absolute inset-x-8 top-1/2 hidden h-px bg-border sm:block" />
        {items.map((item, index) => {
          const Icon = entityIcons[index];
          return <div key={item.label} className="relative z-10 rounded-xl border border-border bg-surface p-4 text-center shadow-xs"><span className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary-subtle text-primary"><Icon className="size-4" /></span><p className="mt-3 text-sm font-semibold text-fg">{item.label}</p><p className="mt-1 text-xs text-fg-secondary tabular-nums">{item.count} entities</p></div>;
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-fg-muted">Visual preview only. Connections are illustrative and do not represent graph infrastructure.</p>
    </WorkspaceCard>
  );
}
