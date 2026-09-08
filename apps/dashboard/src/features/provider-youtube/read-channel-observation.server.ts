/*
 * provider-youtube/read-channel-observation.server.ts — one live public observation (CGO-5).
 *
 * Three list calls, three units, one page, nothing stored:
 *
 *   channels.list(forHandle)  →  identity + statistics + uploads playlist id
 *   playlistItems.list        →  the newest MAX_RECENT_VIDEOS upload ids
 *   videos.list(ids)          →  their public statistics
 *
 * The handle is a RUNTIME ARGUMENT. It is validated, normalised, sent to YouTube and forgotten;
 * no row learns it. What comes back is an observation of what YouTube makes public about that
 * channel at this moment — not the tenant's channel, not Knowledge, not a judgement.
 *
 * A read runs ONLY through `withConnectedYouTubeApiKey`, so the capability authority decides
 * first, every time. A partial failure (the channel answered, the videos did not) is a failure:
 * this module never returns a channel with an empty video list it did not actually observe.
 *
 * ── THE ONE EXCEPTION, AND WHY IT IS NOT A WEAKENING (TRH-20-FIX) ────────────
 *
 * A channel with no public uploads has no uploads playlist to fetch. YouTube materialises that
 * playlist only once something is in it, so `playlistItems.list` on the id `contentDetails` reports
 * answers `404 playlistNotFound`. The released reading of that was "the videos did not answer" —
 * and it was wrong, because YouTube DID answer: it said there is nothing there. `videoCount: 0`
 * in the same response is the provider stating the same fact a second time.
 *
 * So exactly one state converts: the channel's own public statistics report ZERO videos AND the
 * playlist read failed with the typed class `not-found`. Then the observation succeeds with an
 * empty video list, which is what was actually observed.
 *
 * IT IS CONDITIONED ON `videoCount === 0` AND NOTHING ELSE. A channel that reports uploads whose
 * playlist cannot be read is a real failure and stays one; a channel whose count YouTube did not
 * report (`null`) is not evidence of emptiness and stays a failure too. The decision is made on the
 * TYPED FAILURE CLASS and a number, never by reading a reason string — a reason is a diagnostic and
 * must not be able to change what is authorized or believed.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  MAX_RECENT_VIDEOS,
  OBSERVATION_QUOTA_UNITS,
  normalizeYouTubeHandle,
  type YouTubeChannelObservation,
  type YouTubeFailure,
  type YouTubeResult,
} from "./contracts";
import {
  withConnectedYouTubeApiKey,
  type YouTubeApiKeyCallDeps,
  type YouTubeAuthorizedOutcome,
} from "./youtube-api-key-call.server";
import {
  listChannelById,
  listChannelByHandle,
  listUploadsPage,
  listVideos,
  type ChannelListing,
} from "./youtube-transport.server";

export interface ReadChannelObservationDeps extends YouTubeApiKeyCallDeps {
  readonly now?: () => Date;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("YouTube channel observation is server-only.");
  }
}

/** The whole observation against one key. Exported so a verifier-free test can drive it. */
export async function observeChannelWithKey(
  apiKey: string,
  handle: string,
  deps: ReadChannelObservationDeps = {},
): Promise<YouTubeResult<YouTubeChannelObservation>> {
  return observeFromChannel(apiKey, () => listChannelByHandle(apiKey, handle, deps), deps);
}

/**
 * The same observation, against the provider's own CHANNEL ID (TRH-24).
 *
 * A standing authorization binds the canonical subject reference, so the machine path has an id and
 * never a handle. Everything after the first call is IDENTICAL and literally shared — the uploads
 * page, the videos, the quota accounting and the empty-channel exception all live in one function
 * below. Duplicating them would have created a second reading of the same provider, free to drift
 * from the human one, and the whole value of an observation is that two of them are comparable.
 */
export async function observeChannelById(
  apiKey: string,
  channelId: string,
  deps: ReadChannelObservationDeps = {},
): Promise<YouTubeResult<YouTubeChannelObservation>> {
  return observeFromChannel(apiKey, () => listChannelById(apiKey, channelId, deps), deps);
}

/** Everything after the channel is found. One body, two entry points, no duplicated transport. */
async function observeFromChannel(
  apiKey: string,
  fetchChannel: () => Promise<YouTubeResult<ChannelListing>>,
  deps: ReadChannelObservationDeps,
): Promise<YouTubeResult<YouTubeChannelObservation>> {
  const channel = await fetchChannel();
  if (!channel.ok) return channel;

  /*
   * OPERATIONS ACTUALLY MADE, COUNTED AS THEY HAPPEN.
   *
   * The previous expression DERIVED the count from the shape of the result, and a derived count can
   * disagree with what went out: a channel whose uploads playlist existed but returned no ids was
   * reported as three units when only two calls were made. Counting at the call site cannot drift,
   * and `OBSERVATION_QUOTA_UNITS` remains the CEILING this read may spend rather than a value it
   * asserts about every outcome.
   */
  let operations = 1;

  let videoIds: readonly string[] = [];
  let total: number | null = null;
  if (channel.value.uploadsPlaylistId) {
    const uploads = await listUploadsPage(apiKey, channel.value.uploadsPlaylistId, deps);
    operations += 1;
    if (!uploads.ok) {
      /* The one exception, stated in this file's header. Class and count; never a reason string. */
      const channelReportsNoVideos = channel.value.channel.videoCount === 0;
      if (!(uploads.failure === "not-found" && channelReportsNoVideos)) return uploads;
    } else {
      videoIds = uploads.value.videoIds;
      total = uploads.value.totalReportedByProvider;
    }
  }

  /* `listVideos` short-circuits on an empty list, so an empty channel spends nothing here. */
  const videos = await listVideos(apiKey, videoIds, deps);
  if (!videos.ok) return videos;
  if (videoIds.length > 0) operations += 1;

  return {
    ok: true,
    value: Object.freeze({
      channel: channel.value.channel,
      recentVideos: videos.value,
      moreVideosExist: total !== null ? total > MAX_RECENT_VIDEOS : videoIds.length >= MAX_RECENT_VIDEOS,
      observedAt: (deps.now ?? (() => new Date()))().toISOString(),
      quotaUnitsSpent: Math.min(operations, OBSERVATION_QUOTA_UNITS),
    }),
  };
}

export type ReadChannelObservationOutcome =
  | YouTubeAuthorizedOutcome<YouTubeChannelObservation>
  | { readonly ok: false; readonly refusal: "invalid-handle" };

/** Observe one public channel for THIS tenant, through its available connection. */
export async function readPublicChannelObservation(
  tenant: TenantContext | null,
  rawHandle: string,
  deps: ReadChannelObservationDeps = {},
): Promise<ReadChannelObservationOutcome> {
  assertServerOnly();
  const handle = normalizeYouTubeHandle(rawHandle);
  if (handle === null) return { ok: false, refusal: "invalid-handle" };
  return withConnectedYouTubeApiKey<YouTubeChannelObservation>(
    tenant,
    (apiKey) => observeChannelWithKey(apiKey, handle, deps),
    deps,
  );
}

export type { YouTubeFailure };
