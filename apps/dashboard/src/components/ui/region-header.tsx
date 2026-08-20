import { cn } from "@/lib/utils";

/*
 * region-header.tsx — VI-1. The ONE section-header grammar for an ordinary Hebun workspace region.
 *
 * ── WHAT IT REPLACES ─────────────────────────────────────────────────────────
 *
 * Nine workspaces each shipped their own `*Region` component, and six of the nine carried a
 * BYTE-IDENTICAL header block. All nine composed it the same way, and that way was the `/finance`
 * failure class written into shared chrome:
 *
 *     <header className="flex items-center justify-between gap-3">   ← cannot wrap
 *       <div className="min-w-0"> … <h2 className="truncate …">      ← heading gives way
 *       <div className="flex shrink-0 items-center gap-2">{action}   ← action never yields
 *
 * Measured in the authenticated product before this file existed:
 *
 *   /knowledge @1440   h2 "Evidence & Provenance"  needs 153px, given  96px
 *   /command   @1440   label "Authentication Summary" needs 140px, given 57px  (×8 labels)
 *   /knowledge @390    the action block measured 415px wide inside a 390px viewport, escaping the
 *                      card and surviving only because `Card` clips with `overflow-hidden`
 *
 * ── WHY THE HEADING NO LONGER TRUNCATES ──────────────────────────────────────
 *
 * A section title is the reader's only statement of what the rows below it are. `truncate` on it
 * converts a layout shortage into missing information, silently, and the shortage is caused by the
 * sibling — not by the title. So the heading wraps and the ROW wraps; nothing here shortens a word.
 *
 * ── THE THREE MECHANISMS, AND WHAT EACH ONE GUARANTEES ───────────────────────
 *
 *   `flex-wrap` on the header      the action drops to its own line rather than compressing the
 *                                  title. On its own line it has the full width of the region.
 *   `basis-40` + `grow` on the     the title's HYPOTHETICAL size is 10rem, so the browser breaks
 *   title group                    the line as soon as title + action no longer fit. With
 *                                  `flex-basis: 0` they would always "fit" and the line would
 *                                  never wrap — the action would silently starve the title again.
 *   `min-w-[min(10rem,100%)]`      a floor that cannot exceed the container. A bare `min-w-40`
 *                                  would overflow a region narrower than 160px; `100%` is the
 *                                  second operand precisely so the floor yields before the box does.
 *
 * And the action wrapper is no longer `shrink-0`. That single word is what let a 415px pill sit in
 * a 390px viewport: the wrapper claimed max-content and never shrank, so its child was never asked
 * to. Without it the wrapper shrinks, the child shrinks with it, and long action text wraps inside
 * the region instead of leaving it.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ─────────────────────────────────────────
 *
 * It changes no type size. `typeScale` preserves, exactly, the sizes each of the nine regions
 * already ships — `legacy` for the eight pre-Stage-0 workspaces, `stage0` for Knowledge. Adoption
 * of the Stage 0 scale is a later gate's work, with its own geometry proof per surface; folding it
 * in here would have made a geometry fix indistinguishable from a typography sweep, and the
 * `/finance` measurement is what happens when text grows inside a row that cannot yield.
 *
 * It touches no `Card`, no `Badge`, no `CardHeader` default, and no global rule. Presentational and
 * server-safe: it resolves nothing, reads nothing, and grants nothing.
 */

export function RegionHeader({
  title,
  eyebrow,
  action,
  variant = "card",
  typeScale = "legacy",
  className,
}: {
  readonly title: string;
  readonly eyebrow?: string;
  /** Rendered beside the title where there is room, and BELOW it where there is not. */
  readonly action?: React.ReactNode;
  readonly variant?: "card" | "plain";
  /**
   * The type sizes to render at. `legacy` is what the eight pre-Stage-0 regions ship today;
   * `stage0` is the Knowledge scale. Neither is a new size — see the header note.
   */
  readonly typeScale?: "legacy" | "stage0";
  readonly className?: string;
}) {
  const isCard = variant === "card";
  const isStage0 = typeScale === "stage0";
  return (
    <header
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5",
        isCard ? "border-b border-border px-4 py-3" : "pb-2",
        className,
      )}
    >
      <div className="min-w-[min(10rem,100%)] max-w-full shrink grow basis-40">
        {eyebrow ? (
          <p
            className={cn(
              "font-semibold uppercase tracking-[0.14em] text-fg-muted",
              isStage0 ? "text-label" : "text-[0.6rem]",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        {/* No `truncate`. A section title states what its rows are; it may wrap, never shorten. */}
        <h2
          className={cn(
            "font-semibold text-fg",
            isCard
              ? "text-sm"
              : cn(
                  "uppercase tracking-wide text-fg-secondary",
                  isStage0 ? "text-meta" : "text-[0.8rem]",
                ),
          )}
        >
          {title}
        </h2>
      </div>
      {/*
        Not `shrink-0`. The wrapper yields, so its children are asked to yield, so a long action
        wraps inside the region instead of escaping it. `max-w-full` is the hard stop.
      */}
      {action ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </header>
  );
}
