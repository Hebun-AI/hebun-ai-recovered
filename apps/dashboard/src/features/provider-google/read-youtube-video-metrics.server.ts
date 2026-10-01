/*
 * provider-google/read-youtube-video-metrics.server.ts — YOUTUBE-RECORDED-MEASUREMENT-1: ONE FRESH
 * READ OF ONE OWN VIDEO, THROUGH THE CAPABILITY AUTHORITY.
 *
 * ── WHY THIS IS NOT THE UPLOAD READ-BACK ─────────────────────────────────────
 *
 * `readYouTubeUploadedVideo` answers "what does YouTube say about this upload right now" and spends
 * the connection the governed payload bound, without asking the capability authority anything. That
 * is right for a read that stores nothing. A read whose answer is about to be RECORDED has a
 * stricter precondition — Provider Observation History may only be handed "the connection the
 * capability authority chose" — so this seam asks first, and reports the connection it spent.
 *
 * ── THE CONNECTION IS NAMED, AND THEN CONFIRMED ──────────────────────────────
 *
 * The caller names ONE connection (resolved server-side; never a client value). This seam does not
 * pick a different one: it asks `getCapabilityAvailability` whether THAT EXACT connection can answer
 * `google.youtube.video.metrics.read` right now, on the `google-youtube` provider, and refuses if
 * not. Naming without confirming would bypass the authority; confirming a different connection
 * would read another channel's view of a private video.
 *
 * It reuses the production-verified `readYouTubeVideo` transport unchanged. Nothing is stored here,
 * no table is touched, and no ledger is read.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { getCapabilityAvailability } from "@/features/integration-authority/capability-availability.server";
import {
  GOOGLE_YOUTUBE_PROVIDER_KEY,
  GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY,
  type GoogleFailureClass,
} from "./contracts";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "./google-authorized-call.server";
import { readYouTubeVideo } from "./google-transport.server";

export type YouTubeVideoMetricsRefusal =
  | "no-authorized-tenant-context"
  /** The capability authority does not report this capability as available at all. */
  | "capability-not-available"
  /** The capability is available somewhere, but NOT on the exact connection that was named. */
  | "connection-not-available";

export type YouTubeVideoMetricsResult =
  | { readonly status: "refused"; readonly reason: YouTubeVideoMetricsRefusal }
  | { readonly status: "provider-failed"; readonly failure: GoogleFailureClass; readonly reason: string }
  /** YouTube answered and returned no such video to this connection. */
  | { readonly status: "not-found" }
  | {
      readonly status: "read";
      /** The connection the capability authority confirmed and this read actually spent. */
      readonly integrationId: string;
      readonly videoId: string;
      /** `snippet.channelId` as YouTube reported it, or `null` if it reported none. */
      readonly channelId: string | null;
      /** YouTube's publication instant. NOT when it was read. */
      readonly publishedAt: string | null;
      /** As YouTube reported them. `null` = not reported or not a count; never 0. */
      readonly viewCount: number | null;
      readonly likeCount: number | null;
      readonly commentCount: number | null;
      /** Hebun's own clock, taken once YouTube had answered. */
      readonly readAt: string;
    };

export interface YouTubeVideoMetricsDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly getAvailability?: typeof getCapabilityAvailability;
  readonly readVideo?: typeof readYouTubeVideo;
  /** Test seam for the credential spend; production always uses `withGoogleAccessToken`. */
  readonly withToken?: typeof withGoogleAccessToken;
}

export async function readYouTubeVideoMetrics(
  tenant: TenantContext | null,
  input: { readonly videoId: string; readonly integrationId: string },
  deps: YouTubeVideoMetricsDeps = {},
): Promise<YouTubeVideoMetricsResult> {
  if (typeof window !== "undefined") throw new Error("YouTube video metrics reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "no-authorized-tenant-context" };

  /* ── THE GATE. BEFORE ANY CREDENTIAL IS TOUCHED. ── */
  const availability = await (deps.getAvailability ?? getCapabilityAvailability)(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find((c) => c.capability === GOOGLE_YOUTUBE_VIDEO_METRICS_CAPABILITY);
  if (!entry || entry.state !== "available") return { status: "refused", reason: "capability-not-available" };
  const source = entry.sources.find(
    (s) => s.integrationId === input.integrationId && s.readAvailable && s.providerKey === GOOGLE_YOUTUBE_PROVIDER_KEY,
  );
  if (!source) return { status: "refused", reason: "connection-not-available" };

  const read = deps.readVideo ?? readYouTubeVideo;
  const outcome = await (deps.withToken ?? withGoogleAccessToken)(
    tenant,
    source.integrationId,
    async (accessToken) => {
      const result = await read(input.videoId, accessToken, deps);
      if (!result.ok) return result;
      return { ok: true as const, value: result };
    },
    deps,
  );
  if (!outcome.ok) return { status: "provider-failed", failure: outcome.failure, reason: outcome.reason };

  /* Taken once the provider has answered: the instant these values were true as far as Hebun knows. */
  const readAt = (deps.now ?? (() => new Date()))().toISOString();
  const video = outcome.value;
  if (!video.found) return { status: "not-found" };
  return {
    status: "read",
    integrationId: source.integrationId,
    videoId: video.videoId,
    channelId: video.channelId,
    publishedAt: video.publishedAt,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    readAt,
  };
}
