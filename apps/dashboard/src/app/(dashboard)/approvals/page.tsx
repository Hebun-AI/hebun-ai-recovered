import { DecisionWorkspace } from "@/components/decision-workspace/decision-workspace";
import { getDecisionWorkspaceModel } from "@/features/decisions/workspace-model";

export const metadata = { title: "Decisions — Hebun AI" };

/*
 * Decision & Approval Experience (Phase 14) — the human authority surface, reachable at
 * the established `/approvals` route (labelled "Decisions" in navigation).
 *
 * Builds the model from the only real, Director-safe material available: the immutable
 * Heby Core Phase 6 approval CONTRACT VOCABULARY (preparation kinds, admissible decision
 * states, the human-authority chain, consequence rule). No real persisted approval
 * queue, decision record, briefing, evidence, recommendation, consequence, or history is
 * connected, so those regions render honest empty states. No mock projection, no seeded
 * approvals, no fabricated decision, no model call, no mutation, and no approve / reject /
 * authorize action — no real server-authorized decision-mutation path exists (Phase 14
 * spec §21).
 */

export default function ApprovalsPage() {
  const model = getDecisionWorkspaceModel();
  return <DecisionWorkspace model={model} />;
}
