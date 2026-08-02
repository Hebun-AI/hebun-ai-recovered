import { ArrowRight, Network, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceCard } from "@/components/director-workspace/workspace-card";
import type { KnowledgeCategoryProjection as KnowledgeCategory, KnowledgeChangeProjection as RecentKnowledge, KnowledgeRelationshipProjection as KnowledgeRelationship } from "@/features/enterprise-projections";

const trustVariant = { Verified: "success", Reviewed: "primary", Unverified: "warning" } as const;
const relationshipVariant = { Strong: "success", Developing: "warning", Gap: "error" } as const;

export function KnowledgeHealthAndCategories({ items }: { items: KnowledgeCategory[] }) {
  return (
    <WorkspaceCard title="Knowledge health" description="Coverage quality by enterprise knowledge category.">
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <li key={item.name} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-semibold text-fg">{item.name}</h3><p className="mt-1 text-[0.7rem] text-fg-muted tabular-nums">{item.assets} assets</p></div><span className="text-sm font-semibold text-fg tabular-nums">{item.coverage}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-label={`${item.name} coverage`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.coverage}><div className="h-full rounded-full bg-primary" style={{ width: `${item.coverage}%` }} /></div><p className="mt-2 text-[0.7rem] leading-4 text-fg-secondary">{item.gap}</p></li>)}
      </ul>
    </WorkspaceCard>
  );
}

export function RecentlyAddedKnowledge({ items }: { items: RecentKnowledge[] }) {
  return (
    <WorkspaceCard title="Recently added knowledge" description="What changed, where it came from, and whether it is ready for enterprise use." action={<Sparkles className="size-5 text-primary" aria-hidden="true" />}>
      <ul className="divide-y divide-border">
        {items.map((item) => <li key={item.title} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-fg">{item.title}</p><p className="mt-1 text-xs text-fg-secondary">{item.source} · {item.category}</p><p className="mt-1 text-[0.7rem] text-fg-muted">{item.owner} · {item.added}</p></div><Badge variant={trustVariant[item.trust]} className="w-fit shrink-0">{item.trust}</Badge></li>)}
      </ul>
    </WorkspaceCard>
  );
}

export function KnowledgeRelationships({ items }: { items: KnowledgeRelationship[] }) {
  return (
    <WorkspaceCard title="Knowledge relationships" description="How governed knowledge supports enterprise understanding and accountable decisions." action={<Network className="size-5 text-primary" aria-hidden="true" />}>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <li key={`${item.source}-${item.target}`} className="rounded-xl border border-border bg-surface-sunken/35 p-4"><div className="flex items-center justify-between gap-3"><Badge variant={relationshipVariant[item.strength]}>{item.strength}</Badge><span className="text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">Relationship</span></div><div className="mt-4 flex items-center gap-2 text-xs font-semibold text-fg"><span>{item.source}</span><ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" /><span>{item.target}</span></div><p className="mt-2 text-xs font-medium text-primary">{item.relationship}</p><p className="mt-2 text-[0.7rem] leading-4 text-fg-secondary">{item.context}</p></li>)}
      </ul>
      <p className="mt-4 text-xs leading-5 text-fg-muted">Knowledge Domain preview only. Relationships are typed mock projections and do not represent retrieval, embeddings, graph, or Runtime infrastructure.</p>
    </WorkspaceCard>
  );
}
