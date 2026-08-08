import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { HealthChip } from "@/components/command-center/command-region";
import { TechnicalMarker } from "./platform-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Platform State strip (Phase 13 §22) — a compact technical scan.
 *
 * Composes ONLY real values from the non-authoritative Executive Overview: overall
 * platform health, the critical/warning/unavailable dependency counts, and
 * freshness. NO invented uptime, latency, cost, request rate, provider usage, or
 * integration count. Connections and providers are honestly not connected.
 */

function freshnessLabel(overview: ExecutiveOverview): string {
  const { state, ageSeconds } = overview.freshness;
  if (state === "unknown") return "Freshness unknown";
  const age = typeof ageSeconds === "number" ? ` · ${ageSeconds}s` : "";
  return `${state === "stale" ? "Stale" : "Fresh"}${age}`;
}

export function PlatformStateStrip({ overview }: { overview: ExecutiveOverview }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Platform</span>
        <HealthChip state={overview.organizationHealth} />
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="inline-flex items-center gap-3 text-xs text-fg-secondary">
        <span className="tabular-nums text-error">{overview.criticalAlertCount} critical</span>
        <span className="tabular-nums text-warning">{overview.warningCount} warning</span>
        <span className="tabular-nums text-fg-muted">{overview.unavailableCount} unavailable</span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="text-xs text-fg-muted">Integrations: none connected</span>

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">{freshnessLabel(overview)}</span>
        <TechnicalMarker label="Technical view" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
