import { ArrowUpRight } from "lucide-react";
import type { HealthSummary } from "@/features/director-workspace/mock";
import { cn } from "@/lib/utils";

const statusStyle: Record<HealthSummary["status"], string> = {
  Healthy: "bg-success-subtle text-success",
  Stable: "bg-info-subtle text-info",
  Watch: "bg-warning-subtle text-warning",
};

function HealthSummaryCard({ item, dominant = false }: { item: HealthSummary; dominant?: boolean }) {
  return (
    <article className={cn("rounded-xl border bg-surface shadow-xs", dominant ? "border-primary/25 p-6 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-10" : "border-border p-5")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("font-medium", dominant ? "text-base text-fg" : "text-sm text-fg-secondary")}>{item.label}</p>
        <span className={cn("rounded-full px-2 py-1 text-[0.7rem] font-semibold", statusStyle[item.status])}>{item.status}</span>
      </div>
      <p className={cn("font-semibold tracking-tight text-fg tabular-nums", dominant ? "mt-4 text-5xl sm:row-span-2 sm:mt-0 sm:self-center" : "mt-5 text-2xl")}>{item.value}</p>
      <p className={cn("mt-1 text-xs leading-5 text-fg-secondary", dominant ? "max-w-xl" : "min-h-10")}>{item.supportingText}</p>
      <div className={cn("overflow-hidden rounded-full bg-surface-sunken", dominant ? "mt-5 h-2 sm:col-span-2" : "mt-4 h-1.5")} aria-label={`${item.progress}% health`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} />
      </div>
      <p className={cn("mt-3 flex items-center gap-1 text-xs font-medium text-fg-secondary", dominant && "sm:col-span-2")}><ArrowUpRight className="size-3.5 text-primary" />{item.trend}</p>
    </article>
  );
}

export function EnterpriseHealthGrid({ items }: { items: HealthSummary[] }) {
  const [enterprise, ...secondary] = items;
  if (!enterprise) return null;

  return (
    <section aria-labelledby="enterprise-health-title">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 id="enterprise-health-title" className="text-lg font-semibold text-fg">Enterprise health</h2>
          <p className="mt-1 text-sm text-fg-secondary">Enterprise posture first, with supporting operating domains below.</p>
        </div>
      </div>
      <div className="space-y-3">
        <HealthSummaryCard item={enterprise} dominant />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-3">{secondary.map((item) => <HealthSummaryCard key={item.label} item={item} />)}</div>
      </div>
    </section>
  );
}
