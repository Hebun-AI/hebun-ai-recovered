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
import { listChannelByHandle, listUploadsPage, listVideos } from "./youtube-transport.server";

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
  const channel = await listChannelByHandle(apiKey, handle, deps);
  if (!channel.ok) return channel;

  let videoIds: readonly string[] = [];
  let total: number | null = null;
  if (channel.value.uploadsPlaylistId) {
    const uploads = await listUploadsPage(apiKey, channel.value.uploadsPlaylistId, deps);
    if (!uploads.ok) return uploads;
    videoIds = uploads.value.videoIds;
    total = uploads.value.totalReportedByProvider;
  }

  const videos = await listVideos(apiKey, videoIds, deps);
  if (!videos.ok) return videos;

  return {
    ok: true,
    value: Object.freeze({
      channel: channel.value.channel,
      recentVideos: videos.value,
      moreVideosExist: total !== null ? total > MAX_RECENT_VIDEOS : videoIds.length >= MAX_RECENT_VIDEOS,
      observedAt: (deps.now ?? (() => new Date()))().toISOString(),
      quotaUnitsSpent: channel.value.uploadsPlaylistId ? OBSERVATION_QUOTA_UNITS : videoIds.length > 0 ? 2 : 1,
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
