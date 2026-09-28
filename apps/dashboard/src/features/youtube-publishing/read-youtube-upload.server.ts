/*
 * youtube-publishing/read-youtube-upload.server.ts — YOUTUBE-WRITE-2's READ-BACK.
 *
 * The attempt ledger records the one fact an upload proves: YouTube returned a video id. Everything
 * after that — processing, a processing failure, a rejection, the privacy YouTube actually applied,
 * the channel the video landed on — is YouTube's to say, and this reads it ON DEMAND with the same
 * connection that uploaded. Nothing is stored: no lifecycle is invented beside the ledger.
 *
 *     VIDEO RESOURCE CREATED != PROCESSED != VISIBLE
 *
 * It takes a permit id from the session's own tenant and nothing else. Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import { actionExecutionAttempts } from "@/db/schema/action-execution";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { withGoogleAccessToken, type GoogleAuthorizedCallDeps } from "@/features/provider-google/google-authorized-call.server";
import { readYouTubeVideo } from "@/features/provider-google/google-transport.server";
import { PUBLISH_YOUTUBE_VIDEO_ACTION_KIND, asPublishYouTubeVideoPayload } from "./contracts";

export type YouTubeUploadReadResult =
  | {
      readonly status: "read";
      readonly videoId: string;
      /** YouTube's `status.uploadStatus`: uploaded · processed · failed · rejected · deleted. */
      readonly uploadStatus: string | null;
      readonly processingStatus: string | null;
      readonly failureReason: string | null;
      readonly rejectionReason: string | null;
      /** The privacy YouTube applied — an unverified project's upload is forced to `private`. */
      readonly privacyStatus: string | null;
      readonly authorizedPrivacy: string;
      /** Whether the video sits on the channel the human authorized. */
      readonly onAuthorizedChannel: boolean | null;
    }
  | { readonly status: "not-found-at-youtube"; readonly videoId: string }
  | { readonly status: "no-video"; readonly reason: "no-such-upload" | "not-accepted" }
  | { readonly status: "unreadable"; readonly reason: string };

export interface YouTubeUploadReadDeps extends GoogleAuthorizedCallDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly readVideo?: typeof readYouTubeVideo;
  /** Test seam for the credential spend; production always uses `withGoogleAccessToken`. */
  readonly withToken?: typeof withGoogleAccessToken;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function readYouTubeUploadedVideo(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: YouTubeUploadReadDeps = {},
): Promise<YouTubeUploadReadResult> {
  if (typeof window !== "undefined") throw new Error("YouTube read-back is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unreadable", reason: "unauthenticated" };
  if (!UUID.test(input?.permitId ?? "")) return { status: "no-video", reason: "no-such-upload" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unreadable", reason: "persistence-unavailable" };

  let row;
  try {
    const rows = await db
      .select({
        status: actionExecutionAttempts.status,
        providerMessageId: actionExecutionAttempts.providerMessageId,
        canonicalPayload: hebyActionRequests.canonicalPayload,
      })
      .from(actionExecutionAttempts)
      .innerJoin(
        hebyActionRequests,
        and(
          eq(hebyActionRequests.id, actionExecutionAttempts.actionRequestId),
          eq(hebyActionRequests.tenantId, actionExecutionAttempts.tenantId),
        ),
      )
      .where(
        and(
          eq(actionExecutionAttempts.tenantId, tenant.tenantId),
          eq(actionExecutionAttempts.permitId, input.permitId),
          eq(actionExecutionAttempts.actionKind, PUBLISH_YOUTUBE_VIDEO_ACTION_KIND),
        ),
      )
      .limit(1);
    row = rows[0];
  } catch {
    return { status: "unreadable", reason: "persistence-unavailable" };
  }
  if (!row) return { status: "no-video", reason: "no-such-upload" };
  if (row.status !== "accepted" || !row.providerMessageId) return { status: "no-video", reason: "not-accepted" };
  const payload = asPublishYouTubeVideoPayload(row.canonicalPayload);
  if (!payload) return { status: "unreadable", reason: "payload-unreadable" };
  const videoId = row.providerMessageId;

  const read = deps.readVideo ?? readYouTubeVideo;
  const outcome = await (deps.withToken ?? withGoogleAccessToken)(
    tenant,
    payload.integrationId,
    async (token) => {
      const result = await read(videoId, token);
      if (!result.ok) return result;
      return { ok: true as const, value: result };
    },
    deps,
  );
  if (!outcome.ok) return { status: "unreadable", reason: outcome.reason };
  const video = outcome.value;
  if (!video.found) return { status: "not-found-at-youtube", videoId };
  return {
    status: "read",
    videoId,
    uploadStatus: video.uploadStatus,
    processingStatus: video.processingStatus,
    failureReason: video.failureReason,
    rejectionReason: video.rejectionReason,
    privacyStatus: video.privacyStatus,
    authorizedPrivacy: payload.privacyStatus,
    onAuthorizedChannel: video.channelId === null ? null : video.channelId === payload.expectedChannelId,
  };
}
