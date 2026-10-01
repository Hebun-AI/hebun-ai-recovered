/*
 * content-publication-measurement/derive-publication-measurement.ts — the pure join
 * (CONTENT-PUBLICATION-MEASUREMENT-LINK-1).
 *
 * No database, no provider, no tenant, no clock. It is handed the ledger's publication state for
 * one revision and the observation reads the server composition already made, keyed by the
 * destination account, and returns what those two authorities jointly say. Nothing is stored.
 *
 * THE JOIN, EXACTLY:
 *   entry.destination === "instagram"
 *   entry.stage === "execution-accepted"      (unknown, failed, refused, pending never join)
 *   entry.attempt.providerResultId present
 *   entry.destinationAccountId present
 *   observation.capabilityKey === instagram.media.public.read
 *   observation.subjectRef === "instagram/account/" + destinationAccountId
 *   recentMedia[].mediaId === providerResultId
 *
 * Every predicate is re-checked here even where the read already applied it, so the join cannot
 * widen if a caller hands it a broader read.
 *
 * THE YOUTUBE JOIN (YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1), EXACTLY:
 *   entry.destination === "youtube"
 *   entry.stage === "execution-accepted"
 *   entry.attempt.providerResultId present        (the video id YouTube returned)
 *   entry.destinationAccountId present            (the channel the governed payload bound)
 *   observation.providerKey === google-youtube
 *   observation.capabilityKey === google.youtube.video.metrics.read
 *   observation.subjectRef === the channel's subject reference, AS THE COMPOSITION HANDED IT IN
 *   videos[].videoId === providerResultId
 *
 * This file does not know how a channel subject reference is spelled. The format has one owner,
 * and the composition asks that owner and passes the answer in.
 */
import type { ContentPublicationState, PublicationHistoryEntry } from "@/features/action-authorization/content-publication-state";
import { deriveInstagramMediaEvolution } from "@/features/instagram-connection-surface/media-measurement-evolution";
import {
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_SUBJECT_PREFIX,
} from "@/features/provider-instagram/contracts";
import {
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
} from "@/features/provider-google/contracts";
import type { StoredProviderObservation } from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";
import type {
  MeasuredPublication,
  PublicationMeasurement,
  RevisionPublicationMeasurements,
  YouTubePublicationMeasurement,
} from "./contracts";

/** The subject an Instagram publication's observations are filed under. */
export function instagramSubjectRefFor(destinationAccountId: string): string {
  return `${INSTAGRAM_SUBJECT_PREFIX}${destinationAccountId}`;
}

/** The accepted Instagram publications of a revision — the only entries this phase measures. */
export function measurablePublications(state: ContentPublicationState): MeasuredPublication[] {
  return acceptedPublications(state, "instagram");
}

/** The accepted YouTube publications of a revision that name a video and a channel. */
export function measurableYouTubePublications(state: ContentPublicationState): MeasuredPublication[] {
  return acceptedPublications(state, "youtube");
}

function acceptedPublications(
  state: ContentPublicationState,
  destination: PublicationHistoryEntry["destination"],
): MeasuredPublication[] {
  if (state.status !== "recorded") return [];
  const out: MeasuredPublication[] = [];
  for (const entry of state.entries) {
    const measured = measuredOf(entry, destination);
    if (measured) out.push(measured);
  }
  return out;
}

function measuredOf(
  entry: PublicationHistoryEntry,
  destination: PublicationHistoryEntry["destination"],
): MeasuredPublication | null {
  if (entry.destination !== destination) return null;
  if (entry.stage !== "execution-accepted") return null;
  const attempt = entry.attempt;
  if (!attempt || !attempt.providerResultId) return null;
  if (!entry.destinationAccountId) return null;
  return Object.freeze({
    requestId: entry.requestId,
    attemptId: attempt.attemptId,
    providerResultId: attempt.providerResultId,
    destinationAccountId: entry.destinationAccountId,
    /* An accepted attempt records its completion; `startedAt` only if the ledger lacks it. */
    publishedAt: attempt.completedAt ?? attempt.startedAt,
  });
}

interface MediaEntry {
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

/** A count stays a number or `null`. Anything else is not a count Instagram reported. */
function countOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findMedia(observation: StoredProviderObservation, mediaId: string): MediaEntry | null {
  const recent = (observation.facts as Record<string, unknown> | null)?.recentMedia;
  if (!Array.isArray(recent)) return null;
  for (const raw of recent) {
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).mediaId === mediaId) {
      const item = raw as Record<string, unknown>;
      return { likeCount: countOf(item.likeCount), commentCount: countOf(item.commentCount) };
    }
  }
  return null;
}

function windowOf(observation: StoredProviderObservation): { more: boolean | null; count: number | null } {
  const facts = (observation.facts as Record<string, unknown> | null) ?? {};
  return {
    more: typeof facts.moreMediaExist === "boolean" ? facts.moreMediaExist : null,
    count: countOf(facts.recentMediaCount),
  };
}

/** One accepted publication against the observation read made for its account. */
export function derivePublicationMeasurement(
  publication: MeasuredPublication,
  read: ProviderObservationReadResult | undefined,
): PublicationMeasurement {
  if (!read || read.status !== "read") {
    return Object.freeze({ status: "history-unreadable" as const, publication });
  }
  const subjectRef = instagramSubjectRefFor(publication.destinationAccountId);
  const scoped = read.observations
    .filter((o) => o.capabilityKey === INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY && o.subjectRef === subjectRef)
    .slice()
    .sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));

  const listing = scoped
    .map((o) => ({ observation: o, media: findMedia(o, publication.providerResultId) }))
    .filter((x): x is { observation: StoredProviderObservation; media: MediaEntry } => x.media !== null);

  if (listing.length > 0) {
    const earliest = listing[0]!;
    const latest = listing[listing.length - 1]!;
    /* The delta comes ONLY from IG-AN3, over the same scoped observations. */
    const evolution = deriveInstagramMediaEvolution({ status: "read", observations: scoped });
    const item =
      evolution.status === "compared"
        ? evolution.items.find((i) => i.mediaId === publication.providerResultId) ?? null
        : null;
    return Object.freeze({
      status: "observed" as const,
      publication,
      earliestObservedAt: earliest.observation.observedAt,
      latestObservedAt: latest.observation.observedAt,
      latestLikeCount: latest.media.likeCount,
      latestCommentCount: latest.media.commentCount,
      evolution:
        evolution.status === "compared" && item
          ? Object.freeze({
              previousObservedAt: evolution.previousObservedAt,
              latestObservedAt: evolution.latestObservedAt,
              item,
            })
          : null,
    });
  }

  const newest = scoped[scoped.length - 1] ?? null;
  const since = scoped.filter((o) => o.observedAt > publication.publishedAt);
  const latestSince = since[since.length - 1];
  if (!latestSince) {
    return Object.freeze({
      status: "no-observation-since-publication" as const,
      publication,
      latestObservedAt: newest ? newest.observedAt : null,
    });
  }
  const window = windowOf(latestSince);
  return Object.freeze({
    /* Only an explicit `false` makes the window complete; unstated is treated as clipped. */
    status: window.more === false ? ("absent-from-complete-window" as const) : ("outside-clipped-window" as const),
    publication,
    latestObservedAt: latestSince.observedAt,
    windowMediaCount: window.count,
  });
}

/**
 * The read the composition made for ONE YouTube channel: the subject reference it asked the format's
 * owner for, the page the observation history returned, and that history's own page size.
 */
export interface YouTubeChannelMeasurementRead {
  readonly subjectRef: string;
  readonly read: ProviderObservationReadResult;
  readonly windowSize: number;
}

interface VideoEntry {
  readonly publishedAt: string | null;
  readonly viewCount: number | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

function findVideo(observation: StoredProviderObservation, videoId: string): VideoEntry | null {
  const videos = (observation.facts as Record<string, unknown> | null)?.videos;
  if (!Array.isArray(videos)) return null;
  for (const raw of videos) {
    if (raw && typeof raw === "object" && (raw as Record<string, unknown>).videoId === videoId) {
      const item = raw as Record<string, unknown>;
      return {
        publishedAt: typeof item.publishedAt === "string" ? item.publishedAt : null,
        viewCount: countOf(item.viewCount),
        likeCount: countOf(item.likeCount),
        commentCount: countOf(item.commentCount),
      };
    }
  }
  return null;
}

/** One accepted YouTube publication against the measurement page read for its channel. */
export function deriveYouTubePublicationMeasurement(
  publication: MeasuredPublication,
  channel: YouTubeChannelMeasurementRead | undefined,
): YouTubePublicationMeasurement {
  if (!channel || channel.read.status !== "read") {
    return Object.freeze({ status: "history-unreadable" as const, publication });
  }
  /* Whether the history's page came back full — decided on what was returned, before any filter. */
  const windowFull = channel.read.observations.length >= channel.windowSize;
  const listing = channel.read.observations
    .filter(
      (o) =>
        o.providerKey === GOOGLE_YOUTUBE_PROVIDER_KEY &&
        o.capabilityKey === GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY &&
        o.subjectRef === channel.subjectRef,
    )
    .slice()
    .sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0))
    .map((o) => ({ observation: o, video: findVideo(o, publication.providerResultId) }))
    .filter((x): x is { observation: StoredProviderObservation; video: VideoEntry } => x.video !== null);

  if (listing.length === 0) {
    return windowFull
      ? Object.freeze({ status: "not-in-latest-window" as const, publication, windowSize: channel.windowSize })
      : Object.freeze({ status: "no-stored-measurement" as const, publication });
  }
  const first = listing[0]!;
  const latest = listing[listing.length - 1]!;
  return Object.freeze({
    status: "measured" as const,
    publication,
    viewCount: latest.video.viewCount,
    likeCount: latest.video.likeCount,
    commentCount: latest.video.commentCount,
    providerPublishedAt: latest.video.publishedAt,
    latestObservedAt: latest.observation.observedAt,
    firstObservedAt: first.observation.observedAt,
    storedCount: listing.length,
    windowFull,
  });
}

/**
 * The projection for one revision. `readsByAccount` holds the observation read made for each
 * destination account the revision's accepted publications name; a missing entry is unreadable.
 * `youtubeReadsByChannel` is the same for YouTube, keyed by the channel the publication bound.
 */
export function derivePublicationMeasurements(
  state: ContentPublicationState,
  readsByAccount: ReadonlyMap<string, ProviderObservationReadResult>,
  youtubeReadsByChannel: ReadonlyMap<string, YouTubeChannelMeasurementRead> = new Map(),
): RevisionPublicationMeasurements {
  if (state.status === "unknown") return Object.freeze({ status: "unknown" as const });
  const entries = state.status === "recorded" ? state.entries : [];
  return Object.freeze({
    status: "read" as const,
    instagram: Object.freeze(
      measurablePublications(state).map((p) => derivePublicationMeasurement(p, readsByAccount.get(p.destinationAccountId))),
    ),
    youtubeAcceptedCount: entries.filter((e) => e.destination === "youtube" && e.stage === "execution-accepted").length,
    youtube: Object.freeze(
      measurableYouTubePublications(state).map((p) =>
        deriveYouTubePublicationMeasurement(p, youtubeReadsByChannel.get(p.destinationAccountId)),
      ),
    ),
  });
}
