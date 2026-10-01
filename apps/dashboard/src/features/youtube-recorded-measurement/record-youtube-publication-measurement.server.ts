/*
 * youtube-recorded-measurement/record-youtube-publication-measurement.server.ts — the outer
 * orchestration (YOUTUBE-RECORDED-MEASUREMENT-1).
 *
 * ── TWO AUTHORITIES, AND THIS MODULE IS NEITHER ─────────────────────────────
 *
 *   readYouTubePublicationIdentity   Action Authorization. A permit id, in the session's tenant,
 *                                    becomes the video, the channel it was authorized on and the
 *                                    connection — or nothing.
 *   recordYouTubeVideoObservation    Provider Observation History's composition. A capability-gated
 *                                    fresh read, and one append-only row if YouTube returned the
 *                                    video on that channel.
 *
 * It exists so that neither of those has to know about the other. The ledger never learns that an
 * observation was taken, and the observation authority never learns that a permit existed: the
 * identity crosses as three plain arguments. This file holds no SQL, names no table, calls no
 * provider and opens no credential.
 *
 * ── ONE INPUT ────────────────────────────────────────────────────────────────
 *
 * `permitId`, and nothing else. A video id, a channel id, a connection id, a count or a timestamp
 * has no parameter to arrive through.
 *
 * ── THE PERMIT ADMITS NOTHING ───────────────────────────────────────────────
 *
 * It is how a human says WHICH publication. What makes the read legitimate is the capability
 * authority answering for the exact connection, inside the observation composition.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readYouTubePublicationIdentity,
  type ContentPublicationStateDeps,
} from "@/features/action-authorization/content-publication-state.server";
import {
  recordYouTubeVideoObservation,
  type RecordYouTubeVideoObservationDeps,
} from "@/features/provider-observation-history/record-youtube-video-observation.server";

/** Why nothing was recorded. Every one of these wrote ZERO observation rows. */
export type YouTubeMeasurementNotRecordedReason =
  | "unauthenticated"
  /** Hebun could not read its own publication ledger just now. */
  | "ledger-unreadable"
  | "no-such-upload"
  | "not-accepted"
  | "identity-incomplete"
  /** The capability authority does not report the measurement read as available. */
  | "capability-not-available"
  /** The connection that uploaded the video cannot answer the measurement read right now. */
  | "connection-not-available"
  /** YouTube was contacted and did not answer usefully. */
  | "youtube-unreadable"
  | "not-found-at-youtube"
  | "channel-not-reported"
  | "channel-mismatch"
  /** YouTube answered and matched, but Hebun's own write did not complete. */
  | "write-failed";

export type RecordYouTubeMeasurementResult =
  | {
      readonly status: "recorded";
      readonly observationId: string;
      readonly videoId: string;
      /** YOUTUBE REPORTED. `null` = YouTube did not report it; never 0. */
      readonly publishedAt: string | null;
      readonly viewCount: number | null;
      readonly likeCount: number | null;
      readonly commentCount: number | null;
      /** Hebun's read instant — the stored observation's `observed_at`. */
      readonly observedAt: string;
    }
  | { readonly status: "not-recorded"; readonly reason: YouTubeMeasurementNotRecordedReason };

export interface RecordYouTubeMeasurementDeps {
  readonly identity?: ContentPublicationStateDeps;
  readonly observation?: RecordYouTubeVideoObservationDeps;
  /** Injectable so the orchestration is provable without either authority behind it. */
  readonly resolveIdentity?: typeof readYouTubePublicationIdentity;
  readonly observeAndRecord?: typeof recordYouTubeVideoObservation;
}

const notRecorded = (reason: YouTubeMeasurementNotRecordedReason): RecordYouTubeMeasurementResult => ({
  status: "not-recorded",
  reason,
});

export async function recordYouTubePublicationMeasurement(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: RecordYouTubeMeasurementDeps = {},
): Promise<RecordYouTubeMeasurementResult> {
  if (typeof window !== "undefined") throw new Error("Recording a YouTube measurement is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return notRecorded("unauthenticated");

  const identity = await (deps.resolveIdentity ?? readYouTubePublicationIdentity)(
    tenant,
    { permitId: input?.permitId },
    deps.identity ?? {},
  );
  if (identity.status === "unknown") {
    return notRecorded(identity.reason === "no-authorized-tenant-context" ? "unauthenticated" : "ledger-unreadable");
  }
  if (identity.status === "not-resolved") {
    return notRecorded(identity.reason === "no-such-publication" ? "no-such-upload" : identity.reason);
  }

  const outcome = await (deps.observeAndRecord ?? recordYouTubeVideoObservation)(
    tenant,
    {
      videoId: identity.videoId,
      integrationId: identity.integrationId,
      expectedChannelId: identity.expectedChannelId,
    },
    deps.observation ?? {},
  );

  switch (outcome.status) {
    case "refused":
      return notRecorded(outcome.reason === "no-authorized-tenant-context" ? "unauthenticated" : outcome.reason);
    case "provider-failed":
      return notRecorded("youtube-unreadable");
    case "not-found-at-youtube":
    case "channel-not-reported":
    case "channel-mismatch":
      return notRecorded(outcome.status);
    case "observed": {
      /*
       * `already-recorded` cannot be told apart from a fresh write by its values, and it carries no
       * id — so it is reported as a write that did not complete rather than as a new measurement.
       */
      if (outcome.record.status !== "recorded") return notRecorded("write-failed");
      const m = outcome.measurement;
      return {
        status: "recorded",
        observationId: outcome.record.observationId,
        videoId: m.videoId,
        publishedAt: m.publishedAt,
        viewCount: m.viewCount,
        likeCount: m.likeCount,
        commentCount: m.commentCount,
        observedAt: m.observedAt,
      };
    }
  }
}
