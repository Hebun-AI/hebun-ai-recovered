/*
 * projection-source-notice.tsx — say where this screen's numbers actually come from.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * Every enterprise projection has always declared its own origin. `ProjectionMetadata.source.kind`
 * is a typed union — `Mock Adapter` | `Runtime` | `API` | `Application Service` — and every
 * projection feeding the Director workspace declares `Mock Adapter`. One of them
 * (`hebyEnterpriseContext`) goes further and carries an explicit
 * `disclosure: { simulated: true, authoritative: false }`.
 *
 * No component read any of it. The data layer was telling the truth and the presentation layer was
 * throwing it away — while rendering today's real date beside "Updated 09:30" and a settled-sounding
 * executive briefing. That is the defect: A PRESENTATION LAYER MUST NEVER UPGRADE THE AUTHORITY OF
 * ITS INPUT.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────────
 *
 * Not a new concept, not a new field, not a trust model and not a confidence system. It reads a
 * field the contract has always had and states it. When these projections are eventually backed by
 * a real runtime, `kind` stops being `Mock Adapter` and this notice disappears on its own — there is
 * nothing to remember to remove, which is the point of deriving it rather than hard-coding it.
 */

import type { ProjectionSource } from "@/features/enterprise-projections";

/**
 * The honest banner, rendered only when the screen is genuinely reading a mock adapter.
 *
 * Deliberately NOT dismissible and NOT muted into the background. A demo marker that can be closed,
 * or that reads as decoration, stops being a marker the moment someone scrolls past it — and the
 * whole failure mode here is a reader who believes these numbers describe their organization.
 */
export function ProjectionSourceNotice({ sources }: { sources: readonly ProjectionSource[] }) {
  const mocked = sources.filter((source) => source.kind === "Mock Adapter");
  if (mocked.length === 0) return null;

  const names = Array.from(new Set(mocked.map((source) => source.name))).join(", ");

  return (
    <section
      aria-label="Data source notice"
      data-projection-source="mock-adapter"
      className="rounded-xl border border-warning/40 bg-warning/10 p-4"
    >
      <p className="text-sm font-semibold text-warning">
        Demonstration data — this screen does not describe your organization.
      </p>
      <p className="mt-1.5 text-xs leading-5 text-fg-secondary">
        Every figure, recommendation, timeline entry and health indicator below is fixed example
        content served by a mock adapter. Nothing here was read from your organization&rsquo;s
        records, nothing was computed, and no timestamp reflects real activity. Heby&rsquo;s real,
        evidence-backed answers live in the Heby workspace.
      </p>
      <p className="mt-1.5 text-[0.7rem] text-fg-muted">Mock adapter: {names}</p>
    </section>
  );
}
