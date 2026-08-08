import type { DirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";
import { CommandHeader } from "./command-header";
import { ExecutiveStateStrip } from "./executive-state-strip";
import { DirectorAttention } from "./director-attention";
import { DecisionPressure } from "./decision-pressure";
import { SystemOperationalStatus } from "./system-operational-status";
import { OperationalPulse } from "./operational-pulse";
import { ContextStrip } from "./context-strip";

/*
 * Director Command Center — executive operating surface (Phase 7 refinement of
 * the Phase 6B implementation). The truth/provenance/authority model is FROZEN;
 * this composition only sharpens the visual hierarchy so the Director reads the
 * page in one sweep:
 *
 *   Header (slim)
 *   Executive State Strip        — fast real-data scan
 *   Director Attention (dominant) | Decision Pressure (compact)
 *   Operational State            — status matrix + pulse, grouped in one panel
 *   Advisory & Upcoming          — lower-priority honest states, grouped compact
 *
 * Ambient Heby is provided by the shell (Phase 5). Command summarizes and routes;
 * it never fabricates data and never hosts the authority act.
 */

export function CommandCenter({ model }: { model: DirectorDashboardUiModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <CommandHeader />
      <ExecutiveStateStrip overview={model.overview} />

      {/* Intervention + human decision */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DirectorAttention insights={model.insights} />
        </div>
        <div className="min-w-0">
          <DecisionPressure />
        </div>
      </div>

      {/* Operational state — status matrix + pulse grouped in one panel */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <SystemOperationalStatus overview={model.overview} />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <OperationalPulse overview={model.overview} />
        </div>
      </div>

      {/* Lower-priority context, grouped honestly */}
      <ContextStrip />
    </div>
  );
}
