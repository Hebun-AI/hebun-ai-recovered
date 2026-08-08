import { CommandCenter } from "@/components/command-center/command-center";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";

export const metadata = { title: "Command — Hebun AI" };

/*
 * Director Command Center (Phase 6B) — the default authenticated landing.
 *
 * Loads the REAL, non-authoritative director read model (system/runtime/agent/
 * workflow health via the widget runtime → Executive Overview + Insights).
 * Regions with no real data render honest empty/unavailable states; no business
 * data, briefing, approvals, or intelligence is fabricated (Phase 6A spec).
 */

export default function CommandPage() {
  const model = getDirectorDashboardUiModel();
  return <CommandCenter model={model} />;
}
