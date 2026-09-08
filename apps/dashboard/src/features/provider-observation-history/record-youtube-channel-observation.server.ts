/*
 * provider-observation-history/record-youtube-channel-observation.server.ts — the composition
 * (TRH-21).
 *
 * ── TWO RELEASED SEAMS, COMPOSED, WITH NOTHING NEW UNDERNEATH EITHER ─────────
 *
 *   readPublicChannelObservation   CGO-5. Capability authority first, three list calls, one page,
 *                                  no persistence of its own. Unchanged by this phase except that
 *                                  it now NAMES the connection it spent.
 *   recordProviderObservation      TRH-21. One INSERT, append-only, idempotent on the instant.
 *
 * ── WHY THIS FILE EXISTS HERE AND NOWHERE ELSE ───────────────────────────────
 *
 * A released firewall walks every file under `src/features/provider-youtube` and the Heby
 * observation command root and asserts each "touches no table" — no `.insert(`, no `.update(`, no
 * `.delete(`, no `@/db/schema`. Putting persistence in either place would breach a guarantee two
 * shipped releases installed, and the command's own prose would stop being true: it tells the
 * reader "nothing was stored", and through that path nothing is.
 *
 * So the read stays where it was, the write stays where it was, and this is the composition point
 * between them — the same shape CGO-7 and TRH-20 used for exactly the same reason.
 *
 * ── WHAT DOES NOT HAPPEN HERE ────────────────────────────────────────────────
 *
 * No parallel YouTube reader. No second credential path. No second capability check. No provider
 * authority of any kind moves into persistence: this module cannot decide whether a read is allowed
 * and never asks — it is handed the outcome of a read that already was.
 *
 * No schedule, no retry, no loop, no second call. One human-triggered read, one row, and stop.
 * **THIS CREATES MEMORY OF AN AUTHORIZED OBSERVATION. IT CREATES NO AUTHORITY TO MAKE ANOTHER.**
 *
 * ── A FAILED WRITE DOES NOT UNMAKE THE OBSERVATION ───────────────────────────
 *
 * The read happened and what it saw is true whether or not Hebun remembered it. So both halves are
 * returned separately: the observation on its own terms, and what became of the record. A caller
 * that conflated them would report a provider outage every time a database was briefly unreachable.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeChannelObservation,
} from "@/features/provider-youtube/contracts";
import {
  readPublicChannelObservation,
  type ReadChannelObservationDeps,
  type ReadChannelObservationOutcome,
} from "@/features/provider-youtube/read-channel-observation.server";
import type { ObservationFacts, ProviderObservationWriteResult } from "./contracts";
import {
  recordProviderObservation,
  type ProviderObservationWriteDeps,
} from "./write-provider-observation.server";

/** How a YouTube channel is addressed in the history. Provider id, never a human-typed handle. */
export const YOUTUBE_CHANNEL_SUBJECT_KIND = "youtube-channel" as const;

/**
 * The inverse of `youtubeChannelSubjectRef` (TRH-24).
 *
 * The format is owned here, so its reading is owned here too. A machine observation is authorized
 * against a canonical subject reference and must read the channel by the provider's own id; parsing
 * that reference anywhere else would be a second reading of a format this module defines.
 *
 * Returns `null` for anything that is not exactly this provider's channel reference — a Drive file
 * or a GitHub repository reference is not a YouTube channel, and guessing would be how a future
 * subject kind silently became readable by this path.
 */
export function channelIdFromSubjectRef(subjectRef: string): string | null {
  const prefix = "youtube/channel/";
  if (typeof subjectRef !== "string" || !subjectRef.startsWith(prefix)) return null;
  const channelId = subjectRef.slice(prefix.length);
  return /^[A-Za-z0-9_-]{1,64}$/.test(channelId) ? channelId : null;
}

export function youtubeChannelSubjectRef(channelId: string): string {
  return `youtube/channel/${channelId}`;
}

/**
 * The typed projection stored for a YouTube channel observation.
 *
 * ── WHY A MAPPER AND NOT THE RESPONSE ────────────────────────────────────────
 *
 * The provider's response is never stored. This builds a NEW object with a CLOSED key set, so a
 * field YouTube starts returning tomorrow cannot arrive in the database by accident — there is no
 * spread, no passthrough and no `...rest` anywhere in this file.
 *
 * ── ZERO AND NULL ARE DIFFERENT, ALL THE WAY DOWN ────────────────────────────
 *
 * Every count is written exactly as the released view carries it. `0` is a number YouTube reported.
 * `null` means it withheld or did not report one. Nothing here coalesces, defaults, or substitutes
 * one for the other, because "absent is not zero" has to survive storage to be worth saying.
 *
 * `recentVideoCount` is the number of videos this ONE PAGE carried — not the channel's video count,
 * which is `videoCount` and comes from the channel's own statistics. Conflating them would let a
 * bounded page look like a total.
 */
export function youtubeChannelObservationFacts(observation: YouTubeChannelObservation): ObservationFacts {
  const channel = observation.channel;
  return Object.freeze({
    channelId: channel.channelId,
    title: channel.title,
    handle: channel.handle,
    publishedAt: channel.publishedAt,
    viewCount: channel.viewCount,
    subscriberCount: channel.subscriberCount,
    hiddenSubscriberCount: channel.hiddenSubscriberCount,
    videoCount: channel.videoCount,
    recentVideoCount: observation.recentVideos.length,
    moreVideosExist: observation.moreVideosExist,
    quotaUnitsSpent: observation.quotaUnitsSpent,
    recentVideos: observation.recentVideos.map((video) =>
      Object.freeze({
        videoId: video.videoId,
        title: video.title,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
      }),
    ),
  }) as ObservationFacts;
}

/** Every key the mapper may produce. Asserted by test, so the closed set cannot quietly widen. */
export const YOUTUBE_CHANNEL_FACT_KEYS: readonly string[] = Object.freeze([
  "channelId",
  "title",
  "handle",
  "publishedAt",
  "viewCount",
  "subscriberCount",
  "hiddenSubscriberCount",
  "videoCount",
  "recentVideoCount",
  "moreVideosExist",
  "quotaUnitsSpent",
  "recentVideos",
]);

export const YOUTUBE_VIDEO_FACT_KEYS: readonly string[] = Object.freeze([
  "videoId",
  "title",
  "publishedAt",
  "viewCount",
  "likeCount",
  "commentCount",
]);

export interface RecordYouTubeObservationDeps extends ReadChannelObservationDeps, ProviderObservationWriteDeps {
  /** Injectable so the composition is provable with no key, no network and no database. */
  readonly observe?: (
    tenant: TenantContext | null,
    handle: string,
    deps: ReadChannelObservationDeps,
  ) => Promise<ReadChannelObservationOutcome>;
  readonly record?: typeof recordProviderObservation;
}

export interface RecordYouTubeObservationResult {
  /** What the provider said, on its own terms. Unchanged by whether Hebun remembered it. */
  readonly observation: ReadChannelObservationOutcome;
  /** What became of the record. Absent when there was no successful observation to record. */
  readonly record?: ProviderObservationWriteResult;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Observed provider history is server-only.");
  }
}

/**
 * Observe one public channel through the released seam, and — only if it succeeded — record what
 * the provider said.
 *
 * THE HANDLE IS AN ARGUMENT AND STAYS ONE. No row learns it: the subject is built from the CHANNEL
 * ID the provider itself returned, so an observation can never be filed against a subject the
 * provider did not confirm, and two observations of one channel stay comparable across a rename.
 */
export async function recordYouTubeChannelObservation(
  tenant: TenantContext | null,
  rawHandle: string,
  deps: RecordYouTubeObservationDeps = {},
): Promise<RecordYouTubeObservationResult> {
  assertServerOnly();

  const observe = deps.observe ?? readPublicChannelObservation;
  const outcome = await observe(tenant, rawHandle, deps);
  if (!outcome.ok) return { observation: outcome };

  const write = deps.record ?? recordProviderObservation;
  const record = await write(
    tenant,
    {
      providerKey: YOUTUBE_PROVIDER_KEY,
      capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
      subjectKind: YOUTUBE_CHANNEL_SUBJECT_KIND,
      subjectRef: youtubeChannelSubjectRef(outcome.value.channel.channelId),
      /* The connection the CAPABILITY AUTHORITY chose, as the read seam reported it. */
      integrationId: outcome.integrationId,
      observedAt: outcome.value.observedAt,
      facts: youtubeChannelObservationFacts(outcome.value),
    },
    deps,
  );

  return { observation: outcome, record };
}
