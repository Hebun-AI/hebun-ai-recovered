import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { DailyBriefItem } from "@/features/director-workspace/mock";
import { cn } from "@/lib/utils";
import { WorkspaceCard } from "./workspace-card";

const directionStyle: Record<DailyBriefItem["direction"], string> = {
  positive: "text-success",
  neutral: "text-info",
  attention: "text-warning",
};

export function ExecutiveDailyBrief({ items }: { items: DailyBriefItem[] }) {
  return (
    <WorkspaceCard title="Executive daily brief" description="Yesterday’s enterprise movement, condensed for today’s decisions." action={<span className="text-xs font-semibold text-fg-muted">Yesterday</span>}>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const Icon = item.direction === "positive" ? ArrowUpRight : item.direction === "attention" ? ArrowDownRight : ArrowRight;
          return <article key={item.label} className="border-l-2 border-border pl-4"><p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{item.label}</p><div className="mt-2 flex items-center gap-2"><p className="text-xl font-semibold text-fg tabular-nums">{item.value}</p><Icon className={cn("size-4", directionStyle[item.direction])} /></div><p className="mt-1 text-xs text-fg-secondary">{item.detail}</p></article>;
        })}
      </div>
    </WorkspaceCard>
  );
}
