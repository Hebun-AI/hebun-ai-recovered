/*
 * measurement-series-chart.tsx — the stored measurements of ONE metric, plotted against the instants
 * Hebun observed them.
 *
 * ── WHY THERE IS NO CHART LIBRARY ───────────────────────────────────────────
 *
 * This repository has none, and SOC-UI1 did not add one. The evidence a chart library would be
 * carrying here is four measurements of one channel and one measurement of one account. A library
 * earns its bundle when a surface needs axes it cannot compute, interaction it cannot write, or
 * chart forms it cannot draw; none of that is true of a handful of points on a time axis, and
 * shipping a dependency to draw them would be paying a permanent cost for a temporary shortcut.
 *
 * That is a decision about THIS shape of evidence. A phase that needs stacked series, brushing, or
 * a hundred points per view should ask for a library rather than grow this file into one.
 *
 * ── WHY THE SVG DRAWS NO TEXT ───────────────────────────────────────────────
 *
 * Every label around this plot is HTML, outside the SVG. Text inside a scaled `viewBox` shrinks with
 * the box, which is exactly how a chart ends up with axis labels no one can read on a phone. The SVG
 * carries geometry only; the words keep the page's own type scale at every width.
 *
 * ── WHY IT IS HIDDEN FROM ASSISTIVE TECHNOLOGY ──────────────────────────────
 *
 * The plot is `aria-hidden`, and every point it draws is also rendered as a real table row in a
 * visually-hidden `<table>`. A chart summarised as "a line chart of subscribers" hands a
 * screen-reader user a description instead of the evidence. The table hands them the evidence: each
 * instant, each value, and the word "0" where the provider reported a zero.
 *
 * ── WHAT IT REFUSES TO DRAW ─────────────────────────────────────────────────
 *
 * A null is a gap, never a point on the baseline: the line BREAKS across a count the provider did
 * not report, because joining through it would draw a zero nobody gave. And a flat series is drawn
 * flat — the channel this was built for genuinely reports 0 across every observation, and a plot
 * that stretched that into a slope, or refused to render it as "no data", would both be describing
 * successful evidence as something else.
 *
 * Server component — no client state, no interaction, no fetch.
 */
import type { SocialSeriesPoint } from "@/features/social-intelligence/dashboard-model";
import { METRIC_UNREPORTED_DISPLAY } from "@/features/social-intelligence/contracts";

/* Geometry only. The box is wide and short because a time series is read left to right. */
const VIEW_W = 640;
const VIEW_H = 120;
const PAD_X = 10;
const PAD_Y = 14;

function instantMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Day + time, in UTC, at the page's own type size. Never a relative phrase like "2 days ago". */
const AXIS_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const FULL_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export interface MeasurementSeriesChartProps {
  readonly points: readonly SocialSeriesPoint[];
  /** The metric's scannable identity — the key into each point's `values`. */
  readonly metric: string;
  /** The metric's attributed identity: "Subscribers YouTube reported". */
  readonly metricLabel: string;
}

export function MeasurementSeriesChart({ points, metric, metricLabel }: MeasurementSeriesChartProps) {
  if (points.length === 0) return null;

  const values = points.map((point) => point.values[metric] ?? null);
  const reported = values.filter((value): value is number => value !== null);

  /*
   * THE VERTICAL SCALE IS CHOSEN, AND SAID OUT LOUD BELOW.
   *
   * When every reported value is the same — which is this channel's real situation — there is no
   * range to scale into, so the line is drawn at the middle of the box and the constant is printed
   * beside it. Inventing a range to make a flat series look eventful is the exact failure this
   * whole phase exists to avoid.
   */
  const max = reported.length > 0 ? Math.max(...reported) : 0;
  const min = reported.length > 0 ? Math.min(...reported) : 0;
  const flat = max === min;

  const times = points.map((point) => instantMs(point.observedAt));
  const firstMs = times[0]!;
  const lastMs = times[times.length - 1]!;
  const span = lastMs - firstMs;

  /*
   * X IS TIME, NOT INDEX. The observations are not evenly spaced — one gap here is 18 hours and the
   * next is 25 — and spacing them evenly would draw a cadence Hebun does not have.
   */
  const x = (ms: number): number =>
    span === 0 ? VIEW_W / 2 : PAD_X + ((ms - firstMs) / span) * (VIEW_W - PAD_X * 2);
  const y = (value: number): number =>
    flat ? VIEW_H / 2 : VIEW_H - PAD_Y - ((value - min) / (max - min)) * (VIEW_H - PAD_Y * 2);

  /*
   * SEGMENTS, NOT ONE PATH. A single `polyline` would join across an unreported count and draw a
   * value the provider never gave; a break is the honest mark for a gap.
   */
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((point, index) => {
    const value = values[index];
    if (value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${x(times[index]!).toFixed(2)},${y(value).toFixed(2)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  /*
   * ── THE NOTE MUST NOT DESCRIBE MOVEMENT THAT HAS NO EVIDENCE ──────────────
   *
   * A first version of this line read "the value did not move" whenever `max === min`, and visual
   * acceptance caught it saying exactly that under Instagram's SINGLE measurement. One observation
   * cannot have failed to move: there is no second point to have moved from, and claiming otherwise
   * is the same fabrication as drawing a trend through one dot — a comparison invented out of a
   * length-one array.
   *
   * So the single-measurement case has its OWN sentence, and "did not move" is reserved for a
   * series that genuinely has two or more points to be level across.
   */
  const single = points.length === 1;
  /*
   * WHERE THE LABEL GOES: the last point that was actually REPORTED. If the newest observation
   * withheld the count, the label falls back to the most recent one that did not — labelling a gap
   * would put a number on an instant the provider stayed silent about.
   */
  let lastIndex = -1;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null) {
      lastIndex = i;
      break;
    }
  }
  const lastReported = lastIndex === -1 ? null : values[lastIndex]!;
  const labelLeft = lastIndex === -1 ? 50 : (x(times[lastIndex]!) / VIEW_W) * 100;
  const labelTop = lastIndex === -1 ? 50 : (y(lastReported!) / VIEW_H) * 100;

  const scaleNote = single
    ? `One measurement. A line needs two points, so there is nothing here to draw between.`
    : flat
      ? `Every observation reported ${max}. The line is level because the value did not move.`
      : `Vertical range ${min} to ${max}.`;

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-2">
      {/*
        THE PLOT IS GEOMETRY, AND IS NOT THE ONLY COPY OF THE EVIDENCE. It is hidden from assistive
        technology because the table below carries the same points with their identities intact.
      */}
      <div className="relative rounded-lg border border-border bg-surface-sunken px-3 py-2">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="h-28 w-full sm:h-32"
          aria-hidden="true"
          focusable="false"
        >
          {/*
            The reference line for the value the series sits on. Dashed, so a level line reads as a
            deliberate baseline rather than as an axis the data failed to leave.
          */}
          <line
            x1={PAD_X}
            x2={VIEW_W - PAD_X}
            y1={flat ? VIEW_H / 2 : VIEW_H - PAD_Y}
            y2={flat ? VIEW_H / 2 : VIEW_H - PAD_Y}
            stroke="var(--color-border-strong)"
            strokeWidth={1}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />

          {segments.map((segment) => (
            <polyline
              key={segment}
              points={segment}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              /* Without this the non-uniform viewBox scale would smear the stroke horizontally. */
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {points.map((point, index) => {
            const value = values[index];
            if (value === null) return null;
            return (
              <circle
                key={point.observedAt}
                cx={x(times[index]!)}
                cy={y(value)}
                r={3}
                fill="var(--color-surface)"
                stroke="var(--color-primary)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/*
          ── THE LATEST VALUE, ON THE PLOT ─────────────────────────────────────
          Design review found the plot area was the weakest thing on the page: a level line and a
          lone dot both said "here is a shape" and left the reader to go and find the number
          somewhere else. A flat series especially reads as a broken chart until the value it is
          flat AT is visible on it.

          IT IS HTML, NOT SVG TEXT. The viewBox stretches with `preserveAspectRatio="none"`, which
          would distort any text drawn inside it and shrink it on a phone. Positioned as a
          percentage of the same box, the label lands on the point without inheriting the scale.

          It is `aria-hidden` — the value is already in the table below, and announcing it twice
          would make every chart read its endpoint out of order.
        */}
        {lastReported !== null ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[150%] rounded-md border border-border bg-surface px-1.5 py-0.5 text-label font-semibold text-fg tabular-nums shadow-xs"
            style={{
              /* Clamped away from the edges so the label never leaves the plot it belongs to. */
              left: `calc(${Math.min(Math.max(labelLeft, 8), 92)}% + 0.75rem)`,
              top: `calc(${labelTop}% + 0.5rem)`,
            }}
          >
            {lastReported}
          </span>
        ) : null}
      </div>

      {/*
        The time axis, in HTML, at the page's own size. Endpoints only — the table carries the rest.
        A SINGLE measurement gets ONE date: printing the same day at both ends of an axis draws a
        span between an instant and itself.
      */}
      {single ? (
        /*
         * ONE MEASUREMENT PUTS ITS DATE UNDER ITS DOT.
         *
         * Authenticated acceptance caught the axis printing "10 Sept" hard against the LEFT edge
         * while the only plotted point sat in the CENTRE — the reader's eye had to cross the box to
         * pair a date with the mark it belongs to, and at a glance the date looked like the start of
         * a range that does not exist. A single instant is centred, because that is where the
         * evidence is drawn.
         */
        <p className="text-center text-label text-fg-muted text-pretty">
          <span className="font-medium text-fg-secondary">{AXIS_FORMAT.format(new Date(firstMs))}</span>
          {" · "}
          {scaleNote}
        </p>
      ) : (
        <div className="flex items-baseline justify-between gap-3 text-label text-fg-muted">
          <span>{AXIS_FORMAT.format(new Date(firstMs))}</span>
          <span className="text-center text-pretty">{scaleNote}</span>
          <span>{AXIS_FORMAT.format(new Date(lastMs))}</span>
        </div>
      )}

      {/*
        THE EVIDENCE, IN FULL, FOR EVERY READER WHO IS NOT LOOKING AT THE PLOT.
        `sr-only` hides it visually and from nobody else. A zero appears here as the character "0",
        which is the whole point: it must be ANNOUNCED as zero, never skipped as missing.
      */}
      <table className="sr-only">
        <caption>{metricLabel}, at each instant Hebun observed.</caption>
        <thead>
          <tr>
            <th scope="col">Observed by Hebun</th>
            <th scope="col">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.observedAt}>
              <th scope="row">{FULL_FORMAT.format(new Date(instantMs(point.observedAt)))} UTC</th>
              <td>
                {values[index] === null
                  ? `${METRIC_UNREPORTED_DISPLAY} not reported`
                  : String(values[index])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption className="sr-only">{scaleNote}</figcaption>
    </figure>
  );
}
