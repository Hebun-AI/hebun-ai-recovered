/*
 * youtube-channel-surface/channel-measurement-series.ts — what YouTube reported about this channel,
 * at each instant Hebun looked.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "YouTube reported these counts at instant T₁, and these at instant T₂."
 *
 * NOT "the channel is growing", not "engagement is low", not "this needs attention". It orders
 * measurements and says how many comparable ones exist. It performs NO arithmetic between them —
 * a difference is a HEBUN CALCULATION and belongs to YT-SOC2, which has been asked for it. There is
 * deliberately no field on any type below in which a derived number could be placed.
 *
 * ── WHY THIS IS NOT A GENERALIZATION OF THE INSTAGRAM DERIVATION ────────────
 *
 * IG-AN1 and this file share CONVENTIONS — five evidence states, oldest-first ordering, `null` is
 * never zero, no field for a derived number. They deliberately share no CODE, because they do not
 * share semantics:
 *
 *   Instagram followers  != YouTube subscribers   (one can be hidden by its owner; the other cannot)
 *   Instagram mediaCount != YouTube videoCount    (different objects, different provider rules)
 *   Instagram has        no analogue at all       for `hiddenSubscriberCount`
 *
 * A shared `SocialMeasurementSeries<T>` would have to erase that third line to exist. The moment it
 * did, a caller could ask a generic question — "what is this account's audience?" — that no provider
 * actually answers. Two small honest modules cost less than one abstraction that lies.
 *
 * ── A PURE DERIVATION ───────────────────────────────────────────────────────
 *
 * No I/O, no database, no provider, no tenant resolution, no clock. It is handed the result the
 * released read seam already produced, so it cannot become a second reader, cannot widen a tenant
 * predicate it never sees, and cannot outlive the kill switch that governs the read.
 *
 * THE CALLER MUST SCOPE THE READ to `youtube.channel.public.read`. This function reads the channel
 * fact vocabulary; a caller who passes another capability's observations will correctly get
 * `no-usable-measurements` rather than nonsense, but naming the capability remains the caller's
 * obligation.
 */
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";

/**
 * How many channel observations a caller should ask the read seam for.
 *
 * The released standing authorization observes this scope every 1440 minutes, so 30 observations is
 * roughly a month of history — long enough to be meaningful, short enough that a surface renders a
 * bounded amount. The seam permits 50, but "the maximum is available" is not a reason to ask for it:
 * a limit chosen by what a surface can honestly use is a decision; a limit chosen by what the API
 * allows is an accident.
 *
 * It matches the Instagram bound by coincidence of cadence, not by inheritance — they are separate
 * constants and either may move without the other.
 *
 * The derivation below works on whatever it is given. This is the RECOMMENDATION a caller passes,
 * not a bound this module enforces.
 */
export const YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT = 30 as const;

/** The exact fact keys the released YouTube channel mapper writes. Named, never discovered. */
const SUBSCRIBER_COUNT = "subscriberCount";
const HIDDEN_SUBSCRIBER_COUNT = "hiddenSubscriberCount";
const VIDEO_COUNT = "videoCount";
const VIEW_COUNT = "viewCount";

/**
 * WHY A SUBSCRIBER COUNT IS MISSING — a provider fact, not an interpretation.
 *
 * The released provider contract states that `subscriberCount` is null when the channel HIDES it or
 * when YouTube OMITTED it, and that `hiddenSubscriberCount` is what tells those apart. Carrying only
 * the `null` would discard the single fact that distinguishes a deliberate choice by the channel's
 * owner from a gap in the provider's answer — and a surface would have no honest way to say which.
 *
 * `null` here means the count was reported, so there is no absence to explain.
 */
export type YouTubeSubscriberCountAbsence = "hidden-by-channel" | "not-reported";

/**
 * One measurement: what YouTube reported, and when Hebun looked.
 *
 * Every count is `number | null`, and `null` means the provider did not report it — never zero.
 * **A zero is a measurement.** The channel this was built for genuinely reports 0 subscribers,
 * 0 videos and 0 views; that is YouTube answering, not YouTube staying silent, and nothing here may
 * turn it into an absence.
 *
 * `videoCount` is the channel's own total. It is deliberately NOT `recentVideoCount`, which counts
 * one bounded page of uploads — conflating them would let a page look like a total.
 *
 * The channel id and title are absent: the series belongs to the tenant's own channel by
 * construction, and carrying a provider identifier through a measurement type invites it onto a
 * screen.
 */
export interface YouTubeChannelMeasurementPoint {
  /** HEBUN OBSERVED. The stored instant, exactly as recorded. */
  readonly observedAt: string;
  /** YOUTUBE REPORTED. */
  readonly subscriberCount: number | null;
  /** Why `subscriberCount` is null, or null when it was reported. */
  readonly subscriberCountAbsence: YouTubeSubscriberCountAbsence | null;
  readonly videoCount: number | null;
  readonly viewCount: number | null;
}

/**
 * What the evidence supports — five distinguishable answers, none collapsed into another.
 *
 * `single-measurement` is its own status rather than a one-element array because comparability is
 * the property callers need and a length check is the property they forget. With `series` as the
 * only shape carrying more than one point, a caller cannot reach two measurements without having
 * handled the case where only one exists.
 *
 * `no-usable-measurements` is not `no-observations`: "Hebun holds no channel observation" and
 * "Hebun holds observations in which YouTube reported no counts" are different facts, and reporting
 * the second as the first blames the provider's silence on Hebun's records.
 */
export type YouTubeChannelMeasurementSeries =
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
      readonly status: "single-measurement";
      readonly point: YouTubeChannelMeasurementPoint;
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "series";
      readonly points: readonly YouTubeChannelMeasurementPoint[];
      readonly observationsConsidered: number;
    };

function countFact(facts: ObservationFacts, key: string): number | null {
  const value = (facts as Record<string, unknown>)[key];
  /*
   * A COUNT IS A COUNT ONLY WHEN IT IS A FINITE NUMBER. A numeric string, `NaN`, a boolean or a
   * nested shape are all "the provider did not report a usable count" — carried as `null` rather
   * than parsed into one, because a measurement Hebun had to repair is not a measurement YouTube
   * made.
   */
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A measurement is USABLE when it has a real instant and at least one reported count.
 *
 * An observation whose three counts are all withheld is a real observation of nothing measurable;
 * including it would put a row with no numbers into a series and let a later phase subtract across
 * a gap containing no evidence. A channel that hides its subscribers but reports videos and views
 * is still measurable — the hidden count narrows the row, it does not void it.
 */
function usablePointOf(
  observation: StoredProviderObservation,
): YouTubeChannelMeasurementPoint | null {
  if (typeof observation.observedAt !== "string" || observation.observedAt.length === 0) return null;

  const subscriberCount = countFact(observation.facts, SUBSCRIBER_COUNT);
  const videoCount = countFact(observation.facts, VIDEO_COUNT);
  const viewCount = countFact(observation.facts, VIEW_COUNT);
  if (subscriberCount === null && videoCount === null && viewCount === null) return null;

  /*
   * THE FLAG ONLY EXPLAINS AN ABSENCE. Where a finite count was reported there is nothing to
   * explain, so a contradictory `hiddenSubscriberCount: true` beside a real number does not discard
   * the number — the provider's own count outranks a flag about counts it did not give.
   *
   * And the flag must be the BOOLEAN the contract specifies. A string "true" is not evidence that a
   * channel hides anything; it is a fact Hebun does not understand, and an absence Hebun cannot
   * explain is `not-reported`.
   */
  const hidden = (observation.facts as Record<string, unknown>)[HIDDEN_SUBSCRIBER_COUNT] === true;
  const subscriberCountAbsence: YouTubeSubscriberCountAbsence | null =
    subscriberCount !== null ? null : hidden ? "hidden-by-channel" : "not-reported";

  return Object.freeze({
    observedAt: observation.observedAt,
    subscriberCount,
    subscriberCountAbsence,
    videoCount,
    viewCount,
  });
}

/**
 * Derive the channel measurement series from an authorized, capability-scoped read.
 *
 * ── ORDER IS CHOSEN, NOT INHERITED ──────────────────────────────────────────
 *
 * The read seam returns newest-first, because a surface showing "the latest" wants that. A SERIES
 * wants the opposite: oldest first, so it reads forwards in time like every chart and every
 * subtraction anyone will later write. Inheriting the seam's order would leave the first element
 * meaning "most recent" in one module and "earliest" in another, and the sign of a future delta
 * would depend on which one the author had read last.
 */
export function deriveYouTubeChannelMeasurementSeries(
  result: ProviderObservationReadResult,
): YouTubeChannelMeasurementSeries {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }

  const observationsConsidered = result.observations.length;
  if (observationsConsidered === 0) return Object.freeze({ status: "no-observations" as const });

  const points: YouTubeChannelMeasurementPoint[] = [];
  for (const observation of result.observations) {
    const point = usablePointOf(observation);
    if (point !== null) points.push(point);
  }

  if (points.length === 0) {
    return Object.freeze({ status: "no-usable-measurements" as const, observationsConsidered });
  }

  /* Oldest first. String comparison is correct for the ISO-8601 UTC instants the writer stores. */
  points.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));

  if (points.length === 1) {
    return Object.freeze({
      status: "single-measurement" as const,
      point: points[0]!,
      observationsConsidered,
    });
  }

  return Object.freeze({
    status: "series" as const,
    points: Object.freeze(points),
    observationsConsidered,
  });
}

/* ── The words a surface may use about this evidence ───────────────────────── */

/**
 * What each state means, in the words a human should read.
 *
 * None of these reports a change, a direction or a verdict, and none invents a zero. Note what is
 * absent: there is no sentence for a channel reporting zeros, because **a zero needs no excuse** —
 * `subscriberCount: 0` is rendered as `0`, and a surface that reached for an apology there would be
 * describing successful evidence as missing.
 */
export const YOUTUBE_CHANNEL_SERIES_SENTENCES: Readonly<
  Record<
    | "unauthenticated"
    | "persistence-unavailable"
    | "no-observations"
    | "no-usable-measurements"
    | "single-measurement",
    string
  >
> = Object.freeze({
  unauthenticated:
    "This session could not be resolved, so no stored channel measurements were read. Whether any " +
    "exist is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so how many channel measurements " +
    "exist is unknown. This is not a statement that there are none.",
  "no-observations":
    "Hebun has stored no YouTube channel observation for this organization yet. Nothing was asked " +
    "of YouTube and nothing failed.",
  "no-usable-measurements":
    "Hebun holds channel observations, but YouTube reported no subscriber, video or view count in " +
    "them. There is nothing to measure — which is a fact about what the provider said, not about " +
    "this channel.",
  "single-measurement":
    "Hebun holds one channel measurement. A single observation is a measurement, not a comparison " +
    "— a second observation is needed before any change can be shown, and Hebun will not invent one.",
});
