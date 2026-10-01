/*
 * provider-observation-history/record-youtube-video-observation.server.ts — the composition for a
 * HUMAN-TRIGGERED recorded measurement of one own YouTube video (YOUTUBE-RECORDED-MEASUREMENT-1).
 *
 * ── TWO RELEASED SEAMS, COMPOSED ─────────────────────────────────────────────
 *
 *   readYouTubeVideoMetrics     the capability-gated fresh read. It confirms the exact connection
 *                               with the capability authority and names the one it spent.
 *   recordProviderObservation   TRH-21's one writer. One INSERT, append-only, human provenance read
 *                               off the authorized context.
 *
 * ── THE VIDEO IS AN ARGUMENT AND STAYS ONE ──────────────────────────────────
 *
 * Which video to ask about, which connection to ask through and which channel it is expected on are
 * handed in by a server caller that resolved them elsewhere. This module does not know where they
 * came from and MUST NOT find out: it imports no ledger, no permit, no Governance decision and no
 * execution attempt, directly or through a publishing module. A permit is how a caller looked the
 * video up; it is not what makes the observation legitimate. What does is the capability authority
 * answering for the read, upstream, exactly as TRH-21 states.
 *
 * ── THE SUBJECT IS THE CHANNEL, AS YOUTUBE REPORTED IT ──────────────────────
 *
 * The same identity the Instagram media observation chose: the subject is the ACCOUNT the read was
 * made against, and the items are what it reported. A per-video subject kind would make every
 * upload its own observable subject. The subject reference is built from the `channelId` in
 * YouTube's own response, never from the expected one.
 *
 * ── THE EXPECTED CHANNEL IS A CONDITION, NEVER A FACT ───────────────────────
 *
 * It is Hebun's own record of where a publication was authorized, not something YouTube said. It is
 * compared and discarded: a video YouTube reports on a different channel is not recorded, and the
 * expected id reaches neither the subject nor `facts`.
 *
 * ── WHAT DOES NOT HAPPEN HERE ───────────────────────────────────────────────
 *
 * No schedule, no retry, no loop, no second call. One read, at most one row, and stop. Not found,
 * unreadable, a channel YouTube did not report and a channel that does not match all write NOTHING.
 * **THIS CREATES MEMORY OF ONE AUTHORIZED OBSERVATION. IT CREATES NO AUTHORITY TO MAKE ANOTHER.**
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
  type GoogleFailureClass,
} from "@/features/provider-google/contracts";
import {
  readYouTubeVideoMetrics,
  type YouTubeVideoMetricsDeps,
  type YouTubeVideoMetricsRefusal,
  type YouTubeVideoMetricsResult,
} from "@/features/provider-google/read-youtube-video-metrics.server";
import type { ObservationFacts, ProviderObservationWriteResult } from "./contracts";
import {
  YOUTUBE_CHANNEL_SUBJECT_KIND,
  channelIdFromSubjectRef,
  youtubeChannelSubjectRef,
} from "./record-youtube-channel-observation.server";
import {
  recordProviderObservation,
  type ProviderObservationWriteDeps,
} from "./write-provider-observation.server";

/** What one successful, matching read reported. Every value is YouTube's except `observedAt`. */
export interface YouTubeVideoMeasurement {
  readonly videoId: string;
  readonly channelId: string;
  readonly publishedAt: string | null;
  readonly viewCount: number | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
  /** Hebun's read instant — the observation's `observed_at`. */
  readonly observedAt: string;
}

/** Every key the mapper may produce at the top level. Asserted by test. */
export const YOUTUBE_VIDEO_METRICS_FACT_KEYS: readonly string[] = Object.freeze(["channelId", "videos"]);

/** Every key one video may contribute. Asserted by test, so the closed set cannot quietly widen. */
export const YOUTUBE_VIDEO_METRICS_ITEM_FACT_KEYS: readonly string[] = Object.freeze([
  "videoId",
  "publishedAt",
  "viewCount",
  "likeCount",
  "commentCount",
]);

/**
 * The typed projection stored for one recorded video measurement.
 *
 * A NEW object with a CLOSED key set — no spread, no passthrough. `0` is a count YouTube reported
 * and stays `0`; `null` means it reported none and stays `null`. Nothing is coalesced or derived.
 */
export function youtubeVideoMetricsObservationFacts(measurement: YouTubeVideoMeasurement): ObservationFacts {
  return Object.freeze({
    channelId: measurement.channelId,
    videos: Object.freeze([
      Object.freeze({
        videoId: measurement.videoId,
        publishedAt: measurement.publishedAt,
        viewCount: measurement.viewCount,
        likeCount: measurement.likeCount,
        commentCount: measurement.commentCount,
      }),
    ]),
  }) as ObservationFacts;
}

export type YouTubeVideoObservationResult =
  /** The gate refused before any credential was touched. Nothing was read or written. */
  | { readonly status: "refused"; readonly reason: YouTubeVideoMetricsRefusal }
  /** YouTube was contacted and did not answer usefully. Nothing was written. */
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string }
  /** YouTube returned no such video to this connection. Nothing was written. */
  | { readonly status: "not-found-at-youtube" }
  /** YouTube returned the video without a usable channel id. No subject, so nothing was written. */
  | { readonly status: "channel-not-reported" }
  /** YouTube reports the video on a channel other than the expected one. Nothing was written. */
  | { readonly status: "channel-mismatch" }
  /**
   * The read succeeded and matched. `record` says what became of Hebun's memory of it — the two are
   * returned separately because a failed write does not unmake what YouTube said.
   */
  | {
      readonly status: "observed";
      readonly measurement: YouTubeVideoMeasurement;
      readonly record: ProviderObservationWriteResult;
    };

export interface RecordYouTubeVideoObservationDeps extends YouTubeVideoMetricsDeps, ProviderObservationWriteDeps {
  /** Injectable so the composition is provable with no credential, no network and no database. */
  readonly observe?: (
    tenant: TenantContext | null,
    input: { readonly videoId: string; readonly integrationId: string },
    deps: YouTubeVideoMetricsDeps,
  ) => Promise<YouTubeVideoMetricsResult>;
  readonly record?: typeof recordProviderObservation;
}

/**
 * Read one own video through the capability authority and — only if YouTube returned it on the
 * expected channel — record what YouTube said.
 */
export async function recordYouTubeVideoObservation(
  tenant: TenantContext | null,
  input: { readonly videoId: string; readonly integrationId: string; readonly expectedChannelId: string },
  deps: RecordYouTubeVideoObservationDeps = {},
): Promise<YouTubeVideoObservationResult> {
  if (typeof window !== "undefined") throw new Error("Observed provider history is server-only.");

  const observe = deps.observe ?? readYouTubeVideoMetrics;
  const outcome = await observe(tenant, { videoId: input.videoId, integrationId: input.integrationId }, deps);
  if (outcome.status === "refused") return { status: "refused", reason: outcome.reason };
  if (outcome.status === "provider-failed") {
    return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };
  }
  if (outcome.status === "not-found") return { status: "not-found-at-youtube" };

  /* The subject must be one the released channel format can express, or there is no subject. */
  const channelId = outcome.channelId;
  if (channelId === null || channelIdFromSubjectRef(youtubeChannelSubjectRef(channelId)) === null) {
    return { status: "channel-not-reported" };
  }
  if (channelId !== input.expectedChannelId) return { status: "channel-mismatch" };
  const subjectRef = youtubeChannelSubjectRef(channelId);

  const measurement: YouTubeVideoMeasurement = Object.freeze({
    videoId: outcome.videoId,
    channelId,
    publishedAt: outcome.publishedAt,
    viewCount: outcome.viewCount,
    likeCount: outcome.likeCount,
    commentCount: outcome.commentCount,
    observedAt: outcome.readAt,
  });

  const write = deps.record ?? recordProviderObservation;
  const record = await write(
    tenant,
    {
      providerKey: GOOGLE_YOUTUBE_PROVIDER_KEY,
      capabilityKey: GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
      subjectKind: YOUTUBE_CHANNEL_SUBJECT_KIND,
      subjectRef,
      /* The connection the CAPABILITY AUTHORITY confirmed, as the read seam reported it. */
      integrationId: outcome.integrationId,
      observedAt: outcome.readAt,
      facts: youtubeVideoMetricsObservationFacts(measurement),
    },
    deps,
  );

  return { status: "observed", measurement, record };
}
