/*
 * media-assets/read-media-videos.server.ts — the VIDEO read model (MV-3).
 *
 * Kept out of `read-media-assets.server.ts` on purpose: that file is the image read model (gallery,
 * composer, review) and stays image-only per MV-2.
 *
 * Server-only.
 */
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid, type MediaAssetLifecycleStatus } from "./contracts";
import type { MediaReadAccess } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import type { MediaReadDeps } from "./read-media-assets.server";

/*
 * ── MV-3: THE VIDEO READ MODEL ───────────────────────────────────────────────
 *
 * Separate from the image records above on purpose: those are the gallery/composer/review model and
 * stay image-only (MV-2). A video is recognised by `media_kind = 'video'` on its row — never by MIME,
 * file name, provider or credential. MV-3 admitted SUPPLIED videos; MV-7 adds GENERATED ones, whose
 * provenance is their invocation (`invocation_id`) and whose draft revision is that invocation's. A
 * derived video (MV-5) is not a record of this model.
 *
 * Playback is the released signed read: the store re-verifies size and SHA-256 against the row, then
 * a short-lived read grant for `video/mp4` is minted. The browser's `<video>` element fetches it with
 * single `Range` requests (206) — the MV-1 read contract, unchanged.
 */
export interface MediaVideoRecord {
  readonly assetId: string;
  readonly mediaKind: "video";
  readonly origin: "supplied" | "generated";
  readonly mimeType: "video/mp4";
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly container: string;
  readonly durationMs: number;
  readonly videoCodec: string;
  readonly audioCodec: string | null;
  readonly frameRate: string;
  readonly admittedAt: string;
  readonly lifecycle: MediaAssetLifecycleStatus;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  /** Supplied only; null for a generated video. */
  readonly suppliedByActorId: string | null;
  readonly suppliedSourceFileId: string | null;
  /** Generated only (MV-7): the attempt that produced these bytes; null for a supplied video. */
  readonly invocationId: string | null;
}

/** A video grant is sized for playback, within the store's own 300 s ceiling. */
export const MEDIA_VIDEO_READ_ACCESS_TTL_SECONDS = 300;

const videoColumns = {
  assetId: mediaAssets.id,
  mediaKind: mediaAssets.mediaKind,
  mimeType: mediaAssets.mimeType,
  byteSize: mediaAssets.byteSize,
  byteDigest: mediaAssets.byteDigest,
  width: mediaAssets.width,
  height: mediaAssets.height,
  container: mediaAssets.videoContainer,
  durationMs: mediaAssets.videoDurationMs,
  videoCodec: mediaAssets.videoCodec,
  audioCodec: mediaAssets.audioCodec,
  frameRate: mediaAssets.videoFrameRate,
  admittedAt: mediaAssets.admittedAt,
  lifecycle: mediaAssets.assetLifecycleStatus,
  storageKey: mediaAssets.storageKey,
  invocationId: mediaAssets.invocationId,
  derivedFromAssetId: mediaAssets.derivedFromAssetId,
  suppliedArtifactId: mediaAssets.suppliedArtifactId,
  suppliedRevisionNo: mediaAssets.suppliedRevisionNo,
  suppliedByActorId: mediaAssets.suppliedByActorId,
  suppliedSourceFileId: mediaAssets.suppliedSourceFileId,
  /* MV-7: a generated video's draft revision is its invocation's (left join; null for supplied). */
  generatedArtifactId: mediaGenerationInvocations.sourceArtifactId,
  generatedRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
  generatedOutputKind: mediaGenerationInvocations.outputMediaKind,
};

type VideoRow = { [K in keyof typeof videoColumns]: unknown };

function toVideoRecord(r: VideoRow): (MediaVideoRecord & { readonly storageKey: string }) | null {
  const supplied =
    r.invocationId === null &&
    typeof r.suppliedArtifactId === "string" &&
    typeof r.suppliedRevisionNo === "number" &&
    typeof r.suppliedByActorId === "string" &&
    typeof r.suppliedSourceFileId === "string";
  const generated =
    typeof r.invocationId === "string" &&
    r.suppliedArtifactId === null &&
    r.generatedOutputKind === "video" &&
    typeof r.generatedArtifactId === "string" &&
    typeof r.generatedRevisionNo === "number";
  if (
    r.mediaKind !== "video" ||
    r.mimeType !== "video/mp4" ||
    r.derivedFromAssetId !== null ||
    (!supplied && !generated) ||
    typeof r.container !== "string" ||
    typeof r.durationMs !== "number" ||
    typeof r.videoCodec !== "string" ||
    typeof r.frameRate !== "string"
  ) {
    return null;
  }
  return {
    assetId: r.assetId as string,
    mediaKind: "video",
    origin: supplied ? "supplied" : "generated",
    mimeType: "video/mp4",
    byteSize: r.byteSize as number,
    byteDigest: r.byteDigest as string,
    width: r.width as number,
    height: r.height as number,
    container: r.container,
    durationMs: r.durationMs,
    videoCodec: r.videoCodec,
    audioCodec: (r.audioCodec as string | null) ?? null,
    frameRate: r.frameRate,
    admittedAt: new Date(r.admittedAt as Date | string).toISOString(),
    lifecycle: r.lifecycle as MediaAssetLifecycleStatus,
    sourceArtifactId: (supplied ? r.suppliedArtifactId : r.generatedArtifactId) as string,
    sourceRevisionNo: (supplied ? r.suppliedRevisionNo : r.generatedRevisionNo) as number,
    suppliedByActorId: supplied ? (r.suppliedByActorId as string) : null,
    suppliedSourceFileId: supplied ? (r.suppliedSourceFileId as string) : null,
    invocationId: supplied ? null : (r.invocationId as string),
    storageKey: r.storageKey as string,
  };
}

export type RevisionMediaVideoListing =
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "read"; readonly videos: readonly MediaVideoRecord[] };

/**
 * Every admitted video SUPPLIED for one exact draft revision. A database read; no access granted.
 * Generated videos (MV-7) are opened by id through `readMediaVideo`; this listing is unchanged.
 */
export async function listRevisionMediaVideos(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionNo: number } | null,
  deps: MediaReadDeps = {},
): Promise<RevisionMediaVideoListing> {
  if (typeof window !== "undefined") throw new Error("Media asset reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!input || !isUuid(input.artifactId) || !Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) {
    return { status: "read", videos: [] };
  }
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const tenantId = tenant.tenantId;
  try {
    const rows = await db
      .select(videoColumns)
      .from(mediaAssets)
      .leftJoin(
        mediaGenerationInvocations,
        and(eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId), eq(mediaGenerationInvocations.id, mediaAssets.invocationId)),
      )
      .where(
        and(
          eq(mediaAssets.tenantId, tenantId),
          eq(mediaAssets.mediaKind, "video"),
          eq(mediaAssets.suppliedArtifactId, input.artifactId),
          eq(mediaAssets.suppliedRevisionNo, input.revisionNo),
        ),
      )
      .orderBy(mediaAssets.admittedAt, mediaAssets.id);
    const videos: MediaVideoRecord[] = [];
    for (const row of rows) {
      const v = toVideoRecord(row);
      if (v) {
        const { storageKey: _k, ...rest } = v;
        void _k;
        videos.push(rest);
      }
    }
    return { status: "read", videos };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

export type ArtifactMediaVideoListing =
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "read"; readonly videos: readonly MediaVideoRecord[] };

/**
 * VIDEO CONTENT CHAIN — every admitted video of several drafts, SUPPLIED or GENERATED, across all of
 * their revisions, in one read. Each record names the revision it came from (`sourceRevisionNo`):
 * a supplied video's own revision FK, a generated video's invocation's source revision. It decides
 * nothing about which revision is current and carries nothing forward. A derived video is not a
 * record. A database read: no store, no bytes, no access.
 */
export async function listArtifactMediaVideos(
  tenant: TenantContext | null,
  input: { readonly artifactIds: readonly string[] } | null,
  deps: MediaReadDeps = {},
): Promise<ArtifactMediaVideoListing> {
  if (typeof window !== "undefined") throw new Error("Media asset reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };
  const ids = (input?.artifactIds ?? []).filter(isUuid);
  if (ids.length === 0) return { status: "read", videos: [] };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  try {
    const rows = await db
      .select(videoColumns)
      .from(mediaAssets)
      .leftJoin(
        mediaGenerationInvocations,
        and(eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId), eq(mediaGenerationInvocations.id, mediaAssets.invocationId)),
      )
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          eq(mediaAssets.mediaKind, "video"),
          isNull(mediaAssets.derivedFromAssetId),
          or(
            and(isNull(mediaAssets.invocationId), inArray(mediaAssets.suppliedArtifactId, ids)),
            and(
              isNotNull(mediaAssets.invocationId),
              eq(mediaGenerationInvocations.outputMediaKind, "video"),
              inArray(mediaGenerationInvocations.sourceArtifactId, ids),
            ),
          ),
        ),
      )
      .orderBy(mediaAssets.admittedAt, mediaAssets.id);
    const videos: MediaVideoRecord[] = [];
    for (const row of rows) {
      const v = toVideoRecord(row);
      if (v) {
        const { storageKey: _k, ...rest } = v;
        void _k;
        videos.push(rest);
      }
    }
    return { status: "read", videos };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

export type ReadMediaVideoResult =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      readonly reason: "storage-unavailable" | "persistence-unavailable" | "object-absent" | "integrity-mismatch";
    }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly video: MediaVideoRecord; readonly access: MediaReadAccess };

/** One video for playback: its row, its bytes re-verified as stored, then a short-lived read grant. */
export async function readMediaVideo(
  tenant: TenantContext | null,
  assetId: string,
  deps: MediaReadDeps = {},
): Promise<ReadMediaVideoResult> {
  if (typeof window !== "undefined") throw new Error("Media asset reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status === "unavailable") return { status: "unavailable", reason: "storage-unavailable" };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!isUuid(assetId)) return { status: "not-found" };
  const tenantId = tenant.tenantId;

  let record;
  try {
    const rows = await db
      .select(videoColumns)
      .from(mediaAssets)
      .leftJoin(
        mediaGenerationInvocations,
        and(eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId), eq(mediaGenerationInvocations.id, mediaAssets.invocationId)),
      )
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
      .limit(1);
    record = rows[0] ? toVideoRecord(rows[0]) : null;
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
  if (!record) return { status: "not-found" };

  let stored;
  try {
    stored = await storage.store.verify(record.storageKey);
  } catch {
    return { status: "unavailable", reason: "object-absent" };
  }
  if (stored.status !== "present") return { status: "unavailable", reason: "object-absent" };
  if (stored.sha256Hex !== record.byteDigest || stored.byteSize !== record.byteSize) {
    return { status: "unavailable", reason: "integrity-mismatch" };
  }
  const access = await storage.store.createReadAccess({
    key: record.storageKey,
    contentType: record.mimeType,
    ttlSeconds: MEDIA_VIDEO_READ_ACCESS_TTL_SECONDS,
  });
  const { storageKey: _k, ...video } = record;
  void _k;
  return { status: "read", video, access };
}
