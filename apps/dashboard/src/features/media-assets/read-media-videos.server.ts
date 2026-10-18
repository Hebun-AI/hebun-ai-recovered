/*
 * media-assets/read-media-videos.server.ts — the VIDEO read model (MV-3).
 *
 * Kept out of `read-media-assets.server.ts` on purpose: that file is the image read model (gallery,
 * composer, review) and stays image-only per MV-2.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "./contracts";
import type { MediaReadAccess } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import type { MediaReadDeps } from "./media-asset-records.server";
import { toVideoRecord, videoColumns, type MediaVideoRecord } from "./media-video-records.server";

/** A video grant is sized for playback, within the store's own 300 s ceiling. */
export const MEDIA_VIDEO_READ_ACCESS_TTL_SECONDS = 300;

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

/* MV-3 / VIDEO CONTENT CHAIN — moved to the store-free video record module (SUITE-RECOVERY-1, RC-A); re-exported unchanged. */
export {
  listArtifactMediaVideos,
  type ArtifactMediaVideoListing,
  type MediaVideoRecord,
} from "./media-video-records.server";
