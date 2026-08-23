import { GOVERNED_PATH } from "@/features/public-claims/capability-claims";

/*
 * The governed path — Knowledge → Evidence → Decision → Permit → Action → Audit record.
 *
 * ── WHY IT IS AN ORDERED LIST AND NOT SIX BOXES ──────────────────────────────
 *
 * Six equally-sized boxes in a row say the six stages are equally mature, and they are not: the
 * decision stage governs one subject today, the action stage acts inside Hebun only, and a diagram
 * that hides those two facts is the most dishonest thing that could go on this page.
 *
 * So each stage carries its own `note` from the claim contract, printed at reading size rather than
 * tucked into a tooltip. The maturity difference is IN THE COPY, which no breakpoint can flatten
 * and no screen reader can miss.
 *
 * ── WHAT THE REWORK CHANGED ──────────────────────────────────────────────────
 *
 * The stage NAME was `--fs-body` — the same size as the sentence beneath it — so six stages read as
 * six paragraphs. It is now a display line, and the stage number is set at the scale of a plate
 * marking. The chain down the left is drawn rather than implied: each stage owns a segment of rule
 * and a junction on it, so the six stages are visibly one path and not a stack of list items.
 *
 * Still a real `<ol>`, because the order is the meaning. Nothing here is lit by a state, and no
 * stage reports anything — the junctions are marks on a drawing.
 */
export function GovernedPath() {
  return (
    <ol className="flex flex-col">
      {GOVERNED_PATH.map((stage, i) => (
        <li
          key={stage.step}
          className="public-stage relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-5 py-8 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-10 lg:py-12"
        >
          {/* The drawn chain: a segment of rule per stage, with this stage's junction on it. */}
          <span aria-hidden="true" className="public-stage-rail" />
          {i > 0 ? <span aria-hidden="true" className="public-stage-cap" /> : null}
          <span aria-hidden="true" className="public-stage-node" />

          <span
            aria-hidden="true"
            className="pl-5 font-mono text-display font-light leading-none text-fg-muted tabular-nums sm:pl-7"
          >
            {String(stage.step).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-4">
            <h3 className="text-display-lg font-bold tracking-[-0.02em] text-balance text-fg">
              {stage.name}
            </h3>
            <p className="max-w-[var(--measure-prose)] text-title leading-relaxed text-fg-secondary">
              {stage.summary}
            </p>
            <p className="flex max-w-[var(--measure-prose)] gap-3 text-body leading-relaxed text-fg-muted">
              <span aria-hidden="true" className="mt-[0.7em] h-px w-5 shrink-0 bg-border-strong" />
              <span>{stage.note}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
