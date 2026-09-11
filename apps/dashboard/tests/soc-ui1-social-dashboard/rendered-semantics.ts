/*
 * SOC-UI1 — what a human actually RECEIVES from the rendered surface.
 *
 * The composition tests prove the model's answers. These render the real components to markup and
 * assert the sentences and accessible names that come out the other side. Every case here exists
 * because visual acceptance caught the product saying something the model was right about — a model
 * can be perfectly honest and still be presented into a lie.
 *
 * ── WHY `createElement` AND NOT JSX ─────────────────────────────────────────
 *
 * This file was written as `.tsx` first, and the full regression silently SKIPPED it: the runner
 * collects `tests/**\/*.ts` only, so the one suite guarding the defects acceptance had just found
 * never ran. A test that exists and does not run is worse than no test, because the suite reports
 * green for a guard nobody is executing.
 *
 * The fix is local rather than a change to shared infrastructure: components are constructed with
 * `createElement` — which is what JSX compiles to anyway — and the file is a `.ts` the runner
 * already collects. The runner's blindness to `.tsx` is worth fixing for the next UI phase, since
 * it costs a whole suite silently, but that is not this phase's to widen into.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MeasurementSeriesChart } from "../../src/components/social-intelligence/measurement-series-chart";
import { PlatformSummaryCard } from "../../src/components/social-intelligence/platform-summary-card";
import { CalculatedChange } from "../../src/components/social-intelligence/calculated-change";
import type {
  SocialChangeBlock,
  SocialPlatformCard,
  SocialSeriesPoint,
} from "../../src/features/social-intelligence/dashboard-model";

/** Markup with tags removed — what is left is what a reader is given, sighted or not. */
const textOf = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const point = (observedAt: string, value: number | null, metric: string): SocialSeriesPoint => ({
  observedAt,
  values: { [metric]: value },
});

const chart = (points: readonly SocialSeriesPoint[], metric: string, metricLabel: string): string =>
  renderToStaticMarkup(createElement(MeasurementSeriesChart, { points, metric, metricLabel }));

/* ── The defect visual acceptance found ────────────────────────────────────── */

function oneMeasurementNeverClaimsTheValueDidNotMove(): void {
  /*
   * THE BUG, EXACTLY AS IT REACHED THE RENDERED SURFACE.
   *
   * The chart branched on `max === min` to decide the line was level. With ONE point that is
   * trivially true, so Instagram's single measurement — 56 followers, observed once — was captioned
   * "Every observation reported 56. The line is level because the value did not move." Nothing had
   * moved because nothing COULD have: there is no earlier observation for it to have moved from.
   * That is a comparison invented out of a length-one array, which is the precise thing this whole
   * phase forbids.
   */
  const text = textOf(
    chart([point("2026-09-10T08:00:18.986Z", 56, "Followers")], "Followers", "Followers Instagram reported"),
  );
  assert.ok(!/did not move/i.test(text), `a single measurement must not claim a value held steady:\n${text}`);
  assert.ok(!/every observation/i.test(text), "one observation is not 'every observation'");
  assert.ok(/one measurement/i.test(text), `it says what it actually has:\n${text}`);
  /* And the number itself still reaches the reader. A single point is evidence, not an empty state. */
  assert.ok(/\b56\b/.test(text), "the measured value is still rendered");
  assert.ok(!/no data/i.test(text), "a single measurement is never 'no data'");
}

function oneMeasurementDrawsOneDateNotASpan(): void {
  const markup = chart(
    [point("2026-09-10T08:00:18.986Z", 56, "Followers")],
    "Followers",
    "Followers Instagram reported",
  );
  /*
   * The AXIS printed "10 Sept … 10 Sept" — a span between an instant and itself. Only the axis is
   * counted: the textual-equivalent table legitimately carries the same day in its own row, at full
   * precision, and counting that too would forbid the evidence rather than the false span.
   */
  const occurrences = markup.match(/>10 Sept</g) ?? [];
  assert.ok(
    occurrences.length <= 1,
    `one measurement gets one axis date, not a span from a day to itself: ${occurrences.length} found`,
  );
}

function aGenuinelyFlatSeriesMayStillSayItHeldLevel(): void {
  /* Four real zeros DID hold level across four observations, and saying so is accurate. */
  const text = textOf(
    chart(
      [
        point("2026-09-07T14:40:20.113Z", 0, "Subscribers"),
        point("2026-09-08T09:03:57.382Z", 0, "Subscribers"),
        point("2026-09-09T10:00:20.919Z", 0, "Subscribers"),
        point("2026-09-10T11:00:20.489Z", 0, "Subscribers"),
      ],
      "Subscribers",
      "Subscribers YouTube reported",
    ),
  );
  assert.ok(/did not move/i.test(text), "a real four-point flat series may say the value held level");
  assert.ok(!/no data/i.test(text), "and it is never 'no data'");
  /* Every zero reaches the textual equivalent as the character "0". */
  assert.equal((text.match(/UTC 0\b/g) ?? []).length, 4, "all four zeros are announced as zero");
}

function anUnreportedPointIsNotAnnouncedAsZero(): void {
  const text = textOf(
    chart(
      [
        point("2026-09-09T10:00:20.919Z", null, "Subscribers"),
        point("2026-09-10T11:00:20.489Z", 4, "Subscribers"),
      ],
      "Subscribers",
      "Subscribers YouTube reported",
    ),
  );
  assert.ok(/not reported/i.test(text), "the gap is announced as not reported");
  assert.ok(!/UTC 0\b/.test(text), "and never as the number zero");
}

/* ── Accessible names ──────────────────────────────────────────────────────── */

const card = (over: Partial<SocialPlatformCard> = {}): SocialPlatformCard => ({
  key: "instagram",
  label: "Instagram",
  subjectNoun: "account",
  presence: { status: "live", accountLabel: "@turkishrughousecom", lastVerifiedAt: null },
  provenance: "authoritative",
  metrics: [
    { label: "Followers Instagram reported", shortLabel: "Followers", value: 56, display: "56", reported: true, absence: null },
    { label: "Media Instagram reported", shortLabel: "Posts", value: 0, display: "0", reported: true, absence: null },
  ],
  observedAt: "2026-09-10T08:00:18.986Z",
  evidence: "observed",
  evidenceSentence: null,
  ...over,
});

const renderCard = (over: Partial<SocialPlatformCard> = {}): string =>
  renderToStaticMarkup(createElement(PlatformSummaryCard, { card: card(over) }));

function aMetricNameIsReadOnceNotTwice(): void {
  /*
   * ACCEPTANCE HEARD "Followers — Followers Instagram reported". The visible short label and the
   * attributed one were both exposed, so every metric announced its own name twice with a dash
   * between. The attributed name REPLACES the visible one for assistive technology; it does not
   * follow it.
   */
  const markup = renderCard();
  assert.ok(markup.includes('aria-hidden="true">Followers<'), "the visible short label is hidden from AT");
  assert.ok(markup.includes('class="sr-only">Followers Instagram reported<'), "the attributed name replaces it");
  assert.ok(!textOf(markup).includes("Followers — Followers"), "the doubled name is gone");
}

function aRealZeroMetricIsAnnouncedAsZero(): void {
  const text = textOf(renderCard());
  assert.ok(/\b0\b/.test(text), "a zero post count is rendered as the digit");
  assert.ok(!/—/.test(text), "and never as the unreported dash");
}

function anAbsentMetricCarriesItsReason(): void {
  const text = textOf(
    renderCard({
      metrics: [
        {
          label: "Subscribers YouTube reported",
          shortLabel: "Subscribers",
          value: null,
          display: "—",
          reported: false,
          absence: "This channel hides its subscriber count, so YouTube did not report one.",
        },
      ],
    }),
  );
  assert.ok(/hides its subscriber count/.test(text), "the dash is never the only thing announced");
}

const CHANGE: SocialChangeBlock = {
  status: "compared",
  previousObservedAt: "2026-09-09T10:00:20.919Z",
  latestObservedAt: "2026-09-10T11:00:20.489Z",
  cells: [
    {
      shortLabel: "Subscribers",
      label: "Subscribers YouTube reported",
      status: "comparable",
      previous: 0,
      latest: 0,
      change: 0,
      display: "0",
      note: null,
    },
  ],
};

function aZeroChangeReadsAsAResultWithItsInputs(): void {
  const text = textOf(
    renderToStaticMarkup(
      createElement(CalculatedChange, { block: CHANGE, provenance: "derived", platformLabel: "YouTube" }),
    ),
  );
  assert.ok(/Change in Subscribers YouTube reported/.test(text), "the change names its metric once, attributed");
  assert.ok(/from 0 to 0/.test(text), "both endpoints are announced beside the result");
  assert.ok(/difference between those two observations/.test(text), "the window is stated");
  for (const verdict of ["stable", "steady", "no growth", "no change", "flat", "unchanged"]) {
    assert.ok(
      !new RegExp(`\\b${verdict}\\b`, "i").test(text),
      `a zero change carries no verdict — found "${verdict}"`,
    );
  }
}

function main(): void {
  oneMeasurementNeverClaimsTheValueDidNotMove();
  oneMeasurementDrawsOneDateNotASpan();
  aGenuinelyFlatSeriesMayStillSayItHeldLevel();
  anUnreportedPointIsNotAnnouncedAsZero();
  aMetricNameIsReadOnceNotTwice();
  aRealZeroMetricIsAnnouncedAsZero();
  anAbsentMetricCarriesItsReason();
  aZeroChangeReadsAsAResultWithItsInputs();
  console.log("SOC-UI1 rendered semantics checks passed");
}

main();
