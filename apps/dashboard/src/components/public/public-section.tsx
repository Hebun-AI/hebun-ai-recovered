/*
 * The public site's section shell.
 *
 * ── THE ONE CHANGE THAT MATTERED ─────────────────────────────────────────────
 *
 * PUB-1 and the first PUB-2A attempt both rendered a section's `<h2>` at `--fs-title` — 18px, the
 * size of a card label inside the dashboard — and then rendered the sentence a reader ACTUALLY
 * takes as the heading, one line below, as a paragraph. So the page's headings were UI labels and
 * its headline-scale text was semantically body copy. No amount of geometry drawn around that will
 * stop a page reading as documentation, because at section level there was no typographic event at
 * all.
 *
 * Now the STATEMENT is the heading. `title` becomes the small technical label it always was in
 * practice, printed beside the section number, and `statement` is the `<h2>` at display scale.
 * There is still exactly one `<h2>` per section and no duplicated heading anywhere in the document.
 *
 * ── THE PROPERTIES ARE COMPOSITION, NOT DECORATION ───────────────────────────
 *
 *   `tone`    plain · sunken · ink. Ink is the MECHANISM register — the places where the page draws
 *             how the system works. Light is the EVIDENCE register — the places where it asks to be
 *             read. A reader always knows which one they are in.
 *   `size`    the section's vertical rhythm; a dense evidence table and a tall system passage have
 *             different reasons to occupy the space they occupy.
 *   `layout`  where the heading sits. `wide` puts it above full-measure content, which is the only
 *             honest place for it when the content is a table that wants the whole width.
 *   `trace`   whether this section is a junction on the page's one trace.
 *
 * `/contact` passes none of them except `title`, and gets PUB-1's composition unchanged.
 *
 * ── THE STICKY MARKER IS NOT A TAB ───────────────────────────────────────────
 *
 * From `lg` the marker column sticks below the public header while its own section is read. Same
 * `<h2>`, no duplicate, no `role="tab"`, no `aria-selected`, no JavaScript. It sits in its own grid
 * column, so it cannot cover the prose beside it.
 */
const SIZE_CLASS = {
  compact: "public-section-compact",
  default: "public-section-default",
  dense: "public-section-dense",
  tall: "public-section-tall",
} as const;

export function PublicSection({
  id,
  index,
  title,
  statement,
  tone = "plain",
  size = "default",
  layout = "gutter",
  trace = false,
  children,
}: {
  readonly id?: string;
  /** The section number, e.g. "01". Rendered as a technical mark, never as decoration. */
  readonly index: string;
  /** The short technical label beside the number. */
  readonly title: string;
  /** The section's claim, rendered as the heading. Omit only where a page has no statement. */
  readonly statement?: string;
  readonly tone?: "plain" | "sunken" | "ink";
  readonly size?: keyof typeof SIZE_CLASS;
  readonly layout?: "gutter" | "split" | "wide";
  readonly trace?: boolean;
  readonly children: React.ReactNode;
}) {
  const label = (
    <p className="flex items-baseline gap-3 font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
      <span className="tabular-nums">{index}</span>
      <span aria-hidden="true" className="h-px w-6 bg-border-strong" />
      <span>{title}</span>
    </p>
  );

  /*
   * ONE `<h2>` element, whatever the section carries. Two JSX branches would put two heading tags
   * in this file for one rendered heading, and the guard that keeps this component from ever
   * shipping a duplicate heading counts tags in the source — a count it could no longer trust.
   */
  const heading = (
    <h2
      className={
        statement
          ? "max-w-[var(--measure-statement)] text-statement font-bold tracking-[var(--tracking-statement)] text-balance text-fg"
          : "text-title font-bold tracking-[-0.01em] text-fg"
      }
    >
      {statement ?? title}
    </h2>
  );

  const toneClass =
    tone === "ink"
      ? "public-ink border-t-0"
      : tone === "sunken"
        ? "bg-surface-sunken [--trace-node-bg:var(--color-surface-sunken)] border-t border-border"
        : "border-t border-border";

  return (
    <section id={id} className={`relative scroll-mt-24 ${SIZE_CLASS[size]} ${toneClass}`}>
      <div className="public-inset public-section-body relative mx-auto w-full max-w-[var(--container-max)]">
        {trace ? (
          <span aria-hidden="true" className="public-trace-node public-trace-node-section" />
        ) : null}

        {layout === "wide" ? (
          /*
           * The heading moves ABOVE full-width content. It is not sticky here: a header rule pinned
           * under the site header would sit on top of the table it introduces, and the table is the
           * thing this section exists to show.
           */
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-6">
              {label}
              {heading}
            </div>
            <div className="flex flex-col gap-12">{children}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-20">
            {/*
             * TWO elements, and the outer one is load-bearing. A grid item stretches to its row's
             * height by default, so a sticky grid item has no room INSIDE its own box to travel and
             * simply scrolls away. The outer div takes the stretch; the inner one is short.
             */}
            <div>
              <div className="public-section-marker flex flex-col gap-6">
                {label}
                {heading}
              </div>
            </div>
            <div
              className={
                layout === "split"
                  ? "grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-2"
                  : "flex flex-col gap-12"
              }
            >
              {children}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A section's supporting line, one step under the heading.
 *
 * `public-rise` is a viewport-driven reveal, GATED TWICE (scroll-driven support, and
 * `prefers-reduced-motion: no-preference`). Outside those gates it is simply visible — motion never
 * carries the only copy of a sentence.
 */
export function PublicLede({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="public-rise max-w-[var(--measure-prose)] text-title leading-relaxed text-pretty text-fg-secondary">
      {children}
    </p>
  );
}

/** Body prose, bounded by the character measure rather than by a pixel width. */
export function PublicProse({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="max-w-[var(--measure-prose)] text-body leading-relaxed text-pretty text-fg-secondary">
      {children}
    </p>
  );
}
