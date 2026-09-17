/*
 * media-assets/read-media-assets.server.ts — tenant-controlled reads of admitted images (MEDIA-1).
 *
 * THE ORDER, AND WHY IT IS THIS ORDER:
 *
 *   1. authenticated tenant               otherwise `unauthenticated`
 *   2. storage connected                  otherwise `unavailable` — BEFORE the row is looked up, so an
 *                                         unconnected deployment answers the same thing for every id
 *                                         and can never say "not found" or return an empty success
 *   3. database reachable                 otherwise `unavailable`
 *   4. the row, predicated on tenant      otherwise `not-found` — another tenant's asset and an asset
 *                                         that never existed are one indistinguishable answer
 *   5. the stored object verified         size AND SHA-256 as stored must equal the row; otherwise
 *                                         `unavailable` with `integrity-mismatch` / `object-absent`.
 *                                         A read is never granted on bytes that are not the admitted ones.
 *   6. a short-lived read grant           created per call, never persisted, never logged
 *
 * A retired asset remains readable — retirement keeps the bytes and the history — and says so.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid, type MediaAssetLifecycleStatus, type MediaAssetMimeType } from "./contracts";
import {
  MEDIA_READ_ACCESS_TTL_SECONDS,
  type MediaReadAccess,
  type MediaStorageResolution,
} from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { resolveMediaDbOrNull } from "./media-db.server";

export interface MediaReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
}

export interface MediaAssetRecord {
  readonly assetId: string;
  readonly invocationId: string;
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly admittedAt: string;
  readonly lifecycle: MediaAssetLifecycleStatus;
  /** Provenance, read by join from the invocation — never copied onto the asset. */
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly agentId: string;
  readonly requestedByActorId: string;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
  readonly providerJobId: string | null;
  readonly inputDigest: string;
}

export type ReadMediaAssetResult =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      readonly reason: "storage-unavailable" | "persistence-unavailable" | "object-absent" | "integrity-mismatch";
    }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly asset: MediaAssetRecord; readonly access: MediaReadAccess };

/** The row plus its provenance, tenant-predicated on BOTH tables. Internal to this authority. */
export async function selectMediaAssetRecord(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<(MediaAssetRecord & { readonly storageKey: string }) | null> {
  const rows = await db
    .select({
      assetId: mediaAssets.id,
      invocationId: mediaAssets.invocationId,
      mimeType: mediaAssets.mimeType,
      byteSize: mediaAssets.byteSize,
      byteDigest: mediaAssets.byteDigest,
      width: mediaAssets.width,
      height: mediaAssets.height,
      admittedAt: mediaAssets.admittedAt,
      lifecycle: mediaAssets.assetLifecycleStatus,
      storageKey: mediaAssets.storageKey,
      sourceArtifactId: mediaGenerationInvocations.sourceArtifactId,
      sourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
      agentId: mediaGenerationInvocations.agentId,
      requestedByActorId: mediaGenerationInvocations.requestedByActorId,
      transport: mediaGenerationInvocations.transport,
      provider: mediaGenerationInvocations.provider,
      model: mediaGenerationInvocations.model,
      providerJobId: mediaGenerationInvocations.providerJobId,
      inputDigest: mediaGenerationInvocations.inputDigest,
    })
    .from(mediaAssets)
    .innerJoin(
      mediaGenerationInvocations,
      and(
        eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
        eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
      ),
    )
    .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    mimeType: row.mimeType as MediaAssetMimeType,
    lifecycle: row.lifecycle as MediaAssetLifecycleStatus,
    admittedAt: new Date(row.admittedAt).toISOString(),
  };
}

export async function readMediaAsset(
  tenant: TenantContext | null,
  assetId: string,
  deps: MediaReadDeps = {},
): Promise<ReadMediaAssetResult> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return { status: "unavailable", reason: "storage-unavailable" };

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!isUuid(assetId)) return { status: "not-found" };

  let record;
  try {
    record = await selectMediaAssetRecord(db, tenant.tenantId, assetId);
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
  if (stored.byteSize !== record.byteSize || stored.sha256Hex !== record.byteDigest) {
    return { status: "unavailable", reason: "integrity-mismatch" };
  }

  const access = await storage.store.createReadAccess({
    key: record.storageKey,
    contentType: record.mimeType,
    ttlSeconds: MEDIA_READ_ACCESS_TTL_SECONDS,
  });
  const { storageKey: _storageKey, ...asset } = record;
  void _storageKey;
  return { status: "read", asset, access };
}
