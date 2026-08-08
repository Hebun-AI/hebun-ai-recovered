import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { WorkspaceRegion, WorkspaceEmptyState, AdvisoryMarker } from "./workspace-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Priority / Emerging Intelligence (Phase 8 §9) — the primary workspace region.
 *
 * When real candidate intelligence exists, each item would render with semantic
 * separation (type · subject · observation · evidence state · confidence ·
 * uncertainty · provenance). None is surfaced today — the Runtime forms candidates
 * only from settled Memory, Reasoning, and Assembly inputs, and none are wired — so
 * this region is honestly empty rather than populated with fabricated items. Empty
 * is better than false (Phase 8 §4).
 */

export function EmergingIntelligence({ model }: { model: IntelligenceWorkspaceModel }) {
  const hasItems = model.emerging.length > 0;

  return (
    <WorkspaceRegion
      eyebrow="What may be emerging"
      title="Priority Intelligence"
      accent
      className="h-full"
      action={<AdvisoryMarker label="No validated intelligence" />}
    >
      {hasItems ? null : (
        <div className="flex flex-col gap-3">
          <WorkspaceEmptyState
            title="No validated intelligence available"
            detail="The Organizational Intelligence Runtime forms attributable candidates only from settled Memory Context, Reasoning Understanding, and Organizational Assembly. None is connected, and no candidate is fabricated to fill the space."
          />
          <p className="text-[0.7rem] leading-5 text-fg-muted">
            When intelligence is surfaced, each item appears here with its kind, subject, the observation,
            its evidence state, its declared confidence and remaining uncertainty, and its provenance —
            each still awaiting a Director decision, never acted on here.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Not sure why it is empty?</span>
            <HebyWhy label="Ask Heby" variant="text" />
          </div>
        </div>
      )}
    </WorkspaceRegion>
  );
}
