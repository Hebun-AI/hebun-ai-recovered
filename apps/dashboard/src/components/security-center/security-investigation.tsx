import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityRegion, SecurityEmptyState } from "./security-region";

/*
 * Investigation (UI refinement) — ready for future evidence, honest today. Nothing is selected and
 * no investigation exists, so it shows an intentional empty state and its lenses. It never implies
 * that an investigation currently exists or fabricates a trace.
 */

export function SecurityInvestigation({ model, className }: { model: SecurityCenterModel; className?: string }) {
  return (
    <SecurityRegion
      className={className}
      eyebrow="Ready for evidence"
      title="Investigation"
      action={
        <span className="inline-flex items-center rounded-full border border-border bg-surface-sunken px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
          Nothing selected
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <SecurityEmptyState
          title="Select a validated finding when one becomes available"
          detail="Nothing is surfaced, so there is nothing to inspect — the inspector never fabricates an investigation trace or timeline."
        />
        <ul className="flex flex-col gap-1">
          {model.inspectorLenses.map((lens) => (
            <li key={lens.facet} className="flex items-baseline gap-2 text-[0.7rem]">
              <span className="w-24 shrink-0 font-medium text-fg-secondary">{lens.facet}</span>
              <span className="text-fg-muted">{lens.question}</span>
            </li>
          ))}
        </ul>
      </div>
    </SecurityRegion>
  );
}
