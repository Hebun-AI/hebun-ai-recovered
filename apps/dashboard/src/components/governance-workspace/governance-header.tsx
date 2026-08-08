/*
 * Governance header — a slim orientation line, not a hero banner (Phase 12 §21).
 * Controlled and authority-aware. No marketing copy, no fake risk/compliance score.
 */

export function GovernanceHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Governance</h1>
      <p className="text-sm text-fg-muted">
        Understand what rules apply, what is restricted, and where human authority is required.
      </p>
    </div>
  );
}
