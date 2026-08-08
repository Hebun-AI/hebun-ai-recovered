import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";
import type { DecisionLensView } from "@/features/decisions/workspace-model";

/*
 * Decision Inspector (Phase 14 §16) — the lens onto a single prepared decision item.
 *
 * When a real item is selected, it would be examined through Overview, Evidence,
 * Recommendation, Consequences, Governance, Authority, History, and Handoff. No live
 * item exists to select, so this is an instructional empty state listing those lenses
 * as questions — never a fabricated selected decision.
 */

export function DecisionInspector({ lenses }: { lenses: readonly DecisionLensView[] }) {
  return (
    <DecisionRegion
      eyebrow="Understand before acting"
      title="Decision Inspector"
      className="h-full"
      action={<StructuralMarker label="No item selected" />}
    >
      <div className="flex flex-col gap-3">
        <DecisionEmptyState
          title="Select a decision to inspect it"
          detail="No decision item is connected, so none can be opened. When one is, this panel shows what is being decided and why it needs authority — before any action is offered."
          compact
        />
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {lenses.map((lens) => (
            <li key={lens.facet} className="flex flex-col gap-0.5 p-3">
              <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-fg-secondary">
                {lens.facet}
              </span>
              <span className="text-[0.7rem] leading-5 text-fg-muted">{lens.question}</span>
            </li>
          ))}
        </ul>
      </div>
    </DecisionRegion>
  );
}
