import type {
  ExecutiveOverview,
  ExecutiveSectionId,
} from "@/features/director-dashboard-executive-overview";
import { HealthChip, NonAuthoritativeMarker } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * Executive State Strip — a single-line executive scan (Phase 7 §8).
 *
 * Composes ONLY already-real Phase 6B values: overall system state, the
 * critical/warning/unavailable counts, active agent/workflow record counts, and
 * freshness. No new semantics, no giant numbers, no KPI cards. This is a rapid
 * scan, not KPI theater.
 */

function recordCount(overview: ExecutiveOverview, id: ExecutiveSectionId): number {
  return overview.sections.find((section) => section.sectionId === id)?.recordCount ?? 0;
}

function freshnessLabel(overview: ExecutiveOverview): string {
  const { state, refreshedAt, ageSeconds } = overview.freshness;
  if (state === "unknown" || !refreshedAt) return "Freshness unknown";
  const age = typeof ageSeconds === "number" ? ` · ${ageSeconds}s` : "";
  return `${state === "stale" ? "Stale" : "Fresh"}${age}`;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{label}</span>
    </span>
  );
}

export function ExecutiveStateStrip({ overview }: { overview: ExecutiveOverview }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">System</span>
        <HealthChip state={overview.organizationHealth} />
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="inline-flex items-center gap-3 text-xs text-fg-secondary">
        <span className="tabular-nums text-error">{overview.criticalAlertCount} critical</span>
        <span className="tabular-nums text-warning">{overview.warningCount} warning</span>
        <span className="tabular-nums text-fg-muted">{overview.unavailableCount} unavailable</span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <Metric label="Agents" value={recordCount(overview, "active-agents")} />
      <Metric label="Workflows" value={recordCount(overview, "active-workflows")} />

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">{freshnessLabel(overview)}</span>
        <NonAuthoritativeMarker label="System view" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
