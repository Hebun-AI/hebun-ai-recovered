/*
 * The trace — one continuous drawn path down the public homepage.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 *
 * A hairline in the page's left margin, with a second line in Hebun blue whose LENGTH follows how
 * far down this document the viewport has moved. Junctions are marked where the major sections
 * begin. It is the site's signature device and the start of a visual language: precision, boundary,
 * a path drawn rather than a beam lit.
 *
 * ── WHAT IT IS NOT, AND THIS IS A TRUTH RULE ─────────────────────────────────
 *
 * IT DOES NOT TRACK, RECORD, AUDIT, STORE OR REPORT ANYTHING ABOUT THE READER. There is no
 * listener, no measurement kept, no value sent anywhere and no state that outlives the paint. It is
 * a CSS scroll-driven animation and nothing else: the browser draws a line as its own scroll
 * position changes.
 *
 * It must never be described to a reader as a record of their visit, and it must never be presented
 * as an instance of Hebun's audit records. Hebun's records are written by governed acts inside a
 * tenant's own workspace. A line on a marketing page has nothing to do with them, and letting the
 * two be confused would be the site claiming a mechanism it is not running.
 *
 * ── WHY IT IS PURE CSS ───────────────────────────────────────────────────────
 *
 * No dependency was installed and no client component exists for it. `animation-timeline` draws it
 * where the browser supports it; where it does not, the ungated rules in `globals.css` leave the
 * trace complete rather than blank. A reader who asked for reduced motion gets the same complete,
 * static trace.
 *
 * `aria-hidden` on the whole apparatus: it is a drawing, it says nothing a screen reader has any
 * use for, and every piece of information on this page is in its prose.
 */
export function PublicTrace({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="public-trace">
      <div aria-hidden="true" className="public-trace-frame">
        <span className="public-trace-line" />
        <span className="public-trace-progress" />
      </div>
      {children}
    </div>
  );
}

/** The head of the path, drawn once, inside the hero. */
export function PublicTraceOrigin() {
  return <span aria-hidden="true" className="public-trace-origin top-0.5" />;
}
