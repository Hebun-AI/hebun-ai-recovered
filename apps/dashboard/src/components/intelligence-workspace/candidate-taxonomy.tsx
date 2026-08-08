import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { WorkspaceRegion, AdvisoryMarker } from "./workspace-region";

/*
 * Signal / Pattern / Candidate overview (Phase 8 §9/E) — the REAL candidate-kind
 * taxonomy the Runtime recognizes, one per Organizational Intelligence Foundation
 * domain. The kind, its source Foundation phase, and its evidence-basis rule are
 * real, frozen descriptors. Every kind honestly shows "0 surfaced" — none is
 * populated, and none is invented.
 */

export function CandidateTaxonomy({ model }: { model: IntelligenceWorkspaceModel }) {
  return (
    <WorkspaceRegion
      variant="plain"
      eyebrow="Taxonomy"
      title="Signals, Patterns & Candidates"
      action={<AdvisoryMarker label="Kinds the Runtime recognizes" />}
    >
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {model.kinds.map((kind) => (
          <li
            key={kind.kind}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{kind.label}</span>
              <span className="shrink-0 rounded-full border border-border bg-surface-sunken px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted">
                0 surfaced
              </span>
            </div>
            <p className="text-[0.7rem] leading-5 text-fg-secondary">{kind.describes}</p>
            <p className="text-[0.65rem] text-fg-muted">
              Foundation phase {kind.sourcePhase}
              {kind.requiresBasis && " · requires an evidence basis"}
            </p>
          </li>
        ))}
      </ul>
    </WorkspaceRegion>
  );
}
