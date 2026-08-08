/*
 * Knowledge header — a slim orientation line, not a hero banner (Phase 9 §7).
 * Grounded and inspectable from the first glance. No marketing copy.
 */

export function KnowledgeHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Knowledge</h1>
      <p className="text-sm text-fg-muted">
        Inspect what the organization knows, where it came from, and how it is connected.
      </p>
    </div>
  );
}
