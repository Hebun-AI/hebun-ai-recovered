/*
 * Intelligence header — a slim orientation line, not a hero banner (Phase 8 §7).
 * Analytical from the first glance. No marketing copy, no KPI banner.
 */

export function IntelligenceHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Intelligence</h1>
      <p className="text-sm text-fg-muted">
        Understand what the system is observing, what may be emerging, and what evidence supports it.
      </p>
    </div>
  );
}
