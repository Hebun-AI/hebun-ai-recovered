import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { WorkspaceRegion } from "./workspace-region";

/*
 * Confidence + Uncertainty (Phase 8 §12) — kept distinct.
 *
 * Confidence: how strongly the system supports an interpretation. It is a DECLARED,
 * ordinal level (indeterminate → high), never a computed probability or percentage
 * — no confidence value is invented here. Uncertainty: what remains unknown, made
 * intellectually visible rather than hidden for a clean surface. No interpretation
 * is grounded yet, so no level is asserted against any item.
 */

export function UncertaintySummary({ model }: { model: IntelligenceWorkspaceModel }) {
  return (
    <WorkspaceRegion variant="plain" eyebrow="Interpretation" title="Confidence & Uncertainty">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Confidence — ordinal, never a score</p>
          <ol className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {model.confidenceLevels.map((level) => (
              <li
                key={level.level}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                <span className="text-[0.65rem] font-semibold tabular-nums text-fg-muted">{level.order}</span>
                {level.label}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          A level orders presentation only. It is not a probability, weight, or threshold, and it never
          becomes permission to act.
        </p>
        <div className="rounded-lg border border-dashed border-border bg-surface-sunken p-3">
          <p className="text-sm font-medium text-fg">Uncertainty stays visible</p>
          <p className="text-[0.7rem] leading-5 text-fg-secondary">
            When an interpretation is surfaced, what it does not yet know is shown alongside it — as text,
            not suppressed for a cleaner card. No interpretation is grounded today.
          </p>
        </div>
      </div>
    </WorkspaceRegion>
  );
}
