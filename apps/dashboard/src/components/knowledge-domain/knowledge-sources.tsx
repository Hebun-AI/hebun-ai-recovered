import { BookOpen, FileText, Files, LibraryBig, ScrollText, Tv, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkspaceCard } from "@/components/director-workspace/workspace-card";
import type { KnowledgeSource } from "@/features/knowledge-domain/mock";

const icons = { Books: BookOpen, PDFs: FileText, YouTube: Tv, "Internal Documents": Files, Policies: ScrollText, SOPs: Workflow, "Enterprise Wiki": LibraryBig };
const healthVariant = { Healthy: "success", Watch: "warning", Attention: "error" } as const;

export function KnowledgeSources({ items }: { items: KnowledgeSource[] }) {
  return (
    <WorkspaceCard title="Knowledge sources" description="Where enterprise knowledge originates, how it is governed, and how much can be trusted.">
      <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <li key={item.type} className="rounded-xl border border-border bg-surface-sunken/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" aria-hidden="true" /></span><div><h3 className="text-sm font-semibold text-fg">{item.type}</h3><p className="mt-0.5 text-xs text-fg-muted tabular-nums">{item.assets} assets</p></div></div>
                <Badge variant={healthVariant[item.state]}>{item.state}</Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-fg-secondary">{item.purpose}</p>
              <div className="mt-3 flex items-center justify-between text-[0.7rem]"><span className="text-fg-muted">Trusted knowledge</span><span className="font-semibold text-fg tabular-nums">{item.trustedPercent}%</span></div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-label={`${item.type} trusted knowledge`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.trustedPercent}><div className="h-full rounded-full bg-primary" style={{ width: `${item.trustedPercent}%` }} /></div>
              <p className="mt-3 text-[0.7rem] text-fg-secondary">{item.freshness}</p>
            </li>
          );
        })}
      </ul>
    </WorkspaceCard>
  );
}
