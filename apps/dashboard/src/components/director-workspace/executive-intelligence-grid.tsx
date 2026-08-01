import { AlertTriangle, CheckCircle2, CircleGauge, FileCheck2, Lightbulb, ShieldAlert, Sparkles } from "lucide-react";
import type { ExecutiveIntelligenceItem } from "@/features/director-workspace/mock";
import { cn } from "@/lib/utils";

const icons = [AlertTriangle, ShieldAlert, Lightbulb, FileCheck2, Sparkles, CheckCircle2, CircleGauge];
const toneStyles: Record<ExecutiveIntelligenceItem["tone"], string> = {
  critical: "border-l-error text-error",
  attention: "border-l-warning text-warning",
  positive: "border-l-success text-success",
  neutral: "border-l-primary text-primary",
};

export function ExecutiveIntelligenceGrid({ items }: { items: ExecutiveIntelligenceItem[] }) {
  return (
    <section aria-labelledby="executive-intelligence-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="executive-intelligence-title" className="text-lg font-semibold text-fg">Executive intelligence</h2>
          <p className="mt-1 text-sm text-fg-secondary">What changed, what matters, and where Director attention creates leverage.</p>
        </div>
        <span className="hidden text-xs font-semibold text-fg-muted sm:block">Simulated enterprise synthesis</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10.5rem),1fr))] gap-2">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.label} className={cn("min-h-32 rounded-lg border border-border border-l-2 bg-surface p-4 last:col-span-full last:min-h-0", item.label === "Strategic Recommendation" && "sm:grid sm:grid-cols-[minmax(10rem,0.7fr)_minmax(12rem,0.8fr)_minmax(16rem,1.5fr)] sm:items-center sm:gap-5", toneStyles[item.tone])}>
              <div className="flex items-center justify-between gap-3"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-fg-muted">{item.label}</p><Icon className="size-4 shrink-0" /></div>
              <p className="mt-3 text-lg font-semibold tracking-tight text-fg tabular-nums">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-fg-secondary">{item.insight}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
