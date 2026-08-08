import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { HealthChip, NonAuthoritativeMarker } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * Command header — orients the Director and sets the honesty frame.
 * State + freshness come from the REAL Executive Overview (authoritative:false).
 */

function freshnessLabel(overview: ExecutiveOverview): string {
  const { state, refreshedAt, ageSeconds } = overview.freshness;
  if (state === "unknown" || !refreshedAt) return "Freshness unknown";
  const age = typeof ageSeconds === "number" ? ` · ${ageSeconds}s ago` : "";
  return `${state === "stale" ? "Stale" : "Fresh"}${age}`;
}

export function CommandHeader({ overview }: { overview: ExecutiveOverview }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border/70 pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[1.75rem]">Command</h1>
        <p className="max-w-2xl text-sm leading-6 text-fg-secondary">
          Executive operating surface — what needs you, what is running, and the state of the system.
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-fg-muted">System state</span>
          <HealthChip state={overview.organizationHealth} />
          <HebyWhy label="Why?" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.68rem] text-fg-muted">{freshnessLabel(overview)}</span>
          <NonAuthoritativeMarker label="System view · non-authoritative" />
        </div>
      </div>
    </div>
  );
}
