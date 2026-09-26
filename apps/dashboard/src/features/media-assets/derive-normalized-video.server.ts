/*
 * media-assets/derive-normalized-video.server.ts — the normalized web video derivative (MV-5).
 *
 * The ONE place a `mp4-normalize-v1` derivative is admitted. Like the JPEG publish derivative it is a
 * Media Asset of this authority — verified bytes, immutable identity, its own key — with explicit
 * lineage to exactly one ORIGINAL video of the same tenant. The transform itself runs on the VPS
 * (DERIVE-V1: fixed ffmpeg argv, temp-first, write-once, probed); the VPS is execution
 * infrastructure and admits nothing. Every fact below is re-verified here before a row exists.
 *
 * ── THE CHAIN, AND WHERE EACH STEP CAN STOP ─────────────────────────────────
 *
 *   1. source row: THIS tenant's, a video/mp4, an ORIGINAL (supplied or generated, never derived),
 *      `admitted`                                               → refused, nothing called
 *   2. an existing (source, mp4-normalize-v1) derivative is REUSED after its stored object verifies
 *      — ffmpeg is not run again; `media_assets_derivation_uq` is the only idempotency authority
 *   3. the source's stored bytes equal its row (size + SHA-256)  → refused, nothing called
 *   4. DERIVE-V1 under a fresh key                               → failed, no bytes kept
 *   5. the result AS STORED is re-hashed by the store's verify and must equal DERIVE's answer
 *   6. its ISO-BMFF brand is read from the stored bytes
 *   7. MV-3 video policy over the stored result's probe + the profile checks below
 *   8. ONE insert of the derived row; a concurrent winner is returned instead
 *
 * A refusal at 5–7 leaves bytes under a key no row names. They are unreadable through this authority
 * (every read starts from a row) and are not deleted: there is no delete authority, by decision. The
 * result says so (`bytesOrphaned: true`). The source is never written — it is only read, by the store.
 *
 * DETERMINISM IS NOT RELIED ON. Two runs of ffmpeg may or may not produce identical bytes; nothing here
 * depends on it. The derivative's key is fresh per attempt; identity is the row.
 *
 * It authorizes nothing, reads no permit, reaches no provider, and makes the video eligible for no
 * image-only path (review, selection, JPEG derivation, publish lineage, reference edit all refuse a
 * video row by name — MV-2).
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { MEDIA_ASSET_LIMITS, MP4_NORMALIZE_DERIVATION, isUuid, mediaAssetStorageKey } from "./contracts";
import { evaluateVideoPolicy, mp4MajorBrand } from "./admit-supplied-drive-video.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaObjectStore, resolveMediaStorageV2, type MediaStorageV2Resolution } from "./media-storage.server";
import { VPS_MEDIA_STORE_BACKEND } from "./vps-media-object-store.server";
import { VpsDeriveRefused } from "./vps-media-storage-v2.server";

/** mp4-normalize-v1 bounds the application re-checks on the stored result. */
export const NORMALIZE_LIMITS = Object.freeze({
  maxDimension: 1920,
  /** |result − source| duration. AAC priming and frame alignment move it by tens of ms. */
  durationToleranceMs: 250,
  /** |result aspect − source aspect|, absolute. Even-rounding of small frames moves it slightly. */
  aspectTolerance: 0.02,
});

export type DeriveNormalizedVideoRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "persistence-unavailable"
  | "source-not-found"
  | "source-not-video"
  | "source-not-original"
  | "source-retired"
  | "source-unavailable"
  | "derivative-unavailable";

export type DeriveNormalizedVideoFailure =
  | "derive-failed"
  | "stored-bytes-mismatch"
  | "output-rejected"
  | "persistence-failed";

export interface NormalizedVideoDerivative {
  readonly assetId: string;
  readonly sourceAssetId: string;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly durationMs: number;
  readonly videoCodec: string;
  readonly audioCodec: string | null;
  readonly frameRate: string;
}

export type DeriveNormalizedVideoResult =
  | { readonly status: "derived" | "existing"; readonly derivative: NormalizedVideoDerivative }
  | { readonly status: "refused"; readonly reason: DeriveNormalizedVideoRefusal }
  | {
      readonly status: "failed";
      readonly reason: DeriveNormalizedVideoFailure;
      /** A closed code or policy detail — never a key, URL, path or secret. */
      readonly detail: string | null;
      /** True when bytes were kept under a key no row names (no delete authority exists). */
      readonly bytesOrphaned: boolean;
    };

export interface DeriveNormalizedVideoDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
  readonly resolveStorageV2?: () => MediaStorageV2Resolution;
  readonly now?: () => Date;
  readonly newAssetId?: () => string;
}

const refused = (reason: DeriveNormalizedVideoRefusal): DeriveNormalizedVideoResult => ({ status: "refused", reason });
const failed = (reason: DeriveNormalizedVideoFailure, detail: string | null, bytesOrphaned: boolean): DeriveNormalizedVideoResult => ({
  status: "failed",
  reason,
  detail,
  bytesOrphaned,
});

const derivativeColumns = {
  id: mediaAssets.id,
  byteSize: mediaAssets.byteSize,
  byteDigest: mediaAssets.byteDigest,
  width: mediaAssets.width,
  height: mediaAssets.height,
  durationMs: mediaAssets.videoDurationMs,
  videoCodec: mediaAssets.videoCodec,
  audioCodec: mediaAssets.audioCodec,
  frameRate: mediaAssets.videoFrameRate,
  lifecycle: mediaAssets.assetLifecycleStatus,
  storageKey: mediaAssets.storageKey,
};

async function selectDerivative(db: ControlPlaneDatabase, tenantId: string, sourceAssetId: string) {
  return (
    await db
      .select(derivativeColumns)
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.tenantId, tenantId),
          eq(mediaAssets.derivedFromAssetId, sourceAssetId),
          eq(mediaAssets.derivation, MP4_NORMALIZE_DERIVATION),
        ),
      )
      .limit(1)
  )[0];
}

function toDerivative(sourceAssetId: string, r: Awaited<ReturnType<typeof selectDerivative>>): NormalizedVideoDerivative {
  return {
    assetId: r!.id,
    sourceAssetId,
    byteSize: r!.byteSize,
    byteDigest: r!.byteDigest,
    width: r!.width,
    height: r!.height,
    durationMs: r!.durationMs!,
    videoCodec: r!.videoCodec!,
    audioCodec: r!.audioCodec,
    frameRate: r!.frameRate!,
  };
}

/** The profile, re-checked on the STORED result against the SOURCE row. Pure. */
export function checkNormalizedProfile(
  source: { readonly width: number; readonly height: number; readonly durationMs: number; readonly audioCodec: string | null },
  out: { readonly width: number; readonly height: number; readonly durationMs: number; readonly videoCodec: string; readonly audioCodec: string | null; readonly byteSize: number },
): string | null {
  if (out.videoCodec !== "h264") return "video-codec-not-h264";
  if (out.width % 2 !== 0 || out.height % 2 !== 0) return "dimensions-not-even";
  if (Math.max(out.width, out.height) > NORMALIZE_LIMITS.maxDimension) return "dimension-over-1920";
  if (out.width > source.width || out.height > source.height) return "upscaled";
  if (Math.abs(out.width / out.height - source.width / source.height) > NORMALIZE_LIMITS.aspectTolerance) return "aspect-changed";
  if (Math.abs(out.durationMs - source.durationMs) > NORMALIZE_LIMITS.durationToleranceMs) return "duration-drift";
  if (source.audioCodec === null ? out.audioCodec !== null : out.audioCodec !== "aac") return "audio-track-mismatch";
  if (out.byteSize < 1 || out.byteSize > MEDIA_ASSET_LIMITS.maxByteSize) return "byte-size-out-of-bounds";
  return null;
}

export async function deriveNormalizedVideo(
  tenant: TenantContext | null,
  input: { readonly sourceAssetId: string } | null,
  deps: DeriveNormalizedVideoDeps = {},
): Promise<DeriveNormalizedVideoResult> {
  if (typeof window !== "undefined") throw new Error("Media derivation is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input || !isUuid(input.sourceAssetId)) return refused("invalid-input");
  const tenantId = tenant.tenantId;
  const sourceAssetId = input.sourceAssetId.toLowerCase();

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  const storageV2 = (deps.resolveStorageV2 ?? resolveMediaStorageV2)();
  if (storage.status !== "available" || storageV2.status !== "available") return refused("storage-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = deps.now ?? (() => new Date());

  /* ── 1. THE SOURCE: this tenant's original admitted video. ── */
  let source;
  try {
    source = (
      await db
        .select({
          invocationId: mediaAssets.invocationId,
          derivedFromAssetId: mediaAssets.derivedFromAssetId,
          suppliedSource: mediaAssets.suppliedSource,
          mediaKind: mediaAssets.mediaKind,
          mimeType: mediaAssets.mimeType,
          byteSize: mediaAssets.byteSize,
          byteDigest: mediaAssets.byteDigest,
          width: mediaAssets.width,
          height: mediaAssets.height,
          durationMs: mediaAssets.videoDurationMs,
          audioCodec: mediaAssets.audioCodec,
          lifecycle: mediaAssets.assetLifecycleStatus,
          storageKey: mediaAssets.storageKey,
        })
        .from(mediaAssets)
        .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, sourceAssetId)))
        .limit(1)
    )[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!source) return refused("source-not-found");
  if (source.mediaKind !== "video" || source.mimeType !== "video/mp4" || source.durationMs === null) return refused("source-not-video");
  if (source.derivedFromAssetId !== null) return refused("source-not-original");
  if (source.invocationId === null && source.suppliedSource === null) return refused("source-not-original");
  if (source.lifecycle !== "admitted") return refused("source-retired");

  /* ── 2. REUSE: one derivative per (source, derivation), verified as stored. ── */
  let existing;
  try {
    existing = await selectDerivative(db, tenantId, sourceAssetId);
  } catch {
    return refused("persistence-unavailable");
  }
  if (existing) {
    const stored = await storage.store.verify(existing.storageKey).catch(() => null);
    if (existing.lifecycle !== "admitted" || stored?.status !== "present" || stored.byteSize !== existing.byteSize || stored.sha256Hex !== existing.byteDigest) {
      return refused("derivative-unavailable");
    }
    return { status: "existing", derivative: toDerivative(sourceAssetId, existing) };
  }

  /* ── 3. The source's bytes are the admitted ones. ── */
  const sourceStored = await storage.store.verify(source.storageKey).catch(() => null);
  if (sourceStored?.status !== "present" || sourceStored.byteSize !== source.byteSize || sourceStored.sha256Hex !== source.byteDigest) {
    return refused("source-unavailable");
  }

  /* ── 4. DERIVE-V1 under a fresh key. ── */
  const assetId = (deps.newAssetId ?? randomUUID)();
  const storageKey = mediaAssetStorageKey(tenantId, assetId);
  let facts;
  try {
    facts = await storageV2.client.derive({ sourceKey: source.storageKey, destKey: storageKey, derivation: MP4_NORMALIZE_DERIVATION });
  } catch (error) {
    const detail = error instanceof VpsDeriveRefused ? `${error.status}${error.code ? `:${error.code}` : ""}` : "store-unreachable";
    /* An unreachable store may still have finished; a refusal kept nothing. */
    return failed("derive-failed", detail, !(error instanceof VpsDeriveRefused));
  }

  /* ── 5. The bytes AS STORED, hashed again by the store's verify. ── */
  const stored = await storage.store.verify(storageKey).catch(() => null);
  if (stored?.status !== "present" || stored.byteSize !== facts.byteSize || stored.sha256Hex !== facts.sha256Hex) {
    return failed("stored-bytes-mismatch", null, true);
  }

  /* ── 6 + 7. Brand from the stored bytes; MV-3 policy; the normalize profile. ── */
  let brand: string | null = null;
  try {
    const head = await storageV2.client.readRange({ key: storageKey, contentType: "video/mp4", start: 0, end: 11 });
    brand = head.status === "range" ? mp4MajorBrand(head.bytes) : null;
  } catch {
    brand = null;
  }
  const verdict = evaluateVideoPolicy(facts.probe, brand);
  if (verdict.status !== "admissible") return failed("output-rejected", verdict.detail, true);
  const v = verdict.facts;
  const profileProblem = checkNormalizedProfile(
    { width: source.width, height: source.height, durationMs: source.durationMs, audioCodec: source.audioCodec },
    { ...v, byteSize: stored.byteSize },
  );
  if (profileProblem) return failed("output-rejected", profileProblem, true);

  /* ── 8. Admission: ONE row, lineage explicit. A concurrent winner is returned instead. ── */
  let inserted: { id: string }[];
  try {
    inserted = await db
      .insert(mediaAssets)
      .values({
        id: assetId,
        tenantId,
        invocationId: null,
        derivedFromAssetId: sourceAssetId,
        derivation: MP4_NORMALIZE_DERIVATION,
        mediaKind: "video",
        mimeType: "video/mp4",
        byteSize: stored.byteSize,
        byteDigest: stored.sha256Hex,
        width: v.width,
        height: v.height,
        videoContainer: v.container,
        videoDurationMs: v.durationMs,
        videoCodec: v.videoCodec,
        audioCodec: v.audioCodec,
        videoFrameRate: v.frameRate,
        storageBackend: VPS_MEDIA_STORE_BACKEND,
        storageKey,
        admittedAt: now(),
      })
      .onConflictDoNothing()
      .returning({ id: mediaAssets.id });
  } catch {
    return failed("persistence-failed", null, true);
  }
  if (inserted.length !== 1) {
    const winner = await selectDerivative(db, tenantId, sourceAssetId).catch(() => undefined);
    if (!winner) return failed("persistence-failed", null, true);
    return { status: "existing", derivative: toDerivative(sourceAssetId, winner) };
  }
  return {
    status: "derived",
    derivative: {
      assetId,
      sourceAssetId,
      byteSize: stored.byteSize,
      byteDigest: stored.sha256Hex,
      width: v.width,
      height: v.height,
      durationMs: v.durationMs,
      videoCodec: v.videoCodec,
      audioCodec: v.audioCodec,
      frameRate: v.frameRate,
    },
  };
}
