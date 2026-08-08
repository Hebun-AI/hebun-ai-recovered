/*
 * Command header — a slim orientation line, not a hero banner (Phase 7 §7).
 * Current system state moved to the Executive State Strip below so the header
 * stays compact. No marketing copy.
 */

export function CommandHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Command</h1>
      <p className="text-sm text-fg-muted">Executive operating surface — attention, decisions, and system state.</p>
    </div>
  );
}
