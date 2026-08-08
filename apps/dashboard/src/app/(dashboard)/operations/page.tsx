import { OperationsWorkspace } from "@/components/operations-workspace/operations-workspace";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";

export const metadata = { title: "Operations — Hebun AI" };

/*
 * Operations Workspace (Phase 10) — the execution-observation surface.
 *
 * Loads the REAL, non-authoritative Executive Overview (the same widget-runtime
 * derived model the Command Center reads) and presents its operational sections as
 * live operational detail: per-section health, record count, and source state. No
 * individual execution/workflow/task/event/failure/gate record is surfaced, so
 * those regions render honest empty states and drill through to the existing detail
 * routes. No mock data, no model call, no authority act (Phase 10 spec).
 */

export default function OperationsPage() {
  const { overview } = getDirectorDashboardUiModel();
  return <OperationsWorkspace overview={overview} />;
}
