/*
 * Operations header — a slim orientation line, not a hero banner (Phase 10 §7).
 * Live and operational from the first glance. No marketing copy, no fake metrics.
 */

export function OperationsHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Operations</h1>
      <p className="text-sm text-fg-muted">
        See what is running, what is blocked, and where intervention is required.
      </p>
    </div>
  );
}
