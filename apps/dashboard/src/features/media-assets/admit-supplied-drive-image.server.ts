/*
 * media-assets/admit-supplied-drive-image.server.ts — a human-supplied Drive image becomes an
 * admitted Media Asset (MEDIA-SUPPLIED).
 *
 * The third origin of the ONE Media authority, beside generated (MEDIA-1) and derived (PUBLISH-0).
 * Same verification, same storage port, same key shape, same lifecycle, same reads. No second store,
 * no second authority, no upload route: the only byte source is ONE file the human selected in the
 * Google Picker, read under the per-file capability `google.drive.file.content.read` (`drive.file`)
 * — the production-accepted least-privilege model. There is no capability input and no Drive-wide
 * fallback: the Drive-wide `drive.readonly` capability cannot reach this admission at all.
 *
 *     A DRIVE FILE IS NOT MEDIA.     Only bytes Hebun read, verified from themselves, wrote, and
 *                                    re-verified AS STORED become an asset — and the Drive file id is
 *                                    kept as where they came from, not as a pointer anything re-reads.
 *
 * ── PREFLIGHT — NOTHING IS READ FROM DRIVE UNTIL ALL OF THIS HOLDS ────────────
 *
 *   1. an authenticated human tenant context            unauthenticated
 *   2. well-formed input (uuid, revision, Drive id)     invalid-input
 *   3. storage is connected                             storage-unavailable
 *   4. the control-plane database is reachable          persistence-unavailable
 *   5. the target is THIS tenant's content-draft,
 *      still a draft, at exactly that revision          source-revision-unresolvable
 *
 * ── ADMISSION ─────────────────────────────────────────────────────────────────
 *
 *   6. ONE Drive image read for this tenant, under
 *      the per-file capability by name                  drive-capability-not-available
 *                                                       drive-read-failed (+ provider reason)
 *   7. verify from the bytes: size, magic bytes, Drive's
 *      declared type must AGREE, dimensions, SHA-256     the MEDIA-1 refusal codes
 *   8. the asset id is DERIVED from (tenant, revision, source, file id, digest), so a retry or a
 *      concurrent second caller names the same id and the same key
 *   9. write-once through the storage port, then verify AS STORED; an object already under that
 *      key is accepted only if it is exactly these bytes    storage-write-failed / integrity-mismatch
 *  10. the row: invocation NULL, derivation NULL, full supplied provenance — the database CHECK makes
 *      any partial provenance unrepresentable. A concurrent winner makes it a no-op, then it is
 *      re-read and must be these bytes.
 *
 * WHAT THIS MODULE NEVER WRITES: the draft, a Governance decision, a review, an action request, a
 * permit, an execution attempt, Knowledge, or a URL. Supplying is custody, not approval — and a
 * supplied image is not placed into the generated-image creative review.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { GOOGLE_DRIVE_FILE_CAPABILITY } from "@/features/provider-google/contracts";
import { readDriveImage, type DriveImageResult } from "@/features/provider-google/read-drive-image.server";
import { verifyAdmissibleImage } from "./admission-verification";
import {
  isUuid,
  mediaAssetStorageKey,
  type MediaAdmissionRefusal,
  type MediaAssetMimeType,
} from "./contracts";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaDbOrNull } from "./media-db.server";
import { resolveMediaObjectStore } from "./media-storage.server";

export const SUPPLIED_MEDIA_SOURCE = "google-drive" as const;

export interface AdmitSuppliedDriveImageInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  /** The file id the Google Picker returned for the human's selection. */
  readonly driveFileId: string;
}

export type AdmitSuppliedDriveImageRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "persistence-unavailable"
  | "source-revision-unresolvable"
  | "drive-capability-not-available"
  | "drive-read-failed"
  | MediaAdmissionRefusal
  | "storage-write-failed"
  | "integrity-mismatch"
  | "asset-retired";

export interface SuppliedMediaAsset {
  readonly assetId: string;
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly suppliedSource: typeof SUPPLIED_MEDIA_SOURCE;
  readonly suppliedSourceFileId: string;
  readonly suppliedSourceCapability: typeof GOOGLE_DRIVE_FILE_CAPABILITY;
}

export type AdmitSuppliedDriveImageResult =
  | { readonly status: "admitted" | "existing"; readonly asset: SuppliedMediaAsset }
  | { readonly status: "refused"; readonly reason: AdmitSuppliedDriveImageRefusal; readonly detail?: string };

export interface AdmitSuppliedDriveImageDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly now?: () => Date;
  /** The Drive read. Injected in tests; production uses the tenant-gated seam. */
  readonly readImage?: (
    tenant: TenantContext,
    input: { readonly fileId: string },
  ) => Promise<DriveImageResult>;
}

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{1,256}$/;

const refused = (reason: AdmitSuppliedDriveImageRefusal, detail?: string): AdmitSuppliedDriveImageResult => ({
  status: "refused",
  reason,
  ...(detail ? { detail } : {}),
});

/**
 * The supplied asset's id: a name-based UUID (RFC 9562 version 8 layout) over exactly the facts the
 * idempotency index covers. Same supply, same id, same storage key.
 */
export function suppliedAssetId(
  tenantId: string,
  artifactId: string,
  revisionNo: number,
  driveFileId: string,
  byteDigest: string,
): string {
  const h = createHash("sha256")
    .update(
      `hebun-media-supplied\n${SUPPLIED_MEDIA_SOURCE}\n${tenantId.toLowerCase()}\n${artifactId.toLowerCase()}\n${revisionNo}\n${driveFileId}\n${byteDigest}`,
    )
    .digest();
  h[6] = (h[6]! & 0x0f) | 0x80;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function admitSuppliedDriveImage(
  tenant: TenantContext | null,
  input: AdmitSuppliedDriveImageInput | null,
  deps: AdmitSuppliedDriveImageDeps = {},
): Promise<AdmitSuppliedDriveImageResult> {
  if (typeof window !== "undefined") throw new Error("Media admission is server-only.");

  /* ── 1–2. WHO, AND WHAT ── */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (
    !input ||
    !isUuid(input.artifactId) ||
    !Number.isSafeInteger(input.revisionNo) ||
    input.revisionNo < 1 ||
    typeof input.driveFileId !== "string" ||
    !DRIVE_FILE_ID.test(input.driveFileId)
  ) {
    return refused("invalid-input");
  }
  const tenantId = tenant.tenantId;
  const artifactId = input.artifactId.toLowerCase();
  const revisionNo = input.revisionNo;
  const driveFileId = input.driveFileId;

  /* ── 3–4. WHERE IT WOULD BE KEPT ── */
  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return refused("storage-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  /* ── 5. WHAT IT IS FOR — this tenant's content draft, at exactly that revision. ── */
  let target: { readonly revisionNo: number } | undefined;
  try {
    target = (
      await db
        .select({ revisionNo: workArtifactRevisions.revisionNo })
        .from(workArtifactRevisions)
        .innerJoin(
          workArtifacts,
          and(
            eq(workArtifacts.id, workArtifactRevisions.artifactId),
            eq(workArtifacts.tenantId, workArtifactRevisions.tenantId),
          ),
        )
        .where(
          and(
            eq(workArtifactRevisions.tenantId, tenantId),
            eq(workArtifactRevisions.artifactId, artifactId),
            eq(workArtifactRevisions.revisionNo, revisionNo),
            eq(workArtifacts.artifactType, "content-draft"),
            eq(workArtifacts.artifactLifecycleStatus, "draft"),
          ),
        )
        .limit(1)
    )[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!target) return refused("source-revision-unresolvable");

  /* ── 6. ONE DRIVE READ, for this tenant, under a released capability. ── */
  let read: DriveImageResult;
  try {
    read = await (deps.readImage ?? ((t, i) => readDriveImage(t, i, { getDb: () => db })))(tenant, {
      fileId: driveFileId,
    });
  } catch {
    return refused("drive-read-failed", "google-unreachable");
  }
  if (read.status === "refused") {
    return read.reason === "capability-not-available" || read.reason === "integration-not-found"
      ? refused("drive-capability-not-available", read.reason)
      : refused("drive-read-failed", read.reason);
  }
  if (read.status === "provider-failed") return refused("drive-read-failed", read.reason);
  if (read.image.fileId !== driveFileId) return refused("drive-read-failed", "google-file-id-mismatch");
  /* Provenance names the capability the read ACTUALLY ran under — and only the per-file one is accepted. */
  if (read.capability !== GOOGLE_DRIVE_FILE_CAPABILITY) return refused("drive-read-failed", "unexpected-capability");
  const capability = GOOGLE_DRIVE_FILE_CAPABILITY;
  const bytes = read.image.bytes;

  /* ── 7. EVERY FACT FROM THE BYTES. Drive's type is a claim that must agree, never a source. ── */
  const verified = verifyAdmissibleImage(bytes, read.image.providerMimeType);
  if (verified.status !== "verified") return refused(verified.reason);
  const image = verified.image;

  /* ── 8–9. WRITE-ONCE under the derived key; verify AS STORED. ── */
  const assetId = suppliedAssetId(tenantId, artifactId, revisionNo, driveFileId, image.byteDigest);
  const storageKey = mediaAssetStorageKey(tenantId, assetId);
  try {
    await storage.store.put({ key: storageKey, bytes, contentType: image.mimeType, sha256Hex: image.byteDigest });
  } catch {
    /* A prior crashed or concurrent attempt may already hold this exact object; verify decides. */
  }
  let stored;
  try {
    stored = await storage.store.verify(storageKey);
  } catch {
    return refused("storage-write-failed");
  }
  if (stored.status !== "present") return refused("storage-write-failed");
  if (stored.byteSize !== image.byteSize || stored.sha256Hex !== image.byteDigest) {
    return refused("integrity-mismatch");
  }

  /* ── 10. THE PROVENANCE ROW. ── */
  const admittedAt = (deps.now ?? (() => new Date()))();
  try {
    const inserted = await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        tenantId,
        invocationId: null,
        derivedFromAssetId: null,
        derivation: null,
        suppliedByActorType: "human",
        suppliedByActorId: tenant.userId,
        suppliedSource: SUPPLIED_MEDIA_SOURCE,
        suppliedSourceFileId: driveFileId,
        suppliedSourceCapability: capability,
        suppliedArtifactId: artifactId,
        suppliedRevisionNo: revisionNo,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        byteDigest: image.byteDigest,
        width: image.width,
        height: image.height,
        storageBackend: storage.store.backend,
        storageKey,
        admittedAt,
      })
      .onConflictDoNothing()
      .returning({ id: mediaAssets.id });

    const row = (
      await db
        .select({
          id: mediaAssets.id,
          byteSize: mediaAssets.byteSize,
          byteDigest: mediaAssets.byteDigest,
          mimeType: mediaAssets.mimeType,
          lifecycle: mediaAssets.assetLifecycleStatus,
          suppliedArtifactId: mediaAssets.suppliedArtifactId,
          suppliedRevisionNo: mediaAssets.suppliedRevisionNo,
          suppliedSourceFileId: mediaAssets.suppliedSourceFileId,
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
        .limit(1)
    )[0];
    if (!row) return refused("persistence-unavailable");
    if (
      row.byteDigest !== image.byteDigest ||
      row.byteSize !== image.byteSize ||
      row.suppliedArtifactId !== artifactId ||
      row.suppliedRevisionNo !== revisionNo ||
      row.suppliedSourceFileId !== driveFileId
    ) {
      return refused("integrity-mismatch");
    }
    if (row.lifecycle !== "admitted") return refused("asset-retired");
    return {
      status: inserted.length === 1 ? "admitted" : "existing",
      asset: {
        assetId,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        byteDigest: image.byteDigest,
        width: image.width,
        height: image.height,
        sourceArtifactId: artifactId,
        sourceRevisionNo: revisionNo,
        suppliedSource: SUPPLIED_MEDIA_SOURCE,
        suppliedSourceFileId: driveFileId,
        suppliedSourceCapability: capability,
      },
    };
  } catch {
    return refused("persistence-unavailable");
  }
}
