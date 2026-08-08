import type { DecisionWorkspaceModel } from "@/features/decisions/workspace-model";
import { DecisionHeader } from "./decision-header";
import { DecisionStateStrip } from "./decision-state-strip";
import { PendingDecisions } from "./pending-decisions";
import { DecisionInspector } from "./decision-inspector";
import { AuthorityChain } from "./authority-chain";
import { DecisionEvidenceAndAdvisory } from "./decision-evidence-advisory";
import { DecisionConsequencesAndGovernance } from "./decision-consequences-governance";
import { DecisionActAndHistory } from "./decision-act-history";
import { DecisionHandoffAndBoundary } from "./decision-handoff-boundary";

/*
 * Decision & Approval Experience — Hebun's human authority surface (UI Phase 14).
 *
 * It answers: what requires human authority, what information supports the decision,
 * what exactly is being decided, what the consequences are, what the human decided, and
 * how that decision is recorded. Human, accountable, calm, consequence- and
 * authority-aware — distinct from Command (attention), Governance (policy), Operations
 * (execution), Intelligence (advice), and Knowledge (evidence).
 *
 * Composition:
 *   Header (slim)
 *   State strip                          — honest: no queue connected; real admissible state
 *   Pending Human Decisions (primary)    | Decision Inspector
 *   The Human Authority Chain            — structural, from the real Heby Phase 6 contract
 *   Evidence & Provenance | Recommendation & Advisory
 *   Consequences | Governance & Authority Requirement
 *   Decision Act | Decision History
 *   Execution Handoff + Boundary & Ownership
 *
 * Every instance region is an honest, explained empty state — no persisted approval
 * queue, decision record, briefing, evidence, recommendation, consequence, or history is
 * connected, and none is fabricated. No Approve / Reject / Authorize affordance exists,
 * because no real, server-authorized decision-mutation path is connected. No model call,
 * no mutation, no execution behaviour. Ambient Heby is provided by the shell.
 */

export function DecisionWorkspace({ model }: { model: DecisionWorkspaceModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <DecisionHeader />
      <DecisionStateStrip />

      {/* Pending decisions + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PendingDecisions kinds={model.preparationKinds} />
        </div>
        <div className="min-w-0">
          <DecisionInspector lenses={model.inspectorLenses} />
        </div>
      </div>

      <AuthorityChain steps={model.authorityChain} />

      <DecisionEvidenceAndAdvisory />
      <DecisionConsequencesAndGovernance />
      <DecisionActAndHistory />

      <DecisionHandoffAndBoundary />
    </div>
  );
}
