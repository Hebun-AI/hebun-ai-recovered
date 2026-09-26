/*
 * media-assets/derive-publish-jpeg.server.ts — the deterministic JPEG publish derivative (PUBLISH-0).
 *
 * Instagram's content publishing API accepts JPEG only; Hebun's generated images are usually PNG.
 * This module is the ONE place a publishable JPEG is produced, and it lives inside the Media Asset
 * authority on purpose: a derivative is a Media Asset — verified bytes, immutable identity, storage
 * key under its own id — not a second store and not a second authority.
 *
 *   authoritative original asset  →  deterministic JPEG derivative  →  governed Instagram execution
 *
 * MEDIA-SUPPLIED: the original may be GENERATED (a model made it) or SUPPLIED (a human chose it from
 * Drive). Both are admitted, verified originals of this authority. A supplied JPEG is STILL derived:
 * `jpeg-publish-v1` also strips EXIF/ICC/XMP (a camera photo's GPS and serial number must not reach
 * Meta) and fixes the encoding, and the governed chain binds the derivative's digest, never the
 * original's. "Already JPEG" is not a reason to skip the lineage or the integrity checks.
 *
 * ── WHAT THE TRANSFORM IS, EXACTLY (`jpeg-publish-v1`) ───────────────────────
 *
 *   1. the original row must be THIS tenant's, an ORIGINAL — generated or supplied, never itself
 *      derived — and `admitted`
 *   2. its stored bytes are read and verified against the row's SHA-256 AND size — never trusted
 *   3. alpha is flattened onto white; no resize, no rotate: dimensions are preserved
 *   4. fixed JPEG settings (below); sharp writes NO metadata unless asked, so EXIF/ICC/XMP are gone
 *   5. the output is re-identified from its own magic bytes: JPEG, same width and height
 *   6. written through the existing storage port, then verified AS STORED
 *   7. the provenance row: invocation NULL, `derived_from_asset_id` = original, `derivation`
 *
 * ── DETERMINISTIC, AND THEREFORE IDEMPOTENT ─────────────────────────────────
 *
 * The derivative's id is derived from (tenant, original, derivation), so its storage key is too.
 * With the pinned sharp/libvips the bytes are a pure function of the original's bytes. A retry after
 * a crash between `put` and the row, or a concurrent second caller, therefore meets an object that
 * already exists under that key: it is accepted ONLY if its size and SHA-256 are exactly the bytes
 * this call computed. `media_assets_derivation_uq` keeps one row per source + derivation.
 *
 * ── WHAT DERIVATION DOES NOT DO ─────────────────────────────────────────────
 *
 * It authorizes nothing. It reads no permit, writes no action request, reaches no provider and
 * mints no read grant. A derivative is not creative work: every gallery / composer / review read
 * joins through the invocation and never sees it. Publishing it still requires proposal → human
 * approval → permit → execution.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  JPEG_PUBLISH_DERIVATION,
  MEDIA_ASSET_LIMITS,
  MEDIA_ASSET_MIME_TYPES,
  isUuid,
  mediaAssetStorageKey,
  type MediaAssetMimeType,
} from "./contracts";
import { readImageSignature } from "./image-signature";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaDbOrNull } from "./media-db.server";
import { resolveMediaObjectStore } from "./media-storage.server";

export { JPEG_PUBLISH_DERIVATION };

/**
 * The fixed encoder settings of `jpeg-publish-v1`. Changing ANY of them is a new derivation name,
 * never an edit: an existing derivative's bytes must stay reproducible from its name.
 */
export const JPEG_PUBLISH_SETTINGS = Object.freeze({
  background: "#ffffff",
  quality: 90,
  chromaSubsampling: "4:4:4",
  progressive: false,
  mozjpeg: false,
  optimiseCoding: true,
});

export interface PublishDerivative {
  readonly assetId: string;
  readonly derivedFromAssetId: string;
  readonly derivation: typeof JPEG_PUBLISH_DERIVATION;
  readonly mimeType: "image/jpeg";
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
}

export type DerivePublishJpegRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "persistence-unavailable"
  | "source-not-found"
  | "source-not-original"
  /** MV-2 — the source is not an image. A video never enters `jpeg-publish-v1`. */
  | "source-not-image"
  | "source-retired"
  | "source-object-absent"
  | "source-integrity-mismatch"
  | "conversion-failed"
  | "derivative-retired"
  | "derivative-integrity-mismatch"
  | "storage-write-failed";

export type DerivePublishJpegResult =
  | { readonly status: "derived" | "existing"; readonly derivative: PublishDerivative }
  | { readonly status: "refused"; readonly reason: DerivePublishJpegRefusal };

export interface DerivePublishJpegDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly now?: () => Date;
}

const refused = (reason: DerivePublishJpegRefusal): DerivePublishJpegResult => ({ status: "refused", reason });
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/**
 * The derivative's id: a name-based UUID (RFC 9562 version 8 layout) over the tenant, the original
 * and the derivation. The same inputs always name the same id — and so the same storage key.
 */
export function publishDerivativeId(tenantId: string, originalAssetId: string): string {
  const h = createHash("sha256")
    .update(`hebun-media-derivative\n${JPEG_PUBLISH_DERIVATION}\n${tenantId.toLowerCase()}\n${originalAssetId.toLowerCase()}`)
    .digest();
  h[6] = (h[6]! & 0x0f) | 0x80;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The pure transform. Exported so its determinism and its output can be tested without a store.
 * Throws on undecodable input; the caller maps that to `conversion-failed`.
 */
export async function convertToPublishJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const output = await sharp(bytes, {
    failOn: "error",
    limitInputPixels: MEDIA_ASSET_LIMITS.maxDimension * MEDIA_ASSET_LIMITS.maxDimension,
    /* Only the first frame/page is ever an Instagram feed image. */
    pages: 1,
  })
    .flatten({ background: JPEG_PUBLISH_SETTINGS.background })
    .jpeg({
      quality: JPEG_PUBLISH_SETTINGS.quality,
      chromaSubsampling: JPEG_PUBLISH_SETTINGS.chromaSubsampling,
      progressive: JPEG_PUBLISH_SETTINGS.progressive,
      mozjpeg: JPEG_PUBLISH_SETTINGS.mozjpeg,
      optimiseCoding: JPEG_PUBLISH_SETTINGS.optimiseCoding,
    })
    .toBuffer();
  return new Uint8Array(output);
}

type DerivedRow = {
  readonly id: string;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly lifecycle: string;
  readonly storageKey: string;
};

async function selectDerivative(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  originalAssetId: string,
): Promise<DerivedRow | null> {
  const rows = await db
    .select({
      id: mediaAssets.id,
      byteSize: mediaAssets.byteSize,
      byteDigest: mediaAssets.byteDigest,
      width: mediaAssets.width,
      height: mediaAssets.height,
      lifecycle: mediaAssets.assetLifecycleStatus,
      storageKey: mediaAssets.storageKey,
    })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.tenantId, tenantId),
        eq(mediaAssets.derivedFromAssetId, originalAssetId),
        eq(mediaAssets.derivation, JPEG_PUBLISH_DERIVATION),
        isNull(mediaAssets.invocationId),
        eq(mediaAssets.mimeType, "image/jpeg"),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function toDerivative(originalAssetId: string, row: DerivedRow): PublishDerivative {
  return {
    assetId: row.id,
    derivedFromAssetId: originalAssetId,
    derivation: JPEG_PUBLISH_DERIVATION,
    mimeType: "image/jpeg",
    byteSize: row.byteSize,
    byteDigest: row.byteDigest,
    width: row.width,
    height: row.height,
  };
}

/**
 * Produce — or find — the `jpeg-publish-v1` derivative of one original (generated or supplied) asset.
 *
 * An existing derivative is returned only after its stored object is verified against its row;
 * a retired one is refused rather than replaced (one derivative per source, ever).
 */
export async function derivePublishJpeg(
  tenant: TenantContext | null,
  input: { readonly originalAssetId: string } | null,
  deps: DerivePublishJpegDeps = {},
): Promise<DerivePublishJpegResult> {
  if (typeof window !== "undefined") throw new Error("Media derivation is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input || !isUuid(input.originalAssetId)) return refused("invalid-input");
  const tenantId = tenant.tenantId;
  const originalAssetId = input.originalAssetId.toLowerCase();

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return refused("storage-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  /* ── 1. THE ORIGINAL: this tenant's, generated or supplied (never derived), admitted. ── */
  let original;
  try {
    original = (
      await db
        .select({
          id: mediaAssets.id,
          invocationId: mediaAssets.invocationId,
          derivedFromAssetId: mediaAssets.derivedFromAssetId,
          suppliedSource: mediaAssets.suppliedSource,
          mediaKind: mediaAssets.mediaKind,
          mimeType: mediaAssets.mimeType,
          byteSize: mediaAssets.byteSize,
          byteDigest: mediaAssets.byteDigest,
          width: mediaAssets.width,
          height: mediaAssets.height,
          lifecycle: mediaAssets.assetLifecycleStatus,
          storageKey: mediaAssets.storageKey,
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, originalAssetId)))
        .limit(1)
    )[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!original) return refused("source-not-found");
  if (original.derivedFromAssetId !== null) return refused("source-not-original");
  if (original.invocationId === null && original.suppliedSource === null) return refused("source-not-original");
  if (original.mediaKind !== "image") return refused("source-not-image");
  if (original.lifecycle !== "admitted") return refused("source-retired");
  if (!MEDIA_ASSET_MIME_TYPES.includes(original.mimeType as MediaAssetMimeType)) return refused("source-integrity-mismatch");

  /* ── 2. AN EXISTING DERIVATIVE is returned only if its stored bytes are its row's. ── */
  let existing: DerivedRow | null;
  try {
    existing = await selectDerivative(db, tenantId, originalAssetId);
  } catch {
    return refused("persistence-unavailable");
  }
  if (existing) return verifyExisting(storage, originalAssetId, existing);

  /* ── 3. THE ORIGINAL'S BYTES, verified against the authoritative row. ── */
  let read;
  try {
    read = await storage.store.get({
      key: original.storageKey,
      contentType: original.mimeType as MediaAssetMimeType,
      maxBytes: MEDIA_ASSET_LIMITS.maxByteSize,
    });
  } catch {
    return refused("source-object-absent");
  }
  if (read.status !== "read") return refused("source-object-absent");
  if (read.bytes.byteLength !== original.byteSize || sha256(read.bytes) !== original.byteDigest) {
    return refused("source-integrity-mismatch");
  }

  /* ── 4. THE TRANSFORM, then re-identification from the output's own bytes. ── */
  let jpeg: Uint8Array;
  try {
    jpeg = await convertToPublishJpeg(read.bytes);
  } catch {
    return refused("conversion-failed");
  }
  const signature = readImageSignature(jpeg);
  if (
    signature.status !== "recognized" ||
    signature.mimeType !== "image/jpeg" ||
    signature.width !== original.width ||
    signature.height !== original.height ||
    jpeg.byteLength < 1 ||
    jpeg.byteLength > MEDIA_ASSET_LIMITS.maxByteSize
  ) {
    return refused("conversion-failed");
  }
  const byteDigest = sha256(jpeg);

  /* ── 5. WRITE-ONCE under the deterministic key; an existing object must be exactly these bytes. ── */
  const assetId = publishDerivativeId(tenantId, originalAssetId);
  const storageKey = mediaAssetStorageKey(tenantId, assetId);
  try {
    await storage.store.put({ key: storageKey, bytes: jpeg, contentType: "image/jpeg", sha256Hex: byteDigest });
  } catch {
    /* A prior crashed or concurrent attempt may already have written this exact object. */
  }
  let stored;
  try {
    stored = await storage.store.verify(storageKey);
  } catch {
    return refused("storage-write-failed");
  }
  if (stored.status !== "present") return refused("storage-write-failed");
  if (stored.byteSize !== jpeg.byteLength || stored.sha256Hex !== byteDigest) {
    return refused("derivative-integrity-mismatch");
  }

  /* ── 6. THE PROVENANCE ROW. A concurrent winner makes this a no-op, then it is re-read. ── */
  const admittedAt = (deps.now ?? (() => new Date()))();
  try {
    await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        tenantId,
        invocationId: null,
        derivedFromAssetId: originalAssetId,
        derivation: JPEG_PUBLISH_DERIVATION,
        mimeType: "image/jpeg",
        byteSize: jpeg.byteLength,
        byteDigest,
        width: signature.width,
        height: signature.height,
        storageBackend: storage.store.backend,
        storageKey,
        admittedAt,
      })
      .onConflictDoNothing();
    const row = await selectDerivative(db, tenantId, originalAssetId);
    if (!row) return refused("persistence-unavailable");
    if (row.id !== assetId || row.byteDigest !== byteDigest || row.byteSize !== jpeg.byteLength) {
      return refused("derivative-integrity-mismatch");
    }
    if (row.lifecycle !== "admitted") return refused("derivative-retired");
    return { status: "derived", derivative: toDerivative(originalAssetId, row) };
  } catch {
    return refused("persistence-unavailable");
  }
}

async function verifyExisting(
  storage: Extract<MediaStorageResolution, { status: "available" }>,
  originalAssetId: string,
  row: DerivedRow,
): Promise<DerivePublishJpegResult> {
  if (row.lifecycle !== "admitted") return refused("derivative-retired");
  let stored;
  try {
    stored = await storage.store.verify(row.storageKey);
  } catch {
    return refused("derivative-integrity-mismatch");
  }
  if (stored.status !== "present" || stored.byteSize !== row.byteSize || stored.sha256Hex !== row.byteDigest) {
    return refused("derivative-integrity-mismatch");
  }
  return { status: "existing", derivative: toDerivative(originalAssetId, row) };
}
