import { BookOpenCheck, CircleGauge, Library, RefreshCcw, ShieldCheck } from "lucide-react";
import type { KnowledgeHealthProjection as KnowledgeMetric } from "@/features/enterprise-projections";
import { cn } from "@/lib/utils";

const icons = [Library, ShieldCheck, BookOpenCheck, CircleGauge, RefreshCcw];
const stateStyles: Record<KnowledgeMetric["state"], string> = {
  Healthy: "bg-success-subtle text-success",
  Watch: "bg-warning-subtle text-warning",
  Attention: "bg-error-subtle text-error",
};

export function KnowledgeOverview({ items }: { items: KnowledgeMetric[] }) {
  return (
    <section aria-labelledby="knowledge-overview-title">
      <div className="mb-3">
        <h2 id="knowledge-overview-title" className="text-lg font-semibold text-fg">Knowledge overview</h2>
        <p className="mt-1 text-sm text-fg-secondary">Enterprise knowledge volume, trust, coverage, and change in one view.</p>
      </div>
      <div className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.label} className="min-w-[11rem] flex-1 basis-[11rem] bg-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                <span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-wider", stateStyles[item.state])}>{item.state}</span>
              </div>
              <p className="mt-3 text-lg font-semibold text-fg tabular-nums">{item.value}</p>
              <p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-fg-secondary">{item.detail}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
