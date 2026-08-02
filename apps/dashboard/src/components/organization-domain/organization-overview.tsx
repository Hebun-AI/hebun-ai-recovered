import { AlertTriangle, Building2, CircleGauge, Network, ShieldCheck } from "lucide-react";
import type { OrganizationReadinessProjection as OrganizationMetric } from "@/features/enterprise-projections";
import { cn } from "@/lib/utils";

const icons = [Building2, ShieldCheck, Network, CircleGauge, AlertTriangle];
const stateStyles: Record<OrganizationMetric["state"], string> = {
  Healthy: "bg-success-subtle text-success",
  Watch: "bg-warning-subtle text-warning",
  Attention: "bg-error-subtle text-error",
};

export function OrganizationOverview({ items }: { items: OrganizationMetric[] }) {
  return (
    <section aria-labelledby="organization-overview-title">
      <div className="mb-3"><h2 id="organization-overview-title" className="text-lg font-semibold text-fg">Organization overview</h2><p className="mt-1 text-sm text-fg-secondary">The enterprise structure, ownership posture, and readiness in one view.</p></div>
      <div className="flex flex-wrap gap-px overflow-hidden rounded-xl border border-border bg-border">
        {items.map((item, index) => {
          const Icon = icons[index];
          return <article key={item.label} className="min-w-[11rem] flex-1 basis-[11rem] bg-surface p-4"><div className="flex items-center justify-between gap-3"><span className="flex size-8 items-center justify-center rounded-lg bg-primary-subtle text-primary"><Icon className="size-4" /></span><span className={cn("rounded-full px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-wider", stateStyles[item.state])}>{item.state}</span></div><p className="mt-3 text-lg font-semibold text-fg tabular-nums">{item.value}</p><p className="mt-1 text-[0.65rem] font-semibold uppercase tracking-wider text-fg-muted">{item.label}</p><p className="mt-1 text-xs leading-5 text-fg-secondary">{item.detail}</p></article>;
        })}
      </div>
    </section>
  );
}
