import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { OperationsHeader } from "./operations-header";
import { OperationsStateStrip } from "./operations-state-strip";
import { OperationalSections } from "./operational-sections";
import { ExecutionInspector } from "./execution-inspector";
import { OperationsDetail } from "./operations-detail";
import { OperationsBoundary } from "./operations-boundary";

/*
 * Operations Workspace — the execution-observation surface of Hebun (UI Phase 10).
 * It answers: what is running, what is waiting, what is blocked, what failed, what
 * needs a human, and what happened? — live, temporal, and state-driven, distinct
 * from Command (executive summary), Intelligence (analytical), and Knowledge
 * (reference).
 *
 * Composition:
 *   Header (slim)
 *   State strip                  — real overall operational health + counts + freshness
 *   Operational State (primary)  | Execution Inspector
 *   Active Executions · Waiting/Gates · Failures · Recent Events  — honest, drill-through
 *   Operations Observes boundary — Command / Workforce / Governance
 *
 * Operational State reads the REAL, non-authoritative Executive Overview; every
 * granular record region is honestly empty because no execution/gate/failure/event
 * instance is surfaced. Nothing is fabricated, no model call, no authority act.
 * Ambient Heby is provided by the shell (Phase 5).
 */

export function OperationsWorkspace({ overview }: { overview: ExecutiveOverview }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <OperationsHeader />
      <OperationsStateStrip overview={overview} />

      {/* Live operational state + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <OperationalSections overview={overview} />
        </div>
        <div className="min-w-0">
          <ExecutionInspector />
        </div>
      </div>

      <OperationsDetail />
      <OperationsBoundary />
    </div>
  );
}
