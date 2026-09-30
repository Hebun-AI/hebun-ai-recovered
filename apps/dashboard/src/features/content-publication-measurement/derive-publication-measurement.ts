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
 */
import type { ContentPublicationState, PublicationHistoryEntry } from "@/features/action-authorization/content-publication-state";
import { deriveInstagramMediaEvolution } from "@/features/instagram-connection-surface/media-measurement-evolution";
import {
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_SUBJECT_PREFIX,
} from "@/features/provider-instagram/contracts";
import type { StoredProviderObservation } from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";
import type {
  MeasuredPublication,
  PublicationMeasurement,
  RevisionPublicationMeasurements,
} from "./contracts";

/** The subject an Instagram publication's observations are filed under. */
export function instagramSubjectRefFor(destinationAccountId: string): string {
  return `${INSTAGRAM_SUBJECT_PREFIX}${destinationAccountId}`;
}

/** The accepted Instagram publications of a revision — the only entries this phase measures. */
export function measurablePublications(state: ContentPublicationState): MeasuredPublication[] {
  if (state.status !== "recorded") return [];
  const out: MeasuredPublication[] = [];
  for (const entry of state.entries) {
    const measured = measuredOf(entry);
    if (measured) out.push(measured);
  }
  return out;
}

function measuredOf(entry: PublicationHistoryEntry): MeasuredPublication | null {
  if (entry.destination !== "instagram") return null;
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
 * The projection for one revision. `readsByAccount` holds the observation read made for each
 * destination account the revision's accepted publications name; a missing entry is unreadable.
 */
export function derivePublicationMeasurements(
  state: ContentPublicationState,
  readsByAccount: ReadonlyMap<string, ProviderObservationReadResult>,
): RevisionPublicationMeasurements {
  if (state.status === "unknown") return Object.freeze({ status: "unknown" as const });
  const entries = state.status === "recorded" ? state.entries : [];
  return Object.freeze({
    status: "read" as const,
    instagram: Object.freeze(
      measurablePublications(state).map((p) => derivePublicationMeasurement(p, readsByAccount.get(p.destinationAccountId))),
    ),
    youtubeAcceptedCount: entries.filter((e) => e.destination === "youtube" && e.stage === "execution-accepted").length,
  });
}
