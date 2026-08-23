/*
 * The system plate — the object that breaks the hero's fold.
 *
 * ── WHY THERE IS AN OBJECT AT ALL ────────────────────────────────────────────
 *
 * A premium product surface ends its first screen mid-object, so that scrolling is how you finish
 * reading the thing you are already looking at. Every reference does this with a screenshot of the
 * application. Hebun cannot: a screenshot would carry either a real organization's records or
 * invented ones, and a product whose argument is "we show you the actual evidence" may not open by
 * showing evidence it made up.
 *
 * So the object is a TECHNICAL PLATE rather than an interface. Hairline border, registration ticks
 * at the corners, a spine the trace runs along, and three numbered stations. There is no window
 * chrome, no cursor, no fake data, no chart and no control that does nothing.
 *
 * ── WHAT IS ON IT ────────────────────────────────────────────────────────────
 *
 * The three sentences PUB-1 published as a flat strip of text under the hero — unchanged, and not
 * a word added. The strip stated them; the plate SEQUENCES them, which is the actual claim: these
 * three things happen in this order, and the second cannot happen before the first.
 *
 * The plate reports NOTHING. No station is lit by a state, no number counts anything, and the spine
 * is drawn by the viewport's own scroll position. Nothing here is a function of any value.
 */
const STATIONS = [
  { step: "01", statement: "Answers name the records behind them." },
  { step: "02", statement: "An action carries a permit before it runs." },
  { step: "03", statement: "Governed acts write durable audit records." },
] as const;

export function SystemPlate() {
  return (
    <div className="public-plate px-6 py-8 sm:px-10 sm:py-10">
      <span aria-hidden="true" className="public-tick public-tick-tl" />
      <span aria-hidden="true" className="public-tick public-tick-tr" />
      <span aria-hidden="true" className="public-tick public-tick-bl" />
      <span aria-hidden="true" className="public-tick public-tick-br" />

      <p className="mb-8 font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
        The path an act takes
      </p>

      {/*
        * The spine is absolute on desktop and runs through the stations' own row; on a phone the
        * stations stack and the trace rail in the margin already provides the vertical line, so no
        * second spine is drawn beside it.
        */}
      <ol className="relative grid grid-cols-1 gap-y-8 lg:grid-cols-3 lg:gap-x-10">
        <span
          aria-hidden="true"
          className="public-spine public-spine-h hidden lg:block"
        />
        <span
          aria-hidden="true"
          className="public-spine-live public-spine-h hidden lg:block"
        />
        {STATIONS.map((station, i) => (
          <li key={station.step} className="relative flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {/*
                * The two offsets stagger the three marks along the SAME scroll range the spine is
                * drawn on, so a station can never be marked before the line reaches it. They are
                * positions on the plate's view timeline, not clock delays.
                */}
              <span
                aria-hidden="true"
                className="public-station shrink-0"
                style={{
                  ["--station-start" as string]: `${16 + i * 12}%`,
                  ["--station-end" as string]: `${34 + i * 12}%`,
                }}
              />
              <span className="font-mono text-label tracking-[0.16em] text-fg-muted tabular-nums">
                {station.step}
              </span>
            </div>
            <p className="max-w-[26ch] text-title font-semibold leading-snug text-fg">
              {station.statement}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
