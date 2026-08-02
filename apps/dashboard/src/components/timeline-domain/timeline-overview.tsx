import { AlertTriangle, BookOpenCheck, Building2, CalendarDays, CircleGauge, FileCheck2, Link2, ListChecks } from "lucide-react";
import type { TimelineOverviewMetric } from "@/features/timeline-domain/mock";
import { cn } from "@/lib/utils";

const icons = [CalendarDays, FileCheck2, BookOpenCheck, Building2, ListChecks, AlertTriangle, CircleGauge, Link2];
const stateStyles: Record<TimelineOverviewMetric["state"], string> = { Healthy: "bg-success-subtle text-success", Watch: "bg-warning-subtle text-warning", Attention: "bg-error-subtle text-error" };

export function TimelineOverview({ items }: { items: TimelineOverviewMetric[] }) {
  return (
    <section aria-labelledby="timeline-overview-title">
      <div className="mb-3"><h2 id="timeline-overview-title" className="text-lg font-semibold text-fg">Timeline executive overview</h2><p className="mt-1 text-sm text-fg-secondary">Enterprise activity, required attention, and record quality in one view.</p></div>
      <div className="grid overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => { const Icon = icons[index]; return <article key={item.label} className="border-b border-r border-border bg-surface p-4 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:[&:nth-last-child(-n+4)]:border-b-0"><div className="flex items-center justify-between gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" aria-hidden="true" /></span><span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-wider", stateStyles[item.state])}>{item.state}</span></div><p className="mt-3 text-lg font-semibold text-fg tabular-nums">{item.value}</p><p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{item.label}</p><p className="mt-1 text-xs leading-5 text-fg-secondary">{item.detail}</p></article>; })}
      </div>
      <p className="mt-2 text-xs text-fg-muted">Local conceptual projection · no persistence or Enterprise Memory admission</p>
    </section>
  );
}
