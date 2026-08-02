import { AlertTriangle, Building2, CheckCircle2, CircleGauge, ClipboardCheck } from "lucide-react";
import type { DirectorStatusMetricProjection as ExecutiveStatusMetric } from "@/features/enterprise-projections";
import { cn } from "@/lib/utils";

const icons = [Building2, AlertTriangle, ClipboardCheck, CheckCircle2, CircleGauge];
const stateStyles: Record<ExecutiveStatusMetric["state"], string> = {
  Healthy: "bg-success-subtle text-success",
  Attention: "bg-warning-subtle text-warning",
  Ready: "bg-primary-subtle text-primary",
  Pending: "bg-info-subtle text-info",
};

export function ExecutiveStatus({ items }: { items: ExecutiveStatusMetric[] }) {
  return (
    <section aria-labelledby="executive-status-title" className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-2 border-b border-border bg-surface-sunken/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Executive operating posture</p>
          <h2 id="executive-status-title" className="mt-1 text-lg font-semibold text-fg sm:text-xl">Enterprise is stable with one issue requiring attention.</h2>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success"><span className="size-2 rounded-full bg-success" />Operating normally</span>
      </div>
      <div className="flex flex-wrap gap-px bg-border">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.label} className="min-w-[10.5rem] flex-1 basis-[10.5rem] bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" /></span>
                <span className={cn("rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider", stateStyles[item.state])}>{item.state}</span>
              </div>
              <p className="mt-3 text-xl font-semibold tracking-tight text-fg tabular-nums">{item.value}</p>
              <h2 className="mt-1 text-xs font-semibold uppercase tracking-wider text-fg-secondary">{item.label}</h2>
              <p className="mt-1 text-xs leading-5 text-fg-muted">{item.context}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
