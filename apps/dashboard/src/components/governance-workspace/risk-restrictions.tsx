import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceRegion, GovernanceEmptyState } from "./governance-region";

/*
 * Risk & Restrictions (Phase 12 §26) — kept distinct.
 *
 * Risk (how much is at stake), restriction (what is not permitted), and violation
 * (a breached restriction) are separate concepts and never collapse. No populated
 * risk or violation record exists, so the region is honestly empty and instead
 * shows the REAL risk classes a control can carry. No risk score, matrix, heat map,
 * severity count, likelihood, or financial exposure is fabricated.
 */

export function RiskRestrictions({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <GovernanceRegion variant="plain" eyebrow="What is at stake and what is restricted" title="Risk & Restrictions">
      <div className="flex flex-col gap-3">
        <GovernanceEmptyState
          title="No risks or violations surfaced"
          detail="Risk is how much is at stake; a restriction is what is not permitted; a violation is a breached restriction. None is surfaced through a real read model, and no score or severity is fabricated."
          compact
        />
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Risk classes a control can carry</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.riskClasses.map((risk) => (
              <li
                key={risk.risk}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {risk.label}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          A risk class orders attention only. It is not a probability or a score, and it never becomes an
          automatic restriction or an authority to act.
        </p>
      </div>
    </GovernanceRegion>
  );
}
