import { WorkspaceRegion, WorkspaceEmptyState } from "./workspace-region";

/*
 * Evidence & Grounding (Phase 8 §11) — evidence is a first-class concept.
 *
 * Every candidate kind requires an evidence basis to be well-formed. No evidence
 * reference is surfaced (nothing grounds against a connected source yet), so this
 * region states that honestly rather than showing a count like "Evidence: 8" that
 * no real reference backs. Evidence state is carried as text, never color alone.
 */

export function EvidenceSummary() {
  return (
    <WorkspaceRegion
      variant="plain"
      eyebrow="Grounding"
      title="Evidence"
    >
      <div className="flex flex-col gap-3">
        <WorkspaceEmptyState
          title="No evidence available"
          detail="Evidence references appear once candidates ground against a connected source. No source is connected, so there is no evidence to show — and none is fabricated."
          tone="blocked"
          compact
        />
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          Every candidate the Runtime forms must carry an evidence basis; an unsupported candidate is
          restricted, deferred, or escalated rather than asserted.
        </p>
      </div>
    </WorkspaceRegion>
  );
}
