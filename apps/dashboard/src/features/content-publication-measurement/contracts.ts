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
 *   read      one measurement per accepted Instagram publication (possibly none), plus how many
 *             YouTube publications exist, for which this phase measures nothing.
 */
export type RevisionPublicationMeasurements =
  | { readonly status: "unknown" }
  | {
      readonly status: "read";
      readonly instagram: readonly PublicationMeasurement[];
      readonly youtubeAcceptedCount: number;
    };

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

export const YOUTUBE_MEASUREMENT_NOT_AVAILABLE =
  "YouTube: no measurement in this phase — Hebun's YouTube observation is a public read and cannot see private uploads.";
