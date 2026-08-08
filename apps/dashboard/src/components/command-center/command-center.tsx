import type { DirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import { CommandHeader } from "./command-header";
import { DirectorAttention } from "./director-attention";
import { DecisionPressure } from "./decision-pressure";
import { SystemOperationalStatus } from "./system-operational-status";
import { OperationalPulse } from "./operational-pulse";
import { ExecutiveBriefing } from "./executive-briefing";
import { RecentChanges } from "./recent-changes";
import { StrategicGoalsSummary } from "./strategic-goals-summary";

/*
 * Director Command Center (spec Phase 6A, §5/§6).
 *
 * Priority order, above the fold first:
 *   1. Command Header        — org state + freshness (REAL)
 *   2. Director Attention    — P0/P1 system severity (REAL) + Decision Pressure
 *   3. System / Operational  — 8 section chips + folded state (REAL)
 *   4. Operational Pulse      — agents/workflows/runtime counts (REAL)
 * Below the fold:
 *   5. Executive Briefing    — honest-empty (NOT YET AVAILABLE)
 *   6. Recent Changes        — honest-empty (insufficient history)
 *   7. Strategic Goals       — honest not-connected (mock only)
 *
 * Command summarizes and routes; it never fabricates data and never hosts the
 * authority act. Ambient Heby is provided by the shell (Phase 5).
 */

export function CommandCenter({ model }: { model: DirectorDashboardUiModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <CommandHeader overview={model.overview} />

      {/* Above the fold: attention + decision pressure */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DirectorAttention insights={model.insights} />
        </div>
        <div className="min-w-0">
          <DecisionPressure />
        </div>
      </div>

      {/* System / operational status (real) */}
      <SystemOperationalStatus overview={model.overview} />

      {/* Operational pulse (real) — near the fold */}
      <OperationalPulse overview={model.overview} />

      {/* Below the fold: advisory + change + direction (honest states) */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <ExecutiveBriefing />
        <RecentChanges />
      </div>
      <StrategicGoalsSummary />
    </div>
  );
}
