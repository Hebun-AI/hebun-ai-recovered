/*
 * social-intelligence/dashboard-model.ts — the Social Intelligence view model.
 *
 * ── WHAT THIS IS, EXACTLY ───────────────────────────────────────────────────
 *
 * A PRESENTATION composition over released read models, and nothing else. It is handed four results
 * the page already obtained through released authorities — one connection listing and three
 * capability-scoped observation reads — and arranges them into the sections a screen has. It holds
 * no database handle, no tenant, no provider client, no clock and no fetch, so it cannot become a
 * second opinion about anything: it has nothing to have an opinion with.
 *
 * ── THE ARITHMETIC IT IS ALLOWED TO DO ──────────────────────────────────────
 *
 * None. Every number on the finished surface is either a count a provider reported, or the `change`
 * the released YT-SOC2 comparison computed. This file adds nothing, averages nothing, ranks nothing
 * and scores nothing. There is deliberately no field on any type below in which a rate, a
 * percentage, an engagement score or a cross-platform total could be placed — the absence of the
 * field is the boundary, not a promise in a comment.
 *
 * In particular INSTAGRAM HAS NO `changes`. IG-AN2 is not released; this organization holds exactly
 * one Instagram account measurement, and a surface that reached for a second would be inventing the
 * evidence its own honesty rules exist to protect.
 *
 * ── WHY THE SECTIONS ARE NOT SYMMETRIC ──────────────────────────────────────
 *
 * Instagram has content and no comparison. YouTube has a comparison and no content — the channel
 * genuinely has zero videos, and no released YouTube content read model exists to render if it had
 * any. Forcing a matching panel onto each platform would mean drawing at least one panel with
 * nothing behind it. The shape follows the evidence.
 */
import type { ConnectionListing } from "@/features/integration-authority/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";
import { formatProviderObservationRef } from "@/features/provider-observation-history/observation-ref";
import {
  deriveInstagramAccountMeasurementSeries,
  INSTAGRAM_ACCOUNT_SERIES_SENTENCES,
  type InstagramAccountMeasurementSeries,
} from "@/features/instagram-connection-surface/account-measurement-series";
import {
  projectLatestInstagramObservation,
  INSTAGRAM_OBSERVATION_UNREPORTED,
  type InstagramLatestObservation,
} from "@/features/instagram-connection-surface/latest-observation";
import {
  compareInstagramAccountMeasurements,
  INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES,
  type InstagramAccountComparison,
} from "@/features/instagram-connection-surface/account-measurement-comparison";
import {
  projectLatestInstagramMediaObservation,
  type InstagramLatestMediaObservation,
} from "@/features/instagram-connection-surface/latest-media-observation";
import {
  deriveYouTubeChannelMeasurementSeries,
  YOUTUBE_CHANNEL_SERIES_SENTENCES,
  type YouTubeChannelMeasurementPoint,
  type YouTubeChannelMeasurementSeries,
} from "@/features/youtube-channel-surface/channel-measurement-series";
import {
  compareYouTubeChannelMeasurements,
  YOUTUBE_CHANNEL_COMPARISON_SENTENCES,
  type YouTubeChannelComparison,
} from "@/features/youtube-channel-surface/channel-measurement-comparison";
import {
  INSTAGRAM_PLATFORM,
  METRIC_UNREPORTED_DISPLAY,
  SOCIAL_PLATFORMS,
  YOUTUBE_PLATFORM,
  type SocialPlatformDefinition,
  type SocialPlatformKey,
} from "./contracts";
import {
  hasStanding,
  resolveSocialPlatformPresence,
  type SocialPlatformPresence,
} from "./platform-presence";

/* ── Provenance, in the vocabulary the released chip already speaks ────────── */

/**
 * The two kinds of evidence this surface carries, and the only two it may.
 *
 * `authoritative` — read from the canonical authority: a count a provider reported, at an instant
 *   Hebun recorded.
 * `derived` — recomputed on each read and stored nowhere: the YT-SOC2 `change`.
 *
 * The released `ProvenanceChip` also speaks `seeded`, `not-connected` and `restricted`. None appears
 * here, and there is no fourth kind for "inferred" or "recommended" because SOC-UI1 produces
 * neither. A phase that later does must add its own kind and defend it.
 */
export type SocialProvenance = "authoritative" | "derived";

/* ── One metric cell ───────────────────────────────────────────────────────── */

export interface SocialMetricCell {
  /** Attributed identity: "Subscribers YouTube reported". The accessible name. */
  readonly label: string;
  /** Scannable identity inside the card: "Subscribers". */
  readonly shortLabel: string;
  /** The provider's count, or `null` when it was not reported. **Never a substituted zero.** */
  readonly value: number | null;
  /** What a reader sees. `"0"` for a real zero; an em dash for an absence. */
  readonly display: string;
  readonly reported: boolean;
  /** Why the count is missing, in a full sentence. `null` when it was reported. */
  readonly absence: string | null;
}

/**
 * WHY A YOUTUBE SUBSCRIBER COUNT IS MISSING, kept as two different sentences.
 *
 * YT-SOC1 distinguishes a count the channel's owner HIDES from one YouTube did not give, and that
 * distinction is exactly the sort of thing a presentation layer flattens by accident. Only one of
 * these suggests anything about the channel; the other says nothing at all.
 */
const YOUTUBE_SUBSCRIBER_ABSENCE: Readonly<Record<"hidden-by-channel" | "not-reported", string>> =
  Object.freeze({
    "hidden-by-channel": "This channel hides its subscriber count, so YouTube did not report one.",
    "not-reported": "YouTube did not report a subscriber count.",
  });

const YOUTUBE_UNREPORTED = "YouTube did not report this." as const;

function cell(
  definition: SocialPlatformDefinition["metrics"][number],
  value: number | null,
  absence: string,
): SocialMetricCell {
  return Object.freeze({
    label: definition.label,
    shortLabel: definition.shortLabel,
    value,
    /* A ZERO IS A MEASUREMENT. `String(0)` is `"0"`, and nothing below may reach for the dash. */
    display: value === null ? METRIC_UNREPORTED_DISPLAY : String(value),
    reported: value !== null,
    absence: value === null ? absence : null,
  });
}

/* ── One platform card ─────────────────────────────────────────────────────── */

/**
 * `evidence` answers a question separate from `presence`.
 *
 * A platform can be connected and never observed; it can also have been observed and later
 * disconnected. **A stored observation stays true after a grant ends** — the provider did say it, at
 * that instant — so the two are reported side by side rather than one gating the other.
 */
export type SocialCardEvidence = "observed" | "no-observation" | "unknown";

export interface SocialPlatformCard {
  readonly key: SocialPlatformKey;
  readonly label: string;
  readonly subjectNoun: string;
  readonly presence: SocialPlatformPresence;
  readonly provenance: SocialProvenance;
  readonly metrics: readonly SocialMetricCell[];
  /** HEBUN OBSERVED — the instant the counts above were recorded. Never a publication time. */
  readonly observedAt: string | null;
  readonly evidence: SocialCardEvidence;
  /** Present only when there is an absence to explain. A real observation needs no excuse. */
  readonly evidenceSentence: string | null;
}

/* ── The measurement series, prepared for a chart ──────────────────────────── */

/**
 * One plotted instant.
 *
 * `values` is keyed by the platform's own `shortLabel`, so a point can never be read as belonging to
 * a metric another platform owns. `null` remains `null` all the way to the axis — a chart that
 * plotted an unreported count at the baseline would be drawing a zero the provider never gave.
 */
export interface SocialSeriesPoint {
  readonly observedAt: string;
  readonly values: Readonly<Record<string, number | null>>;
}

/* ── The calculated change ─────────────────────────────────────────────────── */

export interface SocialChangeCell {
  readonly shortLabel: string;
  readonly label: string;
  readonly status: "comparable" | "not-comparable";
  readonly previous: number | null;
  readonly latest: number | null;
  /** HEBUN CALCULATED: `latest - previous`. `null` only when the pair was not comparable. */
  readonly change: number | null;
  /** What a reader sees. `"0"` is a result. `"+3"` and `"-2"` carry their sign. */
  readonly display: string;
  /** Why the pair could not be compared. `null` when it was. Never a verdict about the numbers. */
  readonly note: string | null;
}

export interface SocialChangeBlock {
  readonly status: "compared";
  readonly previousObservedAt: string;
  readonly latestObservedAt: string;
  readonly cells: readonly SocialChangeCell[];
}

/* ── The two platform sections ─────────────────────────────────────────────── */

export interface InstagramSection {
  readonly evolution: InstagramAccountMeasurementSeries;
  readonly points: readonly SocialSeriesPoint[];
  /**
   * How many measurements a panel may CLAIM to hold. `null` when the read failed — see
   * `measurementCountLabelOf`, which exists because "0 measurements" is an assertion.
   */
  readonly measurementCountLabel: string | null;
  /** The released sentence for a state that is not a plottable series. `null` when it is one. */
  readonly evolutionSentence: string | null;
  readonly seriesProvenance: SocialProvenance;
  /**
   * The IG-AN2 comparison, once there are two usable measurements to compare.
   *
   * SOC-UI1 pinned this to `null` and said a future phase must change a released type — and trip
   * this file's tests — rather than quietly fill a gap. IG-AN2 is that phase, and it did both. The
   * surface still computes nothing itself: this is the released derivation's answer, carried.
   */
  readonly changes: SocialChangeBlock | null;
  readonly comparison: InstagramAccountComparison;
  /** The released sentence for a state that is not a comparison. `null` when it is one. */
  readonly changesSentence: string | null;
  readonly content: InstagramLatestMediaObservation;
  readonly account: InstagramLatestObservation;
  /**
   * SOC-ACT1. The canonical reference of the NEWEST stored account observation, or `null` when
   * there is none to name.
   *
   * ── IT IS A HANDLE, NOT A MEASUREMENT ──────────────────────────────────────
   *
   * It carries no count, no instant and no subject — only the identity of a row this organization
   * owns, so a human can say "file work about THIS observation" and the server can re-read exactly
   * that row. Everything the approval eventually shows is read again server-side; nothing about the
   * observation travels with this value.
   *
   * `null` when the read failed or no observation exists. A surface with no reference offers no
   * affordance, which is the honest outcome: there is nothing to cite.
   */
  readonly latestObservationRef: string | null;
}

export interface YouTubeSection {
  readonly evolution: YouTubeChannelMeasurementSeries;
  readonly points: readonly SocialSeriesPoint[];
  readonly measurementCountLabel: string | null;
  readonly evolutionSentence: string | null;
  readonly seriesProvenance: SocialProvenance;
  readonly comparison: YouTubeChannelComparison;
  readonly changes: SocialChangeBlock | null;
  /** The sentence explaining why there is no comparison. `null` when there is one. */
  readonly changesSentence: string | null;
  readonly changeProvenance: SocialProvenance;
}

/* ── How much evidence stands behind this page ─────────────────────────────── */

/**
 * Not a vanity panel. It answers the one operational question a reader of this surface actually has
 * before trusting any number on it: **is Hebun still watching, and how much has it seen?** Every
 * figure is counted from the reads this page already performed — nothing is estimated, projected or
 * carried over from a previous render.
 */
export interface SocialCoverageRow {
  readonly label: string;
  readonly observations: number;
  readonly firstObservedAt: string | null;
  readonly latestObservedAt: string | null;
  /** `false` when the read itself failed — a coverage of zero would then be a lie. */
  readonly known: boolean;
}

export interface SocialDashboardModel {
  /** `false` when the connection authority could not be read. Never collapsed into "none". */
  readonly presenceKnown: boolean;
  readonly platforms: readonly SocialPlatformCard[];
  readonly instagram: InstagramSection;
  readonly youtube: YouTubeSection;
  readonly coverage: readonly SocialCoverageRow[];
  /**
   * Every sentence this model puts NEAR a calculated number, collected so a test can read what a
   * human reads. It is the model's own answer to "does the surface interpret its arithmetic?", and
   * it must stay answerable without scraping JSX.
   */
  readonly changesProse: readonly string[];
}

/**
 * The canonical reference of the newest observation in a read, or `null`.
 *
 * Pure. The read seam returns newest-first, so element zero is the newest — the same ordering every
 * released projection here relies on. A failed read yields `null` rather than an empty string: a
 * surface must be able to tell "nothing to cite" from "a citation that is blank".
 */
function latestObservationRefOf(result: ProviderObservationReadResult): string | null {
  if (result.status !== "read") return null;
  const newest = result.observations[0];
  if (!newest) return null;
  /*
   * ── WHY THE FORMATTER'S THROW IS CAUGHT HERE AND NOWHERE ELSE ─────────────
   *
   * `formatProviderObservationRef` throws on a non-uuid, and that is right where it matters: a
   * malformed reference on the ACTION path would be hashed into something a human approves, so it
   * has to fail loudly there. This is the READING path, and the same throw would take down a page
   * whose only job is to show what was observed.
   *
   * So a stored id this module cannot name degrades to "nothing to cite" — the surface simply
   * offers no affordance — while the action path keeps its loud failure. The states stay honest in
   * both directions: a citation is never invented, and a dashboard never dies over one.
   */
  try {
    return formatProviderObservationRef(newest.observationId);
  } catch {
    return null;
  }
}

export interface SocialDashboardInput {
  readonly connections: ConnectionListing;
  readonly instagramAccount: ProviderObservationReadResult;
  readonly instagramMedia: ProviderObservationReadResult;
  readonly youtubeChannel: ProviderObservationReadResult;
}


/**
 * How many measurements this panel holds — or `null` when that number is not known.
 *
 * ── "0 MEASUREMENTS" IS AN ASSERTION, NOT A FALLBACK ────────────────────────
 *
 * Real-browser acceptance caught the panel printing "0 measurements" directly above its own
 * sentence "Whether any exist is unknown." The count had been derived from `points.length`, which is
 * zero both when Hebun genuinely stored nothing AND when Hebun could not read its own history — and
 * those are the two states this entire phase exists to keep apart. A failed read reports NO count,
 * because the honest answer to "how many?" is that nobody knows.
 *
 * `no-observations` and `no-usable-measurements` DO get a zero: there, Hebun read successfully and
 * the answer really is none.
 */
function measurementCountLabelOf(status: string, count: number): string | null {
  if (status === "unavailable") return null;
  return count === 1 ? "1 measurement" : `${count} measurements`;
}

/* ── Instagram card ────────────────────────────────────────────────────────── */

function instagramMetrics(latest: InstagramLatestObservation): readonly SocialMetricCell[] {
  const view = latest.status === "observed" ? latest.observation : null;
  const by = (key: string): number | null => {
    if (!view) return null;
    if (key === "followersCount") return view.followersCount;
    if (key === "followsCount") return view.followsCount;
    return view.mediaCount;
  };
  return Object.freeze(
    INSTAGRAM_PLATFORM.metrics.map((definition) =>
      cell(definition, by(definition.factKey), INSTAGRAM_OBSERVATION_UNREPORTED),
    ),
  );
}

/* ── YouTube card ──────────────────────────────────────────────────────────── */

/** The card shows the MOST RECENT measurement; the series below it shows all of them. */
function latestYouTubePoint(
  series: YouTubeChannelMeasurementSeries,
): YouTubeChannelMeasurementPoint | null {
  if (series.status === "series") return series.points[series.points.length - 1] ?? null;
  if (series.status === "single-measurement") return series.point;
  return null;
}

function youtubeMetrics(series: YouTubeChannelMeasurementSeries): readonly SocialMetricCell[] {
  const point = latestYouTubePoint(series);
  return Object.freeze(
    YOUTUBE_PLATFORM.metrics.map((definition) => {
      if (definition.factKey === "subscriberCount") {
        /*
         * THE REASON TRAVELS WITH THE ABSENCE. YT-SOC1 already knows whether the owner hid the count
         * or the provider stayed silent; discarding that here would leave the surface with one
         * shrug for two different facts.
         */
        const absence = point?.subscriberCountAbsence ?? "not-reported";
        return cell(definition, point?.subscriberCount ?? null, YOUTUBE_SUBSCRIBER_ABSENCE[absence]);
      }
      const value =
        definition.factKey === "videoCount" ? (point?.videoCount ?? null) : (point?.viewCount ?? null);
      return cell(definition, value, YOUTUBE_UNREPORTED);
    }),
  );
}

/* ── Series → plottable points ─────────────────────────────────────────────── */

function instagramPoints(series: InstagramAccountMeasurementSeries): readonly SocialSeriesPoint[] {
  const points =
    series.status === "series" ? series.points : series.status === "single-measurement" ? [series.point] : [];
  return Object.freeze(
    points.map((point) =>
      Object.freeze({
        observedAt: point.observedAt,
        values: Object.freeze({
          Followers: point.followersCount,
          Following: point.followsCount,
          Posts: point.mediaCount,
        }),
      }),
    ),
  );
}

function youtubePoints(series: YouTubeChannelMeasurementSeries): readonly SocialSeriesPoint[] {
  const points =
    series.status === "series" ? series.points : series.status === "single-measurement" ? [series.point] : [];
  return Object.freeze(
    points.map((point) =>
      Object.freeze({
        observedAt: point.observedAt,
        values: Object.freeze({
          Subscribers: point.subscriberCount,
          Videos: point.videoCount,
          Views: point.viewCount,
        }),
      }),
    ),
  );
}

/**
 * The sentence for a series state that cannot be plotted as a trajectory.
 *
 * `series` returns `null` — a real series speaks for itself, and prefacing it with an explanation
 * would be the surface apologising for evidence it has.
 */
function seriesSentence(
  status: string,
  reason: string | undefined,
  sentences: Readonly<Record<string, string>>,
): string | null {
  if (status === "series") return null;
  if (status === "unavailable") return sentences[reason ?? "persistence-unavailable"] ?? null;
  return sentences[status] ?? null;
}

/* ── Comparison → change cells ─────────────────────────────────────────────── */

/**
 * Why a metric could not be compared, said plainly.
 *
 * WHICH SIDE is missing is the fact a reader needs — YT-SOC2 keeps the distinction and this keeps
 * it too. None of these describes the numbers; they describe the evidence.
 */
const GAP_NOTES: Readonly<Record<string, string>> = Object.freeze({
  "previous-not-reported": "The earlier observation did not carry this count, so no change can be shown.",
  "latest-not-reported": "The later observation did not carry this count, so no change can be shown.",
  "neither-reported": "Neither observation carried this count, so no change can be shown.",
});

/**
 * How a change is written.
 *
 * A SIGN IS NOT A JUDGEMENT. `+3` and `-2` state a direction because the direction is part of the
 * arithmetic; neither carries a word about whether it is welcome. **Zero keeps no sign** — `"0"` is
 * the result of `0 - 0`, and writing it as `+0` would dress a null result as a movement.
 */
function changeDisplay(change: number): string {
  if (change === 0) return "0";
  return change > 0 ? `+${change}` : String(change);
}

function changeBlockOf(comparison: YouTubeChannelComparison): SocialChangeBlock | null {
  if (comparison.status !== "compared") return null;

  const metricByKey = {
    subscriberCount: comparison.subscriberCount,
    videoCount: comparison.videoCount,
    viewCount: comparison.viewCount,
  } as const;

  const cells = YOUTUBE_PLATFORM.metrics.map((definition) => {
    const metric = metricByKey[definition.factKey as keyof typeof metricByKey];
    if (metric.status === "comparable") {
      return Object.freeze({
        shortLabel: definition.shortLabel,
        label: definition.label,
        status: "comparable" as const,
        previous: metric.previous,
        latest: metric.latest,
        change: metric.change,
        display: changeDisplay(metric.change),
        note: null,
      });
    }
    return Object.freeze({
      shortLabel: definition.shortLabel,
      label: definition.label,
      status: "not-comparable" as const,
      previous: metric.previous,
      latest: metric.latest,
      change: null,
      display: METRIC_UNREPORTED_DISPLAY,
      note: GAP_NOTES[metric.gap] ?? null,
    });
  });

  return Object.freeze({
    status: "compared" as const,
    previousObservedAt: comparison.previousObservedAt,
    latestObservedAt: comparison.latestObservedAt,
    cells: Object.freeze(cells),
  });
}

/**
 * The Instagram comparison, mapped to the same PRESENTATION shape the YouTube one uses.
 *
 * The shape is shared; the semantics are not. This reads `followersCount`, `followsCount` and
 * `mediaCount` — Instagram's own three — and labels them from `INSTAGRAM_PLATFORM.metrics`, so a
 * follower change can never be rendered under a subscriber's name. The two mappers are kept apart
 * for the same reason the two derivations are: they consume different types that only look alike.
 */
function instagramChangeBlockOf(comparison: InstagramAccountComparison): SocialChangeBlock | null {
  if (comparison.status !== "compared") return null;

  const metricByKey = {
    followersCount: comparison.followersCount,
    followsCount: comparison.followsCount,
    mediaCount: comparison.mediaCount,
  } as const;

  const cells = INSTAGRAM_PLATFORM.metrics.map((definition) => {
    const metric = metricByKey[definition.factKey as keyof typeof metricByKey];
    if (metric.status === "comparable") {
      return Object.freeze({
        shortLabel: definition.shortLabel,
        label: definition.label,
        status: "comparable" as const,
        previous: metric.previous,
        latest: metric.latest,
        change: metric.change,
        display: changeDisplay(metric.change),
        note: null,
      });
    }
    return Object.freeze({
      shortLabel: definition.shortLabel,
      label: definition.label,
      status: "not-comparable" as const,
      previous: metric.previous,
      latest: metric.latest,
      change: null,
      display: METRIC_UNREPORTED_DISPLAY,
      note: GAP_NOTES[metric.gap] ?? null,
    });
  });

  return Object.freeze({
    status: "compared" as const,
    previousObservedAt: comparison.previousObservedAt,
    latestObservedAt: comparison.latestObservedAt,
    cells: Object.freeze(cells),
  });
}

/** The released Instagram sentence for a state that is not a comparison. */
function instagramComparisonSentence(comparison: InstagramAccountComparison): string | null {
  if (comparison.status === "compared") return null;
  if (comparison.status === "unavailable") {
    return INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES[comparison.reason];
  }
  return INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES[comparison.status] ?? null;
}

function comparisonSentence(comparison: YouTubeChannelComparison): string | null {
  if (comparison.status === "compared") return null;
  if (comparison.status === "unavailable") return YOUTUBE_CHANNEL_COMPARISON_SENTENCES[comparison.reason];
  return YOUTUBE_CHANNEL_COMPARISON_SENTENCES[comparison.status] ?? null;
}

/* ── Coverage ──────────────────────────────────────────────────────────────── */

function coverageOf(label: string, result: ProviderObservationReadResult): SocialCoverageRow {
  if (result.status === "unavailable") {
    return Object.freeze({ label, observations: 0, firstObservedAt: null, latestObservedAt: null, known: false });
  }
  const instants = result.observations
    .map((observation) => observation.observedAt)
    .filter((instant): instant is string => typeof instant === "string" && instant.length > 0)
    .sort();
  return Object.freeze({
    label,
    observations: result.observations.length,
    firstObservedAt: instants[0] ?? null,
    latestObservedAt: instants[instants.length - 1] ?? null,
    known: true,
  });
}

/* ── The composition ───────────────────────────────────────────────────────── */

function evidenceOf(
  result: ProviderObservationReadResult,
  observedAt: string | null,
): { evidence: SocialCardEvidence; sentence: string | null } {
  if (result.status === "unavailable") {
    return {
      evidence: "unknown",
      sentence:
        result.reason === "unauthenticated"
          ? "This session could not be resolved, so no stored observation was read. Whether one exists is unknown."
          : "Hebun could not read its own observation history just now, so whether an observation exists is unknown. This is not a statement that there is none.",
    };
  }
  if (observedAt === null) {
    return {
      evidence: "no-observation",
      sentence:
        "Hebun has stored no observation of this platform for this organization yet. Nothing was asked of the provider and nothing failed.",
    };
  }
  return { evidence: "observed", sentence: null };
}

export function composeSocialDashboard(input: SocialDashboardInput): SocialDashboardModel {
  const presenceKnown = input.connections.status === "read";

  /* Released derivations, called exactly once each. This file re-derives nothing they own. */
  const instagramAccount = projectLatestInstagramObservation(input.instagramAccount);
  const instagramSeries = deriveInstagramAccountMeasurementSeries(input.instagramAccount);
  const instagramContent = projectLatestInstagramMediaObservation(input.instagramMedia);
  const youtubeSeries = deriveYouTubeChannelMeasurementSeries(input.youtubeChannel);
  const youtubeComparison = compareYouTubeChannelMeasurements(youtubeSeries);

  const metricsFor = (key: SocialPlatformKey): readonly SocialMetricCell[] =>
    key === "instagram" ? instagramMetrics(instagramAccount) : youtubeMetrics(youtubeSeries);

  const observedAtFor = (key: SocialPlatformKey): string | null =>
    key === "instagram"
      ? instagramAccount.status === "observed"
        ? instagramAccount.observation.observedAt
        : null
      : (latestYouTubePoint(youtubeSeries)?.observedAt ?? null);

  const readFor = (key: SocialPlatformKey): ProviderObservationReadResult =>
    key === "instagram" ? input.instagramAccount : input.youtubeChannel;

  const platforms: SocialPlatformCard[] = [];
  for (const definition of SOCIAL_PLATFORMS) {
    const presence = resolveSocialPlatformPresence(input.connections, definition.providerKey);
    /*
     * A CARD IS A CLAIM ABOUT THIS ORGANIZATION'S REACH, so only a platform with a real grant gets
     * one. A platform definition, a catalog entry and a stored credential are each insufficient —
     * none of them is consulted here, and the connection authority is the only thing that is.
     */
    if (!hasStanding(presence)) continue;

    const observedAt = observedAtFor(definition.key);
    const { evidence, sentence } = evidenceOf(readFor(definition.key), observedAt);
    platforms.push(
      Object.freeze({
        key: definition.key,
        label: definition.label,
        subjectNoun: definition.subjectNoun,
        presence,
        provenance: "authoritative" as const,
        metrics: metricsFor(definition.key),
        observedAt,
        evidence,
        evidenceSentence: sentence,
      }),
    );
  }

  const youtubeChanges = changeBlockOf(youtubeComparison);
  const youtubeChangesSentence = comparisonSentence(youtubeComparison);

  const instagramSeriesPoints = instagramPoints(instagramSeries);
  const instagramComparison = compareInstagramAccountMeasurements(instagramSeries);
  const instagramChanges = instagramChangeBlockOf(instagramComparison);

  const instagram: InstagramSection = Object.freeze({
    evolution: instagramSeries,
    points: instagramSeriesPoints,
    measurementCountLabel: measurementCountLabelOf(instagramSeries.status, instagramSeriesPoints.length),
    evolutionSentence: seriesSentence(
      instagramSeries.status,
      instagramSeries.status === "unavailable" ? instagramSeries.reason : undefined,
      INSTAGRAM_ACCOUNT_SERIES_SENTENCES,
    ),
    seriesProvenance: "authoritative" as const,
    changes: instagramChanges,
    comparison: instagramComparison,
    changesSentence: instagramComparisonSentence(instagramComparison),
    content: instagramContent,
    account: instagramAccount,
    latestObservationRef: latestObservationRefOf(input.instagramAccount),
  });

  const youtubeSeriesPoints = youtubePoints(youtubeSeries);
  const youtube: YouTubeSection = Object.freeze({
    evolution: youtubeSeries,
    points: youtubeSeriesPoints,
    measurementCountLabel: measurementCountLabelOf(youtubeSeries.status, youtubeSeriesPoints.length),
    evolutionSentence: seriesSentence(
      youtubeSeries.status,
      youtubeSeries.status === "unavailable" ? youtubeSeries.reason : undefined,
      YOUTUBE_CHANNEL_SERIES_SENTENCES,
    ),
    seriesProvenance: "authoritative" as const,
    comparison: youtubeComparison,
    changes: youtubeChanges,
    changesSentence: youtubeChangesSentence,
    changeProvenance: "derived" as const,
  });

  /*
   * EVERY SENTENCE THAT SITS BESIDE A NUMBER. Collected here so the model can be asked, in a test,
   * what a reader is told about the arithmetic — rather than a test scraping JSX for words and
   * calling the absence of a match a guarantee.
   */
  const changesProse = Object.freeze(
    [
      instagram.evolutionSentence,
      instagram.changesSentence,
      ...(instagramChanges?.cells.map((c) => c.note) ?? []),
      youtube.evolutionSentence,
      youtube.changesSentence,
      ...(youtubeChanges?.cells.map((c) => c.note) ?? []),
      ...platforms.map((p) => p.evidenceSentence),
    ].filter((sentence): sentence is string => typeof sentence === "string"),
  );

  return Object.freeze({
    presenceKnown,
    platforms: Object.freeze(platforms),
    instagram,
    youtube,
    coverage: Object.freeze([
      coverageOf("Instagram account", input.instagramAccount),
      coverageOf("Instagram media", input.instagramMedia),
      coverageOf("YouTube channel", input.youtubeChannel),
    ]),
    changesProse,
  });
}
