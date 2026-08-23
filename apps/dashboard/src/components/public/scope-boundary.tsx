/*
 * The Google scope boundary — the one integration, drawn as what it is: a boundary.
 *
 * ── WHY A BOUNDARY AND NOT A FEATURE LIST ────────────────────────────────────
 *
 * PUB-1 published four statements — one grant and three refusals — as four rows of a definition
 * list, which gave the grant and the refusals identical weight and identical shape. That is honest
 * but it is not the point. The point is that there IS a line, that Hebun's reach stops at it, and
 * that the line is drawn by the scope Google itself granted.
 *
 * So the grant sits INSIDE a closed plate and the three refusals sit OUTSIDE it, under a rule
 * labelled as the edge. The composition states the fact the copy states; neither is doing it alone,
 * and the words are the ones PUB-1 shipped, unchanged.
 *
 * ── IT REPORTS NOTHING ───────────────────────────────────────────────────────
 *
 * No connection state, no account, no tenant, no scope read at request time. These four statements
 * are properties of what has been built, and this file holds no authority to discover anything
 * else — the public surface reaches no provider transport, and a test walks the import graph to
 * prove it.
 */
const OUTSIDE = [
  {
    label: "not granted",
    statement: "No Drive file-content read. A file cannot be opened or downloaded.",
  },
  {
    label: "not built",
    statement: "No Drive write. Nothing in Drive is created or changed.",
  },
  {
    label: "not persisted",
    statement: "Nothing read from Drive becomes knowledge. There is no Drive-to-Knowledge path.",
  },
] as const;

export function ScopeBoundary() {
  return (
    <div className="flex flex-col">
      {/* INSIDE the boundary. */}
      <div className="public-plate px-6 py-7 sm:px-8">
        <span aria-hidden="true" className="public-tick public-tick-tl" />
        <span aria-hidden="true" className="public-tick public-tick-tr" />
        <span aria-hidden="true" className="public-tick public-tick-bl" />
        <span aria-hidden="true" className="public-tick public-tick-br" />
        <p className="font-mono text-label tracking-[0.16em] uppercase text-primary-read">granted</p>
        <p className="mt-4 text-title leading-relaxed text-fg">
          Drive metadata read, under <span className="font-mono text-body">drive.metadata.readonly</span> —
          file names, types and timestamps.
        </p>
      </div>

      {/* The edge itself. */}
      <div className="flex items-center gap-4 py-6" aria-hidden="true">
        <span aria-hidden="true" className="public-boundary-dash h-px flex-1" />
        <span className="font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
          the boundary
        </span>
        <span aria-hidden="true" className="public-boundary-dash h-px flex-1" />
      </div>

      {/* OUTSIDE it. */}
      <ul className="flex flex-col gap-5">
        {OUTSIDE.map((entry) => (
          <li key={entry.label} className="public-outside px-6 py-5">
            <p className="font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
              {entry.label}
            </p>
            <p className="mt-3 max-w-[var(--measure-prose)] text-body leading-relaxed text-fg-secondary">
              {entry.statement}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
