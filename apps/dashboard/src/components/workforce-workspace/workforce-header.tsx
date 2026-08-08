/*
 * Workforce header — a slim orientation line, not a hero banner (Phase 11 §8).
 * Organizational and capability-oriented. No HR/motivational copy, no KPI banner.
 */

export function WorkforceHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Workforce</h1>
      <p className="text-sm text-fg-muted">
        Understand who can perform work, what they are capable of, and how responsibility is distributed.
      </p>
    </div>
  );
}
