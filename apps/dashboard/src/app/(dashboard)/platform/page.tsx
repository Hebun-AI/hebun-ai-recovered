import { PlatformWorkspace } from "@/components/platform-workspace/platform-workspace";
import { getPlatformWorkspaceModel } from "@/features/platform/workspace-model";
import { getDirectorDashboardUiModel } from "@/features/director-dashboard-ui/adapter.server";

export const metadata = { title: "Platform — Hebun AI" };

/*
 * Platform Workspace (Phase 13) — the technical capability surface.
 *
 * Loads the REAL, non-authoritative Executive Overview (for technical dependency
 * availability) and the real provider/capability vocabulary. No populated
 * integration, configured provider/model, credential, or user record is surfaced,
 * so those regions render honest empty states. No mock integrations, no seeded
 * provider data, no secret, no model call, no mutation, no authority act (Phase 13
 * spec).
 */

export default function PlatformPage() {
  const { overview } = getDirectorDashboardUiModel();
  const model = getPlatformWorkspaceModel();
  return <PlatformWorkspace overview={overview} model={model} />;
}
