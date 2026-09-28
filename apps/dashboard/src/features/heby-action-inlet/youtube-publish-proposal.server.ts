/*
 * heby-action-inlet/youtube-publish-proposal.server.ts — YOUTUBE-WRITE-2: file ONE pending
 * `publish-youtube-video` request for a human to decide. It prepares; it does not authorize,
 * execute, arm, or upload anything.
 *
 * Every consequential fact is READ here from the authority that owns it and frozen into the payload
 * the permit will bind:
 *
 *   connection + Google account   capability availability (`google.youtube.video.upload`, writeCapable)
 *   channel                       YouTube's own `channels.list?mine=true` for THAT connection — exactly one
 *   title + description           the Content Package (artifact title, revision copy), verbatim
 *   readiness                     the Content Package's `ready`, never recomputed here
 *   video + its bytes             the package's selected, approved video and its Media row digest
 *
 * Four facts have no owner in Hebun today and are supplied by the human preparing the act:
 * `privacyStatus`, `categoryId`, `selfDeclaredMadeForKids`, `containsSyntheticMedia`. They live
 * only in this request's payload, bound by its digest — not a second metadata authority.
 *
 * Out-of-contract metadata is REFUSED, never truncated.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordActionRequest } from "@/features/action-authorization/record-action-request.server";
import { readContentPackage } from "@/features/content-composition/read-content-package.server";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import type { HebyEvidenceReference } from "@/features/heby-integration";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import { selectVideoAssetRow } from "@/features/media-assets/read-verified-video.server";
import { formatWorkArtifactRef, isWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import { resolveWorkArtifactReference } from "@/features/work-artifacts/read-work-artifacts.server";
import {
  PUBLISH_YOUTUBE_VIDEO_ACTION_KIND,
  YOUTUBE_CATEGORY_ID,
  YOUTUBE_PRIVACY_STATUSES,
  youtubeMetadataIssues,
  type YouTubePrivacyStatus,
} from "@/features/youtube-publishing/contracts";
import {
  readChannelForConnection,
  resolveYouTubePublishConnection,
  type YouTubePublishResolveDeps,
} from "@/features/youtube-publishing/resolve-youtube-publish.server";
import { SEND_OWNER_WORKSPACE } from "./contracts";

export interface YouTubePublishProposalInput {
  readonly draftRef: string;
  readonly videoAssetId: string;
  readonly privacyStatus: string;
  readonly categoryId: string;
  /** `yes` / `no` — the human's own declaration, never inferred. */
  readonly madeForKids: string;
  /** `yes` / `no` — the human's own declaration, never inferred. */
  readonly syntheticMedia: string;
}

export type YouTubePublishProposalRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "persistence-unavailable"
  | "publish-not-possible"
  | "channel-not-verified"
  | "draft-not-found"
  | "draft-retired"
  | "draft-superseded"
  | "draft-not-youtube-content"
  | "package-not-ready"
  | "video-not-selected"
  | "video-not-approved"
  | "video-not-publishable"
  | "metadata-invalid"
  | "already-pending"
  | "not-authorizable";

export type YouTubePublishProposalResult =
  | { readonly status: "proposed"; readonly requestId: string; readonly channelId: string; readonly channelTitle: string }
  | { readonly status: "refused"; readonly reason: YouTubePublishProposalRefusal; readonly detail?: string };

export interface YouTubePublishProposalDeps extends YouTubePublishResolveDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly readPackage?: typeof readContentPackage;
  readonly readChannel?: typeof readChannelForConnection;
  readonly resolveConnection?: typeof resolveYouTubePublishConnection;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const YES_NO = /^(yes|no)$/;

const refused = (reason: YouTubePublishProposalRefusal, detail?: string): YouTubePublishProposalResult => ({
  status: "refused",
  reason,
  ...(detail ? { detail } : {}),
});

export async function proposeYouTubePublish(
  tenant: TenantContext | null,
  input: YouTubePublishProposalInput | null,
  deps: YouTubePublishProposalDeps = {},
): Promise<YouTubePublishProposalResult> {
  if (typeof window !== "undefined") throw new Error("Action proposals are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (
    !input ||
    !isWorkArtifactRef(input.draftRef) ||
    !UUID.test(input.videoAssetId ?? "") ||
    !(YOUTUBE_PRIVACY_STATUSES as readonly string[]).includes(input.privacyStatus) ||
    !YOUTUBE_CATEGORY_ID.test(input.categoryId ?? "") ||
    !YES_NO.test(input.madeForKids ?? "") ||
    !YES_NO.test(input.syntheticMedia ?? "")
  ) {
    return refused("invalid-input");
  }

  /* ── The connection that may upload: available AND write-capable, exactly one. ── */
  const connection = await (deps.resolveConnection ?? resolveYouTubePublishConnection)(tenant, deps);
  if (connection.status !== "available") return refused("publish-not-possible", connection.reason);

  /* ── The draft: a YouTube content draft, current revision. ── */
  const draft = await resolveWorkArtifactReference(tenant, input.draftRef, deps);
  if (!draft.readable || !draft.revision || !draft.artifact) return refused("draft-not-found");
  if (draft.standing === "retired") return refused("draft-retired");
  if (!draft.proposable) return refused("draft-superseded");
  if (draft.artifact.artifactType !== "content-draft" || draft.artifact.intendedDestination !== "youtube") {
    return refused("draft-not-youtube-content");
  }

  /* ── The Content Package: its own readiness, its own title and copy, its own selection. ── */
  const read = await (deps.readPackage ?? readContentPackage)(
    tenant,
    { artifactId: draft.revision.artifactId, revisionNo: draft.revision.revisionNo },
    deps,
  );
  if (read.status === "unavailable") return refused("persistence-unavailable");
  if (read.status !== "read") return refused("draft-not-found");
  const pkg = read.package;
  const selected = pkg.selected.find((m) => m.mediaAssetId === input.videoAssetId.toLowerCase());
  if (!selected || selected.mediaKind !== "video") return refused("video-not-selected");
  if (pkg.mediaReviewStates[selected.mediaAssetId] !== "approved") return refused("video-not-approved");
  if (!pkg.ready) return refused("package-not-ready", pkg.blockers.join(","));
  const issues = youtubeMetadataIssues(pkg.title, pkg.copy);
  if (issues.length > 0) return refused("metadata-invalid", issues.join(","));

  /* ── The video's own Media row: an admitted mp4, and its digest. ── */
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  let asset;
  try {
    asset = await selectVideoAssetRow(db, tenant.tenantId, selected.mediaAssetId);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!asset || asset.mediaKind !== "video" || asset.mimeType !== "video/mp4" || asset.lifecycle !== "admitted") {
    return refused("video-not-publishable");
  }

  /* ── The channel: exactly one, as YouTube answers for THIS connection's token. ── */
  const channel = await (deps.readChannel ?? readChannelForConnection)(tenant, connection.connection.integrationId, deps);
  if (channel.status !== "one-channel") {
    return refused("channel-not-verified", channel.status === "unreadable" ? channel.reason : `channels=${channel.count}`);
  }

  const draftRef = formatWorkArtifactRef(draft.revision.artifactId, draft.revision.revisionNo);
  const evidence: readonly HebyEvidenceReference[] = [
    { sourceClass: "work-artifacts", recordRef: draftRef, lifecycle: "settled" },
  ];
  const prepared = prepareAction({
    actionKind: PUBLISH_YOUTUBE_VIDEO_ACTION_KIND,
    requestingWorkspace: SEND_OWNER_WORKSPACE,
    target: { kind: "record", ref: draftRef, label: pkg.title },
    proposedArguments: {
      integrationId: connection.connection.integrationId,
      externalAccountId: connection.connection.externalAccountId,
      expectedChannelId: channel.channel.channelId,
      channelTitle: channel.channel.title,
      draftRef,
      draftRevisionDigest: draft.revision.contentDigest,
      videoAssetRef: selected.mediaAssetId,
      videoAssetDigest: asset.byteDigest,
      title: pkg.title,
      description: pkg.copy,
      privacyStatus: input.privacyStatus as YouTubePrivacyStatus,
      categoryId: input.categoryId,
      selfDeclaredMadeForKids: input.madeForKids === "yes",
      containsSyntheticMedia: input.syntheticMedia === "yes",
    },
    evidence,
  });
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") return refused("not-authorizable", prepared.lifecycleState);

  const recorded = await recordActionRequest(tenant, prepared, deps);
  if (recorded.status === "recorded") {
    return { status: "proposed", requestId: recorded.requestId, channelId: channel.channel.channelId, channelTitle: channel.channel.title };
  }
  if (recorded.reason === "already-pending") return refused("already-pending");
  if (recorded.reason === "persistence-unavailable") return refused("persistence-unavailable");
  return refused("not-authorizable", recorded.reason);
}
