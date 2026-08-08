/*
 * Decision header (Phase 14 §13) — a slim orientation line, not a hero banner.
 * Human, accountable, calm. No marketing copy, no fake count badge.
 */

export function DecisionHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Decisions</h1>
      <p className="text-sm text-fg-muted">
        Review what requires human authority, understand the evidence and consequences, and record accountable decisions.
      </p>
    </div>
  );
}
