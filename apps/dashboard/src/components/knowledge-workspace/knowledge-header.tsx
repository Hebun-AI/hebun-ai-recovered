/*
 * Knowledge header — a slim orientation line, not a hero banner (Phase 9 §7).
 * Grounded and inspectable from the first glance. No marketing copy.
 *
 * ── STAGE 1: THIS IS NO LONGER THE PAGE'S OWN HEADING ────────────────────────
 *
 * It used to be the only `<h1>` on the Knowledge route. Stage 1 gave the workspace a `PageHeader`
 * and demoted this whole model into a closed disclosure, which left the document with TWO `<h1>`
 * elements both reading "Knowledge" — measured in the authenticated product. That is a heading-
 * structure defect a screen-reader user meets before anything else, and it was introduced by this
 * phase, not inherited.
 *
 * So the level moved and nothing else did: same words, same weight on screen, same slim line. It is
 * now an `<h2>` naming the reference model inside the disclosure, which is what it actually is, and
 * the route's outline reads h1 → h2 → h3 throughout.
 */

export function KnowledgeHeader() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">Knowledge</h2>
      <p className="text-sm text-fg-muted">
        Inspect what the organization knows, where it came from, and how it is connected.
      </p>
    </div>
  );
}
