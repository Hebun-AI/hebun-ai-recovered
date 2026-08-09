import { OrganizationHealth } from "@/components/command-operating-state/organization-health";
import { getOrganizationOperatingStateModel } from "@/features/command-operating-state/workspace-model";

export const metadata = { title: "Organization Health — Hebun AI" };

/*
 * Command · Organization Health (Phase 20B rebuild) — the organizational operating-state matrix.
 * It no longer imports `@/features/director/mock`, and the fake `companyHealth = 94` gauge is retired.
 * There is no percentage, no efficiency/utilization figure, and no aggregate organization score.
 * Each domain's state is honestly Unknown / Not connected; missing data is never rendered as "Healthy".
 */

export default function OrganizationHealthPage() {
  return <OrganizationHealth model={getOrganizationOperatingStateModel()} />;
}
