/*
 * media-assets/read-verified-video.server.ts — YOUTUBE-WRITE-2: ONE admitted video's bytes, verified
 * against its own row, for the governed YouTube upload.
 *
 * The video counterpart of `readVerifiedSourceImage`, inside the same Media Asset authority: the row
 * decides (this tenant, a video, admitted, `video/mp4`), the store only supplies bytes, and the bytes
 * are accepted only when their length AND sha256 equal the row's. The caller additionally compares
 * the digest with the one a human authorized. Bounded by the Media authority's own asset ceiling
 * (`MEDIA_ASSET_LIMITS.maxByteSize`), which every admitted video already satisfies.
 *
 * It returns bytes to a server caller and nothing to a client: no storage key, no read grant.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import { MEDIA_ASSET_LIMITS, isUuid } from "./contracts";
import type { MediaStorageResolution } from "./media-object-store";

export type VerifiedVideoRefusal =
  | "video-asset-unresolvable"
  | "video-asset-not-video"
  | "video-asset-retired"
  | "video-asset-unavailable"
  | "storage-unavailable"
  | "persistence-unavailable";

export type VerifiedVideoResult =
  | {
      readonly status: "verified";
      readonly video: {
        readonly assetId: string;
        readonly mimeType: "video/mp4";
        readonly byteSize: number;
        readonly byteDigest: string;
        readonly bytes: Uint8Array;
      };
    }
  | { readonly status: "refused"; readonly reason: VerifiedVideoRefusal };

/**
 * The Media row's own facts about one asset, tenant-predicated, or `null`. Any origin — generated,
 * supplied or derived — because which video a package carries is the Content Package's decision,
 * not this reader's. Used for binding checks; bytes come only through `readVerifiedVideo`.
 */
export async function selectVideoAssetRow(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<{ readonly mediaKind: string; readonly mimeType: string; readonly lifecycle: string; readonly byteDigest: string; readonly byteSize: number } | null> {
  if (!isUuid(assetId)) return null;
  const rows = await db
    .select({
      mediaKind: mediaAssets.mediaKind,
      mimeType: mediaAssets.mimeType,
      lifecycle: mediaAssets.assetLifecycleStatus,
      byteDigest: mediaAssets.byteDigest,
      byteSize: mediaAssets.byteSize,
    })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function readVerifiedVideo(
  db: Pick<ControlPlaneDatabase, "select">,
  storage: MediaStorageResolution,
  tenantId: string,
  assetId: string,
): Promise<VerifiedVideoResult> {
  if (typeof window !== "undefined") throw new Error("Media video reads are server-only.");
  if (!isUuid(assetId)) return { status: "refused", reason: "video-asset-unresolvable" };

  let row;
  try {
    const rows = await db
      .select({
        byteDigest: mediaAssets.byteDigest,
        byteSize: mediaAssets.byteSize,
        mimeType: mediaAssets.mimeType,
        mediaKind: mediaAssets.mediaKind,
        lifecycle: mediaAssets.assetLifecycleStatus,
        storageKey: mediaAssets.storageKey,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
      .limit(1);
    row = rows[0];
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (!row) return { status: "refused", reason: "video-asset-unresolvable" };
  if (row.mediaKind !== "video" || row.mimeType !== "video/mp4") return { status: "refused", reason: "video-asset-not-video" };
  if (row.lifecycle !== "admitted") return { status: "refused", reason: "video-asset-retired" };
  if (storage.status !== "available") return { status: "refused", reason: "storage-unavailable" };

  let read;
  try {
    read = await storage.store.get({ key: row.storageKey, contentType: "video/mp4", maxBytes: MEDIA_ASSET_LIMITS.maxByteSize });
  } catch {
    return { status: "refused", reason: "video-asset-unavailable" };
  }
  if (read.status !== "read") return { status: "refused", reason: "video-asset-unavailable" };

  const digest = createHash("sha256").update(read.bytes).digest("hex");
  if (read.bytes.byteLength !== row.byteSize || digest !== row.byteDigest) {
    return { status: "refused", reason: "video-asset-unavailable" };
  }
  return {
    status: "verified",
    video: { assetId: assetId.toLowerCase(), mimeType: "video/mp4", byteSize: row.byteSize, byteDigest: row.byteDigest, bytes: read.bytes },
  };
}
