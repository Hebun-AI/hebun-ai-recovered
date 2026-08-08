import { AlertTriangle } from "lucide-react";
import type { ExecutiveInsight } from "@/features/director-dashboard-executive-insights";
import { Badge } from "@/components/ui/badge";
import { CommandRegion, HealthChip } from "./command-region";
import { attentionTier } from "./health";
import { HebyWhy } from "./heby-why";

/*
 * Director Attention — the highest-priority region (Phase 7 §9). Dominant
 * container with a primary accent rule; compact, scannable rows.
 *
 * Content is REAL: severe Executive Overview / Insights sections (critical ·
 * unavailable · warning). Governance-block and decision-required attention types
 * are NOT YET AVAILABLE and stay absent rather than faked. Items are typed — every
 * real item today is a SYSTEM item, never masquerading as risk/approval/block.
 */

const TIER_LABEL: Record<"P0" | "P2", string> = { P0: "Immediate", P2: "Attention" };

export function DirectorAttention({ insights }: { insights: readonly ExecutiveInsight[] }) {
  const items = insights
    .map((insight) => ({ insight, tier: attentionTier(insight.severity) }))
    .filter((entry): entry is { insight: ExecutiveInsight; tier: "P0" | "P2" } => entry.tier !== null);

  const p0 = items.filter((i) => i.tier === "P0").length;

  return (
    <CommandRegion
      eyebrow="Needs you"
      title="Director Attention"
      accent
      className="h-full"
      action={
        items.length > 0 ? (
          <Badge variant={p0 > 0 ? "error" : "warning"}>
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-surface-sunken p-3">
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-fg">Nothing requires your attention</p>
            <p className="text-xs leading-5 text-fg-muted">
              No system section is critical, unavailable, or degraded. Business attention sources are not yet connected.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map(({ insight, tier }) => (
            <li key={insight.sectionId} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Badge variant={tier === "P0" ? "error" : "warning"}>
                  {tier === "P0" && <AlertTriangle className="size-3" aria-hidden="true" />}
                  {TIER_LABEL[tier]}
                </Badge>
                <span className="text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">System</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-fg">{insight.title}</span>
                <HealthChip state={insight.severity} />
                <HebyWhy label="Why" variant="icon" />
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{insight.summary}</p>
              <p className="text-[0.7rem] text-fg-muted">
                {insight.recommendedAction} · {insight.evidenceCount} {insight.evidenceCount === 1 ? "record" : "records"} · {insight.evidenceSource}
              </p>
            </li>
          ))}
        </ul>
      )}
    </CommandRegion>
  );
}
