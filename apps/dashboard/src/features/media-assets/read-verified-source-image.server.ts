/*
 * media-assets/read-verified-source-image.server.ts — one admitted IMAGE, read and verified as the
 * source of a generation (IMAGE → VIDEO).
 *
 * THE SAME ELIGIBILITY AS MEDIA-5's reference edit (`request-media-generation.server.ts`, steps
 * 7b–7d), stated once more here because that module's order of operations is pinned by its own
 * firewall and is not refactored under it. `tests/image-to-video` proves the two refuse the same
 * cases. The rule, exactly:
 *
 *   the asset is THIS tenant's, by id           source-asset-unresolvable   (another tenant's = absent)
 *   its `media_kind` is `image`                 source-asset-not-image
 *   its custody lifecycle is `admitted`          source-asset-retired
 *   its MIME is one Media admits                 source-asset-unavailable
 *   its stored bytes are readable, and their
 *   size AND SHA-256 equal the row               source-asset-unavailable
 *
 * No Governance state is read: custody, and only custody, decides CUSTODY eligibility (the MEDIA-5
 * doctrine). No draft binding is required — MEDIA-5 requires none. A supplied image and a generated
 * image are both custody-eligible, as they are for a reference edit.
 *
 * CUSTODY IS NOT DATA-USE PERMISSION (DATA-USE-MEDIA-GUARD-1). Whether these bytes may be SENT to an
 * external generative provider is decided separately, per provider, purpose and lineage, by
 * `external-generative-eligibility.server.ts` — which the lifecycle consults before any upload.
 *
 * WHAT IT RETURNS, AND WHAT IT NEVER DOES. The verified bytes, their row's MIME, size and digest.
 * It mints no read grant, returns no URL or storage key, writes nothing, and reaches no provider.
 * The key is DERIVED from tenant and asset id by the function that minted it at admission; no
 * caller supplies it.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import {
  MEDIA_ASSET_LIMITS,
  MEDIA_ASSET_MIME_TYPES,
  isUuid,
  mediaAssetStorageKey,
  type MediaAssetMimeType,
} from "./contracts";
import type { MediaStorageResolution } from "./media-object-store";

export type VerifiedSourceImageRefusal =
  | "source-asset-unresolvable"
  | "source-asset-not-image"
  | "source-asset-retired"
  | "source-asset-unavailable"
  | "storage-unavailable"
  | "persistence-unavailable";

export interface VerifiedSourceImage {
  readonly assetId: string;
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly bytes: Uint8Array;
}

export type VerifiedSourceImageResult =
  | { readonly status: "verified"; readonly source: VerifiedSourceImage }
  | { readonly status: "refused"; readonly reason: VerifiedSourceImageRefusal };

/** The eligibility row only — used again at registration so the recorded source is the verified one. */
export async function selectEligibleSourceImageRow(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<
  | { readonly status: "eligible"; readonly mimeType: MediaAssetMimeType; readonly byteSize: number; readonly byteDigest: string }
  | { readonly status: "refused"; readonly reason: Exclude<VerifiedSourceImageRefusal, "storage-unavailable" | "persistence-unavailable"> }
> {
  const rows = await db
    .select({
      byteDigest: mediaAssets.byteDigest,
      byteSize: mediaAssets.byteSize,
      mimeType: mediaAssets.mimeType,
      lifecycle: mediaAssets.assetLifecycleStatus,
      mediaKind: mediaAssets.mediaKind,
    })
    .from(mediaAssets)
    /* Predicated on the tenant: another tenant's asset is indistinguishable from no asset. */
    .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return { status: "refused", reason: "source-asset-unresolvable" };
  if (asset.mediaKind !== "image") return { status: "refused", reason: "source-asset-not-image" };
  if (asset.lifecycle !== "admitted") return { status: "refused", reason: "source-asset-retired" };
  if (!MEDIA_ASSET_MIME_TYPES.includes(asset.mimeType as MediaAssetMimeType)) {
    return { status: "refused", reason: "source-asset-unavailable" };
  }
  return { status: "eligible", mimeType: asset.mimeType as MediaAssetMimeType, byteSize: asset.byteSize, byteDigest: asset.byteDigest };
}

export async function readVerifiedSourceImage(
  db: Pick<ControlPlaneDatabase, "select">,
  storage: MediaStorageResolution,
  tenantId: string,
  assetId: string,
): Promise<VerifiedSourceImageResult> {
  if (typeof window !== "undefined") throw new Error("Media source reads are server-only.");
  if (!isUuid(assetId)) return { status: "refused", reason: "source-asset-unresolvable" };

  let row;
  try {
    row = await selectEligibleSourceImageRow(db, tenantId, assetId);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
  if (row.status === "refused") return row;
  if (storage.status !== "available") return { status: "refused", reason: "storage-unavailable" };

  let read;
  try {
    read = await storage.store.get({
      key: mediaAssetStorageKey(tenantId, assetId),
      contentType: row.mimeType,
      maxBytes: MEDIA_ASSET_LIMITS.maxByteSize,
    });
  } catch {
    return { status: "refused", reason: "source-asset-unavailable" };
  }
  if (read.status !== "read") return { status: "refused", reason: "source-asset-unavailable" };

  /* Recomputed here and compared to the row. The store holds bytes; it never describes them. */
  const digest = createHash("sha256").update(read.bytes).digest("hex");
  if (read.bytes.byteLength !== row.byteSize || digest !== row.byteDigest) {
    return { status: "refused", reason: "source-asset-unavailable" };
  }
  return {
    status: "verified",
    source: { assetId: assetId.toLowerCase(), mimeType: row.mimeType, byteSize: row.byteSize, byteDigest: row.byteDigest, bytes: read.bytes },
  };
}
