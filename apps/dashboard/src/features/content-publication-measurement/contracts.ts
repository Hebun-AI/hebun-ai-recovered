/*
 * content-publication-measurement/contracts.ts — CONTENT-PUBLICATION-MEASUREMENT-LINK-1.
 *
 * ── THE ONE SENTENCE THIS PROJECTION MAY PRODUCE ────────────────────────────
 *
 *   "The attempt that published this revision to Instagram account A was accepted, and Instagram
 *    returned id M. In the observations Hebun already holds for A, M appears (or does not), and
 *    these are the counts Instagram reported for M."
 *
 * ── A DERIVED PROJECTION, NOT AN AUTHORITY ──────────────────────────────────
 *
 * Two authorities own every fact here. Action Authorization's ledger owns "an attempt was accepted
 * and the provider returned M" (`action_execution_attempts.provider_message_id`). Provider
 * Observation History owns "Instagram reported M with these counts at T" (`provider_observations`).
 * This module owns neither and stores nothing: every value is recomputed from those two reads, so
 * there is no table, no cache and no second copy that could drift from them.
 *
 * ── IDENTITY IS THE PROVIDER'S ID, AND NOTHING ELSE ─────────────────────────
 *
 * A measurement is joined when `recentMedia[].mediaId === providerResultId`, inside observations of
 * the subject `instagram/account/<destinationAccountId>` the governed payload bound. Never by
 * caption, permalink, publication time or position. Production proved the identity on 2026-09-30:
 * attempt be0dc7d6 returned 18091512017663172 and the 21:00Z media observation listed it.
 *
 * ── WHAT IT MUST NEVER SAY ──────────────────────────────────────────────────
 *
 * No rate, no score, no ranking, no "performed well", no recommendation. A delta appears only when
 * IG-AN3's released derivation produced one. A count Instagram withheld stays `null`, never 0.
 */
import type { InstagramMediaEvolutionItem } from "@/features/instagram-connection-surface/media-measurement-evolution";

/**
 * What the stored evidence supports for one accepted Instagram publication.
 *
 *   observed                          at least one held observation lists the provider id.
 *   no-observation-since-publication  no held observation of that account is later than the
 *                                     attempt's completion. Nothing is claimed about Instagram.
 *   absent-from-complete-window       a later observation exists, reported NO more media beyond its
 *                                     window, and does not list the id. A fact, not an explanation.
 *   outside-clipped-window            a later observation exists but its window was clipped (or did
 *                                     not say whether it was), and it does not list the id.
 *   history-unreadable                Hebun could not read its own observation history just now.
 *
 * There is deliberately no "no-longer-in-window" and no "provider read failed": neither is
 * derivable from what is stored, and a failed provider read is not persisted anywhere.
 */
export const PUBLICATION_MEASUREMENT_STATUSES = [
  "observed",
  "no-observation-since-publication",
  "absent-from-complete-window",
  "outside-clipped-window",
  "history-unreadable",
] as const;
export type PublicationMeasurementStatus = (typeof PUBLICATION_MEASUREMENT_STATUSES)[number];

/** Which publication this measurement is about — copied from the ledger entry, never re-derived. */
export interface MeasuredPublication {
  readonly requestId: string;
  readonly attemptId: string;
  readonly providerResultId: string;
  readonly destinationAccountId: string;
  /** The attempt's completion instant; the line "since publication" is drawn at. */
  readonly publishedAt: string;
}

export type PublicationMeasurement =
  | {
      readonly status: "observed";
      readonly publication: MeasuredPublication;
      /** Earliest and latest held observations that list the id, within the read bound. */
      readonly earliestObservedAt: string;
      readonly latestObservedAt: string;
      /** INSTAGRAM REPORTED, as of `latestObservedAt`. `null` = Instagram did not report it. */
      readonly latestLikeCount: number | null;
      readonly latestCommentCount: number | null;
      /** Present only when IG-AN3 compared the two latest observations and both listed the id. */
      readonly evolution: {
        readonly previousObservedAt: string;
        readonly latestObservedAt: string;
        readonly item: InstagramMediaEvolutionItem;
      } | null;
    }
  | {
      readonly status: "no-observation-since-publication";
      readonly publication: MeasuredPublication;
      /** The newest held observation of the account, or `null` if none is held at all. */
      readonly latestObservedAt: string | null;
    }
  | {
      readonly status: "absent-from-complete-window" | "outside-clipped-window";
      readonly publication: MeasuredPublication;
      readonly latestObservedAt: string;
      readonly windowMediaCount: number | null;
    }
  | { readonly status: "history-unreadable"; readonly publication: MeasuredPublication };

/**
 * The projection for one revision.
 *
 *   unknown   the publication ledger itself could not be read — nothing is said about measurement.
 *   read      one measurement per accepted Instagram publication (possibly none), how many
 *             YouTube publications were accepted, and — YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1 —
 *             what Hebun's stored YouTube measurements say about each one that names a video and a
 *             channel.
 */
export type RevisionPublicationMeasurements =
  | { readonly status: "unknown" }
  | {
      readonly status: "read";
      readonly instagram: readonly PublicationMeasurement[];
      readonly youtubeAcceptedCount: number;
      readonly youtube: readonly YouTubePublicationMeasurement[];
    };

/*
 * ── YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1 ─────────────────────────────
 *
 *   "The attempt that published this revision to YouTube channel C was accepted, and YouTube
 *    returned video id V. In the measurements Hebun already holds for C, V is listed (or is not),
 *    and these are the counts YouTube reported for V at the time shown."
 *
 * The same two authorities, and still nothing stored. The observations are the ones a PERSON
 * recorded in Approvals (`google-youtube` / `google.youtube.video.metrics.read`); no schedule reads
 * YouTube, so nothing here may say or imply that a count is current. There is no freshness class,
 * no delta and no judgement — only what was reported, when, and how many times it was recorded.
 *
 * ── A BOUNDED PAGE IS NOT THE WHOLE HISTORY ─────────────────────────────────
 *
 * One read returns at most the observation history's own page. When that page came back full, a
 * video that is not in it may still have an older measurement, so "no stored measurement" would be
 * a claim the read cannot support: the answer is then "not listed in the latest N", and a count is
 * "at least N". Only a page that was NOT full supports a definite statement.
 */
export type YouTubePublicationMeasurement =
  | {
      readonly status: "measured";
      readonly publication: MeasuredPublication;
      /** YOUTUBE REPORTED, in the latest stored measurement. `null` = not reported; never 0. */
      readonly viewCount: number | null;
      readonly likeCount: number | null;
      readonly commentCount: number | null;
      /** YouTube's own publication instant, as that measurement carried it. */
      readonly providerPublishedAt: string | null;
      /** When the latest stored measurement was read from YouTube. */
      readonly latestObservedAt: string;
      /** The earliest stored measurement of this video INSIDE THE PAGE that was read. */
      readonly firstObservedAt: string;
      /** How many stored measurements of this video the page holds. */
      readonly storedCount: number;
      /** Whether the page came back full, so older measurements may exist beyond it. */
      readonly windowFull: boolean;
    }
  /** The page was not full and does not list the video: Hebun holds no measurement of it. */
  | { readonly status: "no-stored-measurement"; readonly publication: MeasuredPublication }
  /** The page was full and does not list the video. Nothing is claimed about older measurements. */
  | { readonly status: "not-in-latest-window"; readonly publication: MeasuredPublication; readonly windowSize: number }
  | { readonly status: "history-unreadable"; readonly publication: MeasuredPublication };

const youtubeInstant = (iso: string): string => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const youtubeCount = (value: number | null): string => (value === null ? "not reported" : String(value));

/**
 * The ONE sentence the surface prints for an accepted YouTube publication. Built here, beside the
 * vocabulary, so the wording is a tested contract rather than markup.
 */
export function describeYouTubePublicationMeasurement(m: YouTubePublicationMeasurement): string {
  const id = `YouTube id ${m.publication.providerResultId}`;
  switch (m.status) {
    case "measured": {
      const counts = `views ${youtubeCount(m.viewCount)} · likes ${youtubeCount(m.likeCount)} · comments ${youtubeCount(m.commentCount)} · as of ${youtubeInstant(m.latestObservedAt)}`;
      if (m.storedCount === 1) {
        return `${id} — ${counts} · ${m.windowFull ? "at least one stored measurement" : "one stored measurement"}.`;
      }
      return `${id} — ${counts} · first recorded ${youtubeInstant(m.firstObservedAt)} · ${m.windowFull ? "at least " : ""}${m.storedCount} stored measurements.`;
    }
    case "no-stored-measurement":
      return `${id} — no stored measurement. Hebun measures a YouTube video only when a person records one in Approvals.`;
    case "not-in-latest-window":
      return `${id} — not listed in the latest ${m.windowSize} stored measurements of this channel.`;
    case "history-unreadable":
      return `${id} — Hebun's observation history could not be read just now.`;
  }
}

export const YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM =
  "Counts are what YouTube reported to a read a person requested, at the time shown. Hebun does not measure YouTube on a schedule. Not a rate, a score or a judgement.";

export const PUBLICATION_MEASUREMENT_WORDING: Readonly<Record<PublicationMeasurementStatus, string>> =
  Object.freeze({
    observed: "listed in Hebun's stored Instagram observations",
    "no-observation-since-publication": "no stored observation of this account since it was published",
    "absent-from-complete-window": "not listed in a later observation that reported the account's full recent window",
    "outside-clipped-window": "not listed in a later observation whose window was clipped",
    "history-unreadable": "Hebun's observation history could not be read just now",
  });

export const PUBLICATION_MEASUREMENT_NON_CLAIM =
  "Counts are what Instagram reported to Hebun's scheduled read at the time shown. Not a rate, a score or a judgement of the post.";
