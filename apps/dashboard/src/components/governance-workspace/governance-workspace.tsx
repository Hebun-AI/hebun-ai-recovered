import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceHeader } from "./governance-header";
import { GovernanceStateStrip } from "./governance-state-strip";
import { PolicyControlSurface } from "./policy-control-surface";
import { GovernanceInspector } from "./governance-inspector";
import { AuthorityGates } from "./authority-gates";
import { RiskRestrictions } from "./risk-restrictions";
import { GovernanceEvidence } from "./governance-evidence";
import { GovernanceBoundary } from "./governance-boundary";

/*
 * Governance Workspace — Hebun's organizational control surface (UI Phase 12). It
 * makes rules, restrictions, authority requirements, risks, evidence, and
 * escalation boundaries inspectable without transferring decision authority to the
 * UI or AI — controlled, precise, authority-aware, distinct from its neighbours.
 *
 * Composition:
 *   Header (slim)
 *   State strip                       — honest: sources not connected
 *   Policy & Control Surface (primary) | Governance Inspector
 *   Authority & Human Gates           — the real authority gradient + approval modes
 *   Risk & Restrictions | Evidence & Auditability
 *   Boundary & Escalation             — Command / Approvals / Intelligence
 *
 * Built ONLY on real governance vocabulary (decision statuses, approval modes,
 * policy categories, check statuses, risk classes, approval statuses, pipeline
 * stages); every populated region is honestly empty. No seeded policy/risk/approval
 * data, no model call, no authority act. Ambient Heby is provided by the shell.
 */

export function GovernanceWorkspace({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <GovernanceHeader />
      <GovernanceStateStrip />

      {/* Policy surface + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PolicyControlSurface model={model} />
        </div>
        <div className="min-w-0">
          <GovernanceInspector model={model} />
        </div>
      </div>

      <AuthorityGates model={model} />

      {/* Risk + evidence, grouped */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
        <div className="min-w-0">
          <RiskRestrictions model={model} />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <GovernanceEvidence model={model} />
        </div>
      </div>

      <GovernanceBoundary />
    </div>
  );
}
