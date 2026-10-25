import { WorkforceWorkspace } from "@/components/workforce-workspace/workforce-workspace";
import { getWorkforceWorkspaceModel } from "@/features/workforce/workspace-model";

export const metadata = { title: "Workforce — Hebun AI" };

/*
 * Workforce Workspace (Phase 11) — the organizational capability surface.
 *
 * Carries only the workspace's information model (the Human and AI Agent entity
 * types and the distinct concept layers: identity, role, capability,
 * responsibility, assignment, authority, availability). It reads no records: members
 * and durable agents are linked to where they are recorded (Organization, Agents),
 * never counted here, so every populated region renders an honest empty state. No seeded agent roster, no mock data, no model call, no authority
 * act (Phase 11 spec).
 */

export default function WorkforcePage() {
  const model = getWorkforceWorkspaceModel();
  return <WorkforceWorkspace model={model} />;
}
