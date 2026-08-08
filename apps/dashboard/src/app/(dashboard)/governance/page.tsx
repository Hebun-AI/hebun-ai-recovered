import { GovernanceWorkspace } from "@/components/governance-workspace/governance-workspace";
import { getGovernanceWorkspaceModel } from "@/features/governance/workspace-model";

export const metadata = { title: "Governance — Hebun AI" };

/*
 * Governance Workspace (Phase 12) — the organizational control surface.
 *
 * Loads only the real, canonical governance vocabulary (decision statuses, approval
 * modes, policy categories, check statuses, risk classes, approval statuses, and
 * pipeline stages). No populated policy, risk, approval, evidence, or audit record
 * is surfaced, so every place populated governance data would appear renders an
 * honest empty state. No seeded governance data, no mock projection, no model call,
 * no authority act (Phase 12 spec).
 */

export default function GovernancePage() {
  const model = getGovernanceWorkspaceModel();
  return <GovernanceWorkspace model={model} />;
}
