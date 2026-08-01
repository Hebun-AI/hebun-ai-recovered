import { ArrowUpRight } from "lucide-react";
import type { HealthSummary } from "@/features/director-workspace/mock";
import { cn } from "@/lib/utils";

const statusStyle: Record<HealthSummary["status"], string> = {
  Healthy: "bg-success-subtle text-success",
  Stable: "bg-info-subtle text-info",
  Watch: "bg-warning-subtle text-warning",
};

function HealthSummaryCard({ item }: { item: HealthSummary }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-fg-secondary">{item.label}</p>
        <span className={cn("rounded-full px-2 py-1 text-[0.7rem] font-semibold", statusStyle[item.status])}>{item.status}</span>
      </div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-fg tabular-nums">{item.value}</p>
      <p className="mt-1 min-h-10 text-xs leading-5 text-fg-secondary">{item.supportingText}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-label={`${item.progress}% health`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${item.progress}%` }} />
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs font-medium text-fg-secondary"><ArrowUpRight className="size-3.5 text-primary" />{item.trend}</p>
    </article>
  );
}

export function EnterpriseHealthGrid({ items }: { items: HealthSummary[] }) {
  return (
    <section aria-labelledby="enterprise-health-title">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 id="enterprise-health-title" className="text-lg font-semibold text-fg">Enterprise health</h2>
          <p className="mt-1 text-sm text-fg-secondary">A concise view across the operating system.</p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">{items.map((item) => <HealthSummaryCard key={item.label} item={item} />)}</div>
    </section>
  );
}
