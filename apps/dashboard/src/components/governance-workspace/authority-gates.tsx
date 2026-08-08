import Link from "next/link";
import { ArrowUpRight, Lock } from "lucide-react";
import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceRegion, ControlMarker } from "./governance-region";

/*
 * Authority & Human Gates (Phase 12 §25) — the critical region.
 *
 * Shows the REAL governance authority gradient (allow → allow-with-review →
 * approval-required → blocked) and the real approval modes (who must act when
 * authority is required). This is STRUCTURAL / process reference, clearly labeled —
 * NOT a list of active gate instances, which are not surfaced. Governance explains
 * that an action requires human authority; it performs no authority act. There is
 * no inline Approve/Reject here — the human decision lives on the decision surface,
 * reached by drill-through.
 */

export function AuthorityGates({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <GovernanceRegion
      variant="plain"
      eyebrow="Where human authority is required"
      title="Authority & Human Gates"
      action={<ControlMarker label="Vocabulary — not active gates" />}
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Governance decision status</p>
          <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
            {model.decisionStatuses.map((status) => (
              <li key={status.status} className="flex items-center gap-2.5 p-3">
                {status.gated ? (
                  <Lock className="size-3.5 shrink-0 text-fg-muted" aria-hidden="true" />
                ) : (
                  <span className="size-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="w-40 shrink-0 text-sm font-medium text-fg">{status.label}</span>
                <span className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">{status.describes}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Approval mode — who must act</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.approvalModes.map((mode) => (
              <li
                key={mode.mode}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {mode.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">
            No active human gate is surfaced. The human decision is performed on the dedicated decision
            surface, not here.
          </p>
          <Link
            href="/approvals"
            className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Approvals & Decisions
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </GovernanceRegion>
  );
}
