import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeRegion, KnowledgeEmptyState, ReferenceMarker } from "./knowledge-region";

/*
 * Company Memory (Phase 9 §11) — what "Memory" actually means here.
 *
 * Enterprise Memory is durable knowledge admitted under explicit authority — NOT
 * conversational chat memory, a timeline, or an audit log. Each admitted memory
 * separates five metadata dimensions (origin, authority, provenance, confidence,
 * lifecycle), none of which implies another, and moves through an admission
 * lifecycle (candidate → approved / rejected → archived).
 *
 * No admitted memory is surfaced, so the region shows the honest structural model
 * rather than fabricated records.
 */

export function CompanyMemory({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <KnowledgeRegion
      eyebrow="Retained organizational knowledge"
      title="Company Memory"
      action={<ReferenceMarker label="No memory surfaced" />}
    >
      <div className="flex flex-col gap-4">
        <KnowledgeEmptyState
          title="No admitted memory available"
          detail="Company Memory holds durable knowledge admitted under explicit authority — not chat history, a timeline, or an audit log. No memory record is surfaced, and none is fabricated."
        />

        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">
            What every admitted memory separates — none implies another
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {model.metadataDimensions.map((dimension) => (
              <li key={dimension.dimension} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-fg">{dimension.label}</span>
                  <span className="text-[0.65rem] text-fg-muted">{dimension.question}</span>
                </div>
                <p className="mt-1 text-[0.7rem] leading-5 text-fg-secondary">{dimension.describes}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Admission lifecycle</p>
          <ol className="flex flex-wrap items-center gap-1.5">
            {model.lifecycleStates.map((state) => (
              <li
                key={state.state}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken px-2 py-1 text-xs text-fg-secondary"
                title={state.describes}
              >
                {state.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </KnowledgeRegion>
  );
}
