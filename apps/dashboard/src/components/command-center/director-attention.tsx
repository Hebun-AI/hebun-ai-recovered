import { AlertTriangle } from "lucide-react";
import type { ExecutiveInsight } from "@/features/director-dashboard-executive-insights";
import { Badge } from "@/components/ui/badge";
import { CommandRegion, HealthChip, RegionEmptyState } from "./command-region";
import { attentionTier } from "./health";
import { HebyWhy } from "./heby-why";

/*
 * Director Attention — the Director's first question: "what needs me now?".
 *
 * Content is REAL: it is derived from Executive Overview / Insights severe
 * sections (critical · unavailable · warning). Governance-blocked and
 * decision-required attention types are NOT YET AVAILABLE (no populated read
 * model) and are therefore intentionally absent rather than faked (spec §3/§7.2).
 *
 * Items stay typed: today every real item is a SYSTEM item, tagged as such, so
 * it never masquerades as a risk, approval, or governance block.
 */

const TIER_LABEL: Record<"P0" | "P2", string> = {
  P0: "Immediate",
  P2: "Attention",
};

export function DirectorAttention({ insights }: { insights: readonly ExecutiveInsight[] }) {
  const items = insights
    .map((insight) => ({ insight, tier: attentionTier(insight.severity) }))
    .filter((entry): entry is { insight: ExecutiveInsight; tier: "P0" | "P2" } => entry.tier !== null);

  return (
    <CommandRegion
      eyebrow="Needs you"
      title="Director Attention"
      action={items.length > 0 ? <Badge variant={items.some((i) => i.tier === "P0") ? "error" : "warning"}>{items.length}</Badge> : undefined}
    >
      {items.length === 0 ? (
        <RegionEmptyState
          title="Nothing requires your attention right now"
          detail="No system section is critical, unavailable, or degraded. This reflects the current system view only; business attention sources are not yet connected."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ insight, tier }) => (
            <li
              key={insight.sectionId}
              className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-sunken p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={tier === "P0" ? "error" : "warning"}>
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {TIER_LABEL[tier]}
                </Badge>
                <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
                  System
                </span>
                <span className="min-w-0 truncate text-sm font-semibold text-fg">{insight.title}</span>
                <HealthChip state={insight.severity} className="ml-auto" />
              </div>
              <p className="text-xs leading-5 text-fg-secondary">{insight.summary}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                <span>Recommended: {insight.recommendedAction}</span>
                <span aria-hidden="true">·</span>
                <span>{insight.evidenceCount} {insight.evidenceCount === 1 ? "record" : "records"} · {insight.evidenceSource}</span>
                <HebyWhy label="Why?" className="ml-auto" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandRegion>
  );
}
