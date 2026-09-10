/*
 * youtube-channel-surface/channel-measurement-comparison.ts — HEBUN CALCULATED, for the first time
 * in the Social Intelligence line.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "Between the instant Hebun observed T₁ and the instant it observed T₂, the count YouTube
 *    reported changed by N."
 *
 * NOT "the channel grew", not "engagement improved", not "this needs attention". A number and the
 * two numbers it came from. Whether a change of +1 is good news is a judgement about a business,
 * and this module has no evidence for one and no field to carry it.
 *
 * ── WHY `change` AND NOT `delta` ────────────────────────────────────────────
 *
 * Repository vocabulary decided this, not taste. `delta` appears in exactly two places in this
 * codebase today: fabricated dashboard fixtures (`director/mock.ts` carries `delta: "+8.4%"` with a
 * `deltaDirection: "up"`, and one page hard-codes `delta="+0.4%"`), and prose in released modules
 * promising that no delta is computed. Both meanings are wrong for this file. Putting Hebun's FIRST
 * REAL calculated value into the same word as the vanity fixtures the repository has been steadily
 * deleting would make the true number look like one of them. `change` carries no such history — a
 * search for it as a computed noun returns nothing.
 *
 * ── THE SHAPE FOLLOWS `elapsedSince` (E2-4) ─────────────────────────────────
 *
 * The released precedent for honest arithmetic in this repository carries BOTH endpoints beside the
 * computed number, names the arithmetic plainly (`milliseconds`, not "duration score"), and returns
 * nothing at all when an endpoint is unusable. This file does the same: `previous` and `latest` sit
 * next to `change`, so a reader can recheck the subtraction against the evidence rather than trust
 * it.
 *
 * ── A PURE DERIVATION OVER A PURE DERIVATION ────────────────────────────────
 *
 * It consumes the released YT-SOC1 series and nothing else — no database, no provider, no tenant, no
 * clock, no persistence. Nothing is stored: the calculation is reproducible from the observations at
 * any time, which is why there is no analytics table and no cache.
 */
import type {
  YouTubeChannelMeasurementPoint,
  YouTubeChannelMeasurementSeries,
  YouTubeSubscriberCountAbsence,
} from "./channel-measurement-series";

/**
 * WHY A METRIC COULD NOT BE COMPARED.
 *
 * Never "no data". Which SIDE is missing is the fact a reader needs: a metric the provider stopped
 * reporting and a metric it only just started reporting are different situations, and both differ
 * from one it has never reported.
 */
export type MetricComparabilityGap =
  | "previous-not-reported"
  | "latest-not-reported"
  | "neither-reported";

/**
 * One metric across two instants.
 *
 * `comparable` carries the arithmetic AND both inputs. `not-comparable` carries whatever WAS
 * reported — a present endpoint is not discarded just because its partner is missing — and never
 * substitutes zero for the absent one. **An absent baseline does not make the latest value a change
 * from nothing; it makes the change unknowable.**
 */
export type YouTubeMetricComparison =
  | {
      readonly status: "comparable";
      readonly previous: number;
      readonly latest: number;
      /** HEBUN CALCULATED: `latest - previous`. Zero is a result, not an absence. */
      readonly change: number;
    }
  | {
      readonly status: "not-comparable";
      readonly gap: MetricComparabilityGap;
      readonly previous: number | null;
      readonly latest: number | null;
    };

/**
 * The subscriber count, which alone can be missing for a REASON Hebun knows.
 *
 * YT-SOC1 already distinguishes a count the channel hides from one YouTube did not report. That
 * distinction must survive the comparison: "we cannot compare subscribers because the owner hides
 * them" and "we cannot compare subscribers because the provider went quiet" are different sentences
 * to put in front of a human, and only one of them suggests anything is wrong.
 */
export type YouTubeSubscriberComparison =
  | {
      readonly status: "comparable";
      readonly previous: number;
      readonly latest: number;
      readonly change: number;
    }
  | {
      readonly status: "not-comparable";
      readonly gap: MetricComparabilityGap;
      readonly previous: number | null;
      readonly latest: number | null;
      readonly previousAbsence: YouTubeSubscriberCountAbsence | null;
      readonly latestAbsence: YouTubeSubscriberCountAbsence | null;
    };

/**
 * What the evidence supports.
 *
 * The first three states are passed through from the series unchanged — a comparison cannot know
 * more about the evidence than the series it was built from. `insufficient-history` is the state
 * this module adds: measurements exist, but not two of them.
 */
export type YouTubeChannelComparison =
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    }
  | { readonly status: "no-observations" }
  | {
      readonly status: "no-usable-measurements";
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "insufficient-history";
      readonly measurementsAvailable: number;
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "compared";
      /** HEBUN OBSERVED — the window the arithmetic below spans. */
      readonly previousObservedAt: string;
      readonly latestObservedAt: string;
      readonly observationsConsidered: number;
      readonly subscriberCount: YouTubeSubscriberComparison;
      readonly videoCount: YouTubeMetricComparison;
      readonly viewCount: YouTubeMetricComparison;
    };

function gapOf(previous: number | null, latest: number | null): MetricComparabilityGap {
  if (previous === null && latest === null) return "neither-reported";
  return previous === null ? "previous-not-reported" : "latest-not-reported";
}

function compareMetric(previous: number | null, latest: number | null): YouTubeMetricComparison {
  if (previous === null || latest === null) {
    return Object.freeze({ status: "not-comparable" as const, gap: gapOf(previous, latest), previous, latest });
  }
  /* THE WHOLE CALCULATION. `0 - 0` is `0`, and that is an answer. */
  return Object.freeze({ status: "comparable" as const, previous, latest, change: latest - previous });
}

function compareSubscribers(
  previous: YouTubeChannelMeasurementPoint,
  latest: YouTubeChannelMeasurementPoint,
): YouTubeSubscriberComparison {
  if (previous.subscriberCount === null || latest.subscriberCount === null) {
    return Object.freeze({
      status: "not-comparable" as const,
      gap: gapOf(previous.subscriberCount, latest.subscriberCount),
      previous: previous.subscriberCount,
      latest: latest.subscriberCount,
      previousAbsence: previous.subscriberCountAbsence,
      latestAbsence: latest.subscriberCountAbsence,
    });
  }
  return Object.freeze({
    status: "comparable" as const,
    previous: previous.subscriberCount,
    latest: latest.subscriberCount,
    change: latest.subscriberCount - previous.subscriberCount,
  });
}

/**
 * Compare the two most recent measurements in a released YT-SOC1 series.
 *
 * ── WHY THE LAST TWO, AND NOT "THE MOST RECENT COMPARABLE PAIR" ─────────────
 *
 * Searching backwards for the most recent pair that happens to share a reported metric would make
 * the comparison window VARY per metric and per run, silently — a subscriber change measured across
 * six days sitting beside a view change measured across one, with nothing on the surface saying so.
 * The window is fixed at the last two measurements and stated in the result, so an unreported metric
 * shows up as a gap the reader can see rather than as a longer reach nobody mentioned.
 *
 * Every metric is then compared INDEPENDENTLY inside that one window: a hidden subscriber count
 * narrows the answer to subscribers alone and leaves videos and views comparable beside it.
 */
export function compareYouTubeChannelMeasurements(
  series: YouTubeChannelMeasurementSeries,
): YouTubeChannelComparison {
  if (series.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: series.reason });
  }
  if (series.status === "no-observations") return Object.freeze({ status: "no-observations" as const });
  if (series.status === "no-usable-measurements") {
    return Object.freeze({
      status: "no-usable-measurements" as const,
      observationsConsidered: series.observationsConsidered,
    });
  }
  if (series.status === "single-measurement") {
    return Object.freeze({
      status: "insufficient-history" as const,
      measurementsAvailable: 1,
      observationsConsidered: series.observationsConsidered,
    });
  }

  /* The series is oldest-first, so the comparison window is its final pair. */
  const latest = series.points[series.points.length - 1]!;
  const previous = series.points[series.points.length - 2]!;

  return Object.freeze({
    status: "compared" as const,
    previousObservedAt: previous.observedAt,
    latestObservedAt: latest.observedAt,
    observationsConsidered: series.observationsConsidered,
    subscriberCount: compareSubscribers(previous, latest),
    videoCount: compareMetric(previous.videoCount, latest.videoCount),
    viewCount: compareMetric(previous.viewCount, latest.viewCount),
  });
}

/* ── The words a surface may use about this evidence ───────────────────────── */

/**
 * What each non-comparable state means, in the words a human should read.
 *
 * There is deliberately NO sentence for `compared`. A comparison speaks for itself in numbers, and
 * any sentence Hebun wrote about it — "subscribers held steady", "views are down" — would be an
 * interpretation this phase has no authority to make. The absence of that entry is the boundary.
 */
export const YOUTUBE_CHANNEL_COMPARISON_SENTENCES: Readonly<
  Record<
    | "unauthenticated"
    | "persistence-unavailable"
    | "no-observations"
    | "no-usable-measurements"
    | "insufficient-history",
    string
  >
> = Object.freeze({
  unauthenticated:
    "This session could not be resolved, so no stored channel measurements were read. Whether any " +
    "change occurred is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so whether any change occurred is " +
    "unknown. This is not a statement that nothing changed.",
  "no-observations":
    "Hebun has stored no YouTube channel observation for this organization yet. Nothing was asked " +
    "of YouTube and nothing failed.",
  "no-usable-measurements":
    "Hebun holds channel observations, but YouTube reported no subscriber, video or view count in " +
    "them. There is nothing to compare — a fact about what the provider said, not about this channel.",
  "insufficient-history":
    "Hebun holds one channel measurement. A comparison needs two observations of the same channel, " +
    "and the second has not been made yet. Hebun will not compare a measurement against an " +
    "assumed starting point.",
});
