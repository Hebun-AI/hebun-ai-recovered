/*
 * Platform header — a slim orientation line, not a hero banner (Phase 13 §21).
 * Technical and dependency-aware. No marketing copy, no fake uptime score.
 */

export function PlatformHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Platform</h1>
      <p className="text-sm text-fg-muted">
        Inspect the technical capabilities, connections, and dependencies that power Hebun.
      </p>
    </div>
  );
}
