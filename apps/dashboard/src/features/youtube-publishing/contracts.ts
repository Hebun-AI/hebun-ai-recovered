/*
 * youtube-publishing/contracts.ts — YOUTUBE-WRITE-2: uploading ONE approved video to the
 * organization's OWN verified YouTube channel, through the same proposal → Governance → permit →
 * `executeAuthorizedAction` → attempt-ledger chain PUBLISH-0 uses. This module owns no authority: it
 * names the action kind, the exact payload a human authorizes, and the provider's metadata rules.
 *
 *     PREPARED != AUTHORIZED != EXECUTION STARTED != UPLOAD SESSION != BYTES TRANSFERRED
 *              != VIDEO RESOURCE CREATED != PROCESSED != VISIBLE
 *
 * Pure. No I/O, no secrets.
 */

export const PUBLISH_YOUTUBE_VIDEO_ACTION_KIND = "publish-youtube-video" as const;

/** The attempt ledger's adapter id: whose `provider_message_id` (a YouTube video id) this is. */
export const YOUTUBE_UPLOAD_ADAPTER_ID = "youtube-resumable-upload-v1" as const;

/** `status.privacyStatus` — the three values the videos resource documents. */
export const YOUTUBE_PRIVACY_STATUSES = Object.freeze(["private", "unlisted", "public"] as const);
export type YouTubePrivacyStatus = (typeof YOUTUBE_PRIVACY_STATUSES)[number];

/*
 * The provider's documented metadata limits (videos resource, verified 2026-09-28): a title of at most
 * 100 characters and a description of at most 5000 bytes, both valid UTF-8 without `<` or `>`.
 * Hebun never truncates or rewrites them: an out-of-contract title or description is a refusal.
 */
export const YOUTUBE_TITLE_MAX_CHARACTERS = 100;
export const YOUTUBE_DESCRIPTION_MAX_BYTES = 5000;
const FORBIDDEN_METADATA_CHARACTERS = /[<>]/;

export type YouTubeMetadataIssue =
  | "title-empty"
  | "title-too-long"
  | "title-forbidden-character"
  | "description-empty"
  | "description-too-long"
  | "description-forbidden-character";

/** Every reason the Content Package's title/copy cannot be sent to YouTube as they are. */
export function youtubeMetadataIssues(title: string, description: string): readonly YouTubeMetadataIssue[] {
  const issues: YouTubeMetadataIssue[] = [];
  if (title.trim().length === 0) issues.push("title-empty");
  if (Array.from(title).length > YOUTUBE_TITLE_MAX_CHARACTERS) issues.push("title-too-long");
  if (FORBIDDEN_METADATA_CHARACTERS.test(title)) issues.push("title-forbidden-character");
  /* The proposal argument validator requires a non-empty string, and so does this contract. */
  if (description.trim().length === 0) issues.push("description-empty");
  if (new TextEncoder().encode(description).byteLength > YOUTUBE_DESCRIPTION_MAX_BYTES) issues.push("description-too-long");
  if (FORBIDDEN_METADATA_CHARACTERS.test(description)) issues.push("description-forbidden-character");
  return issues;
}

/**
 * EXACTLY what a human authorizes. Every consequential fact is here, so the permit's payload digest
 * binds it: the connection and the Google account it is bound to, the channel that account must
 * still resolve to, the exact revision (title + description), the exact video bytes, and the four
 * declarations. The tenant is the request row's; the destination is the action kind.
 */
export interface PublishYouTubeVideoPayload {
  readonly integrationId: string;
  /** The Google account (`sub`) the connection is bound to — `account-changed` keeps it stable. */
  readonly externalAccountId: string;
  /** The ONE channel `channels.list?mine=true` returned at preparation. Re-checked before upload. */
  readonly expectedChannelId: string;
  /** Legibility for the human deciding; bound like everything else, authoritative for nothing. */
  readonly channelTitle: string;
  readonly draftRef: string;
  readonly draftRevisionDigest: string;
  readonly videoAssetRef: string;
  readonly videoAssetDigest: string;
  /** The Content Package's title, verbatim. */
  readonly title: string;
  /** The Content Package's copy (the revision content), verbatim. */
  readonly description: string;
  readonly privacyStatus: YouTubePrivacyStatus;
  /** A YouTube video category id, Director-supplied; YouTube validates it on upload. */
  readonly categoryId: string;
  readonly selfDeclaredMadeForKids: boolean;
  readonly containsSyntheticMedia: boolean;
  /**
   * CONTENT-PUBLICATION-DUPLICATE-GUARD-1 — present only when this act intentionally follows an
   * accepted or unknown attempt for the same channel and revision: that attempt's id. Digest-bound;
   * it authorizes nothing.
   */
  readonly acknowledgesPriorAttemptId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const GOOGLE_SUB = /^[0-9]{1,32}$/;
export const YOUTUBE_CHANNEL_ID = /^UC[0-9A-Za-z_-]{22}$/;
export const YOUTUBE_CATEGORY_ID = /^[0-9]{1,4}$/;
const DRAFT_REF = /^work-artifact\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@[1-9][0-9]{0,8}$/;

const PAYLOAD_KEYS = Object.freeze(
  [
    "categoryId",
    "channelTitle",
    "containsSyntheticMedia",
    "description",
    "draftRef",
    "draftRevisionDigest",
    "expectedChannelId",
    "externalAccountId",
    "integrationId",
    "privacyStatus",
    "selfDeclaredMadeForKids",
    "title",
    "videoAssetDigest",
    "videoAssetRef",
  ].sort(),
);

const PAYLOAD_KEYS_WITH_ACK = Object.freeze([...PAYLOAD_KEYS, "acknowledgesPriorAttemptId"].sort());

/** A stored canonical payload → the typed payload, or `null`. Exact key set; nothing coerced. */
export function asPublishYouTubeVideoPayload(raw: unknown): PublishYouTubeVideoPayload | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  /* DUPLICATE-GUARD-1: exactly the fourteen keys, or the fourteen plus the one optional acknowledgement. */
  const exact = (want: readonly string[]) => keys.length === want.length && keys.every((k, i) => k === want[i]);
  if (!exact(PAYLOAD_KEYS) && !exact(PAYLOAD_KEYS_WITH_ACK)) return null;
  const r = record;
  if (r.acknowledgesPriorAttemptId !== undefined && (typeof r.acknowledgesPriorAttemptId !== "string" || !UUID.test(r.acknowledgesPriorAttemptId))) {
    return null;
  }
  if (typeof r.integrationId !== "string" || !UUID.test(r.integrationId)) return null;
  if (typeof r.externalAccountId !== "string" || !GOOGLE_SUB.test(r.externalAccountId)) return null;
  if (typeof r.expectedChannelId !== "string" || !YOUTUBE_CHANNEL_ID.test(r.expectedChannelId)) return null;
  if (typeof r.channelTitle !== "string" || r.channelTitle.trim().length === 0) return null;
  if (typeof r.draftRef !== "string" || !DRAFT_REF.test(r.draftRef)) return null;
  if (typeof r.draftRevisionDigest !== "string" || !DIGEST.test(r.draftRevisionDigest)) return null;
  if (typeof r.videoAssetRef !== "string" || !UUID.test(r.videoAssetRef)) return null;
  if (typeof r.videoAssetDigest !== "string" || !DIGEST.test(r.videoAssetDigest)) return null;
  if (typeof r.title !== "string" || typeof r.description !== "string") return null;
  if (youtubeMetadataIssues(r.title, r.description).length > 0) return null;
  if (typeof r.privacyStatus !== "string" || !(YOUTUBE_PRIVACY_STATUSES as readonly string[]).includes(r.privacyStatus)) {
    return null;
  }
  if (typeof r.categoryId !== "string" || !YOUTUBE_CATEGORY_ID.test(r.categoryId)) return null;
  if (typeof r.selfDeclaredMadeForKids !== "boolean" || typeof r.containsSyntheticMedia !== "boolean") return null;
  return {
    integrationId: r.integrationId,
    externalAccountId: r.externalAccountId,
    expectedChannelId: r.expectedChannelId,
    channelTitle: r.channelTitle,
    draftRef: r.draftRef,
    draftRevisionDigest: r.draftRevisionDigest,
    videoAssetRef: r.videoAssetRef,
    videoAssetDigest: r.videoAssetDigest,
    title: r.title,
    description: r.description,
    privacyStatus: r.privacyStatus as YouTubePrivacyStatus,
    categoryId: r.categoryId,
    selfDeclaredMadeForKids: r.selfDeclaredMadeForKids,
    containsSyntheticMedia: r.containsSyntheticMedia,
    ...(typeof r.acknowledgesPriorAttemptId === "string" ? { acknowledgesPriorAttemptId: r.acknowledgesPriorAttemptId } : {}),
  };
}

/*
 * What the attempt ledger records, and what it does not.
 *
 *   accepted   YouTube answered the final upload request with a video resource carrying an id.
 *              The resource EXISTS. Processing, and whether anyone can see it, are separate facts
 *              read afterwards (`readYouTubeUploadedVideo`), never inferred from this.
 *   failed     YouTube refused before a resource could exist, or nothing was sent.
 *   unknown    The upload may or may not have completed (the answer was lost after bytes left).
 *              NEVER retried automatically: a retry can create a second video.
 */
export const YOUTUBE_PUBLISH_NON_CLAIMS: readonly string[] = Object.freeze([
  "an accepted upload means a video resource exists, not that processing finished",
  "an accepted upload does not mean the video is visible to anyone",
  "videos from an unverified Google API project are restricted to private by YouTube",
  "an unknown outcome is never retried automatically; it needs reconciliation",
]);
