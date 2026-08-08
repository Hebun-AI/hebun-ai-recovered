import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeRegion, KnowledgeEmptyState, ReferenceMarker } from "./knowledge-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Sources (Phase 9 §9) — the primary product surface.
 *
 * When real source records exist, each row would carry its identity, type,
 * origin, lifecycle, eligibility, freshness, attribution, and classification. No
 * source is connected today, so this region is honestly empty and instead names
 * the REAL origin taxonomy Enterprise Memory recognizes (the MemorySourceKind
 * union) — each with 0 connected. No fabricated source, count, or trust score.
 */

export function KnowledgeSources({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <KnowledgeRegion
      eyebrow="Where knowledge comes from"
      title="Sources"
      accent
      action={<ReferenceMarker label="No sources connected" />}
    >
      <div className="flex flex-col gap-3">
        <KnowledgeEmptyState
          title="No knowledge sources connected"
          detail="Sources are the origins Enterprise Memory admits knowledge from. None is connected, and no source is fabricated to fill the space. The kinds of origin the organization can admit knowledge from are shown below."
        />
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.sourceKinds.map((source) => (
            <li key={source.kind} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center justify-between gap-2 sm:w-44 sm:shrink-0">
                <span className="truncate text-sm font-medium text-fg">{source.label}</span>
                <span className="shrink-0 rounded-full border border-border bg-surface-sunken px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted sm:hidden">
                  0 connected
                </span>
              </div>
              <p className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">{source.describes}</p>
              <span className="hidden shrink-0 rounded-full border border-border bg-surface-sunken px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-muted sm:inline-flex">
                0 connected
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Where would a source come from?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </KnowledgeRegion>
  );
}
