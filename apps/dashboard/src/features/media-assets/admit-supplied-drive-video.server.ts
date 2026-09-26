/*
 * media-assets/admit-supplied-drive-video.server.ts — A SUPPLIED DRIVE VIDEO, ADMITTED (MV-3).
 *
 * The video sibling of `admit-supplied-drive-image.server.ts`. Same authority (`media_assets`), same
 * supplied provenance columns, same per-file Drive capability, same draft-revision binding. What
 * differs is that the bytes are NEVER held whole in this process:
 *
 *   Drive `alt=media` body ──(bounded relay: count + SHA-256 + first bytes)──▶ VPS WRITE-V2 (probe=required)
 *
 * The VPS measures size and SHA-256 itself, runs ffprobe over its own temp file, and only then links
 * the object write-once. This module then checks the store's measurement against its own relay
 * measurement, applies the admission policy to the PROBED facts, and only then writes the row.
 *
 * ── ADMISSION POLICY (MV-3, deliberately narrow) ─────────────────────────────
 *
 *   video/mp4 — ISO-BMFF `ftyp` box whose major brand is an MP4 brand (never QuickTime `qt  `), and
 *   ffprobe's container family names mp4 — H.264 video — AAC audio, or no audio at all — duration,
 *   frame size and frame rate present and within the Media CHECKs.
 *
 * Drive's `mimeType` and the file name are claims: `mimeType` decides only whether a download is
 * attempted; neither is recorded as a technical fact.
 *
 * ── FAILURE AND ORPHANS ──────────────────────────────────────────────────────
 *
 * No failure writes a row. A failure BEFORE the store links the object (Drive read, relay overrun,
 * size ceiling, ffprobe failure, store refusal) leaves nothing: the store unlinks its temp file. A
 * refusal AFTER the store linked it (relay/store measurement disagree, codec policy, database) leaves
 * the bytes as unrowed custody under a random key: never readable through Media (every read starts
 * from a row), never listed, and not deletable — the store has no delete verb, by design.
 *
 * Supplying grants NOTHING: not a review, not a selection, not a publish. MV-2's guards keep a video
 * out of JPEG derivation, publish lineage, content selection, image review and reference edit.
 *
 * Server-only.
 */
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { GOOGLE_DRIVE_FILE_CAPABILITY, MAX_DRIVE_VIDEO_BYTES, type GoogleDriveVideoMeta } from "@/features/provider-google/contracts";
import { relayDriveVideo, type DriveVideoConsumer, type DriveVideoResult } from "@/features/provider-google/relay-drive-video.server";
import { MEDIA_ASSET_LIMITS, isUuid, mediaAssetStorageKey } from "./contracts";
import { VPS_MEDIA_STORE_BACKEND } from "./vps-media-object-store.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import { resolveMediaStorageV2, type MediaStorageV2Resolution } from "./media-storage.server";
import type { ProbeFacts, StoredObjectFacts } from "./vps-media-storage-v2.server";
import { SUPPLIED_MEDIA_SOURCE } from "./admit-supplied-drive-image.server";

export const SUPPLIED_VIDEO_MIME_TYPE = "video/mp4" as const;

export interface AdmitSuppliedDriveVideoInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly driveFileId: string;
}

export type AdmitSuppliedDriveVideoRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "persistence-unavailable"
  | "source-revision-unresolvable"
  | "drive-capability-not-available"
  | "drive-read-failed"
  | "byte-size-exceeded"
  /** The VPS refused or failed the streamed write (including: video storage not enabled there). */
  | "storage-write-failed"
  /** ffprobe could not read the stored bytes as media. */
  | "probe-failed"
  /** Readable media, but not MP4 + H.264 + (AAC | no audio) within bounds. */
  | "video-not-admissible"
  | "integrity-mismatch"
  | "asset-retired";

export interface SuppliedVideoAsset {
  readonly assetId: string;
  readonly mimeType: typeof SUPPLIED_VIDEO_MIME_TYPE;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly container: string;
  readonly durationMs: number;
  readonly videoCodec: string;
  readonly audioCodec: string | null;
  readonly frameRate: string;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly suppliedSourceFileId: string;
}

export type AdmitSuppliedDriveVideoResult =
  | { readonly status: "admitted" | "existing"; readonly asset: SuppliedVideoAsset }
  | { readonly status: "refused"; readonly reason: AdmitSuppliedDriveVideoRefusal; readonly detail?: string };

export type DriveVideoRelay = <T>(
  tenant: TenantContext,
  input: { readonly fileId: string },
  consume: DriveVideoConsumer<T>,
) => Promise<DriveVideoResult<T>>;

export interface AdmitSuppliedDriveVideoDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorageV2?: () => MediaStorageV2Resolution;
  readonly now?: () => Date;
  readonly newAssetId?: () => string;
  /** The Drive relay. Injected in tests; production uses the tenant-gated seam. */
  readonly relayVideo?: DriveVideoRelay;
}

const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{1,256}$/;
const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "mmp4"]);
const RATE = /^[1-9][0-9]{0,8}\/[1-9][0-9]{0,8}$/;
const HEAD_BYTES = 12;

const refused = (reason: AdmitSuppliedDriveVideoRefusal, detail?: string): AdmitSuppliedDriveVideoResult => ({
  status: "refused",
  reason,
  ...(detail ? { detail } : {}),
});

/** The ISO-BMFF major brand, read from the relayed bytes themselves: `????ftypBRND`. */
export function mp4MajorBrand(head: Uint8Array): string | null {
  if (head.byteLength < HEAD_BYTES) return null;
  const ascii = (a: number, b: number) => String.fromCharCode(...head.subarray(a, b));
  if (ascii(4, 8) !== "ftyp") return null;
  return ascii(8, 12);
}

export type VideoPolicyVerdict =
  | {
      readonly status: "admissible";
      readonly facts: {
        readonly container: string;
        readonly durationMs: number;
        readonly width: number;
        readonly height: number;
        readonly videoCodec: string;
        readonly audioCodec: string | null;
        readonly frameRate: string;
      };
    }
  | { readonly status: "refused"; readonly detail: string };

/** MV-3 admission policy over PROBED facts and the relayed brand. Pure. */
export function evaluateVideoPolicy(probe: ProbeFacts | null, brand: string | null): VideoPolicyVerdict {
  const no = (detail: string): VideoPolicyVerdict => ({ status: "refused", detail });
  if (!probe) return no("no-probe-facts");
  if (brand === null || !MP4_BRANDS.has(brand)) return no("not-an-mp4-brand");
  if (!probe.container.split(",").includes("mp4")) return no("not-an-mp4-container");
  const video = probe.video;
  if (!video) return no("no-video-stream");
  if (video.codec !== "h264") return no("video-codec-not-h264");
  if (probe.audio !== null && probe.audio.codec !== "aac") return no("audio-codec-not-aac");
  const w = video.width;
  const h = video.height;
  if (w === null || h === null || w < 1 || h < 1 || w > MEDIA_ASSET_LIMITS.maxDimension || h > MEDIA_ASSET_LIMITS.maxDimension) {
    return no("frame-size-out-of-bounds");
  }
  if (video.frameRate === null || !RATE.test(video.frameRate)) return no("frame-rate-unknown");
  if (probe.durationSeconds === null || !(probe.durationSeconds > 0)) return no("duration-unknown");
  const durationMs = Math.max(1, Math.round(probe.durationSeconds * 1000));
  if (!Number.isSafeInteger(durationMs) || durationMs > 2_147_483_647) return no("duration-out-of-bounds");
  return {
    status: "admissible",
    facts: {
      container: probe.container,
      durationMs,
      width: w,
      height: h,
      videoCodec: video.codec,
      audioCodec: probe.audio?.codec ?? null,
      frameRate: video.frameRate,
    },
  };
}

type RelayOutcome =
  | { readonly status: "stored"; readonly facts: StoredObjectFacts; readonly relayBytes: number; readonly relayDigest: string; readonly brand: string | null }
  | { readonly status: "overrun" }
  | { readonly status: "store-refused"; readonly detail: string };

/**
 * A bounded pass-through: counts, hashes and remembers the first bytes of what flows from Drive to the
 * store, and errors the stream the moment it passes the ceiling. Nothing is accumulated.
 */
function boundedRelay(max: number) {
  const hash = createHash("sha256");
  const head = new Uint8Array(HEAD_BYTES);
  let count = 0;
  let overrun = false;
  const stream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (count < HEAD_BYTES) head.set(chunk.subarray(0, HEAD_BYTES - count), count);
      count += chunk.byteLength;
      if (count > max) {
        overrun = true;
        controller.error(new Error("relay ceiling exceeded"));
        return;
      }
      hash.update(chunk);
      controller.enqueue(chunk);
    },
  });
  return {
    stream,
    result: () => ({ count, digest: hash.digest("hex"), head: head.subarray(0, Math.min(count, HEAD_BYTES)), overrun }),
  };
}

export async function admitSuppliedDriveVideo(
  tenant: TenantContext | null,
  input: AdmitSuppliedDriveVideoInput | null,
  deps: AdmitSuppliedDriveVideoDeps = {},
): Promise<AdmitSuppliedDriveVideoResult> {
  if (typeof window !== "undefined") throw new Error("Media admission is server-only.");

  /* ── WHO, AND WHAT ── */
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

  const storage = (deps.resolveStorageV2 ?? resolveMediaStorageV2)();
  if (storage.status !== "available") return refused("storage-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  /* ── WHAT IT IS FOR — this tenant's content draft, at exactly that revision. ── */
  try {
    const target = (
      await db
        .select({ revisionNo: workArtifactRevisions.revisionNo })
        .from(workArtifactRevisions)
        .innerJoin(
          workArtifacts,
          and(eq(workArtifacts.id, workArtifactRevisions.artifactId), eq(workArtifacts.tenantId, workArtifactRevisions.tenantId)),
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
    if (!target) return refused("source-revision-unresolvable");
  } catch {
    return refused("persistence-unavailable");
  }

  /* ── ONE DRIVE RELAY INTO ONE WRITE-ONCE KEY, PROBED BY THE STORE. ── */
  const assetId = (deps.newAssetId ?? randomUUID)();
  const storageKey = mediaAssetStorageKey(tenantId, assetId);
  const consume: DriveVideoConsumer<RelayOutcome> = async (body: ReadableStream<Uint8Array>, _meta: GoogleDriveVideoMeta) => {
    void _meta;
    const relay = boundedRelay(MAX_DRIVE_VIDEO_BYTES);
    try {
      const facts = await storage.client.putStream({
        key: storageKey,
        contentType: SUPPLIED_VIDEO_MIME_TYPE,
        body: body.pipeThrough(relay.stream),
        maxBytes: MAX_DRIVE_VIDEO_BYTES,
        probe: "required",
      });
      const r = relay.result();
      return { status: "stored", facts, relayBytes: r.count, relayDigest: r.digest, brand: mp4MajorBrand(r.head) };
    } catch (error) {
      if (relay.result().overrun) return { status: "overrun" };
      const m = /\((\d{3})\)/.exec(error instanceof Error ? error.message : "");
      return { status: "store-refused", detail: m ? `store-${m[1]}` : "store-unreachable" };
    }
  };

  let relayed: DriveVideoResult<RelayOutcome>;
  try {
    relayed = await (deps.relayVideo ?? ((t, i, c) => relayDriveVideo(t, i, c, { getDb: () => db })))(
      tenant,
      { fileId: driveFileId },
      consume,
    );
  } catch {
    return refused("drive-read-failed", "google-unreachable");
  }
  if (relayed.status === "refused") {
    return relayed.reason === "capability-not-available" || relayed.reason === "integration-not-found"
      ? refused("drive-capability-not-available", relayed.reason)
      : refused("drive-read-failed", relayed.reason);
  }
  if (relayed.status === "provider-failed") {
    return relayed.reason === "google-file-too-large" ? refused("byte-size-exceeded") : refused("drive-read-failed", relayed.reason);
  }
  if (relayed.capability !== GOOGLE_DRIVE_FILE_CAPABILITY) return refused("drive-read-failed", "unexpected-capability");
  const outcome = relayed.value;
  if (outcome.status === "overrun") return refused("byte-size-exceeded");
  if (outcome.status === "store-refused") {
    if (outcome.detail === "store-413") return refused("byte-size-exceeded");
    if (outcome.detail === "store-422") return refused("probe-failed");
    return refused("storage-write-failed", outcome.detail);
  }

  /* ── THE STORE'S MEASUREMENT MUST BE THE RELAY'S. ── */
  const stored = outcome.facts;
  if (stored.byteSize !== outcome.relayBytes || stored.sha256Hex !== outcome.relayDigest) return refused("integrity-mismatch");
  if (stored.byteSize < 1 || stored.byteSize > MEDIA_ASSET_LIMITS.maxByteSize) return refused("byte-size-exceeded");

  /* ── POLICY OVER PROBED FACTS. ── */
  const verdict = evaluateVideoPolicy(stored.probe, outcome.brand);
  if (verdict.status !== "admissible") return refused("video-not-admissible", verdict.detail);
  const v = verdict.facts;

  /* ── IDEMPOTENT SUPPLY: the same bytes from the same file for the same revision are ONE asset. ── */
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
        suppliedSourceCapability: GOOGLE_DRIVE_FILE_CAPABILITY,
        suppliedArtifactId: artifactId,
        suppliedRevisionNo: revisionNo,
        mediaKind: "video",
        mimeType: SUPPLIED_VIDEO_MIME_TYPE,
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
        admittedAt,
      })
      .onConflictDoNothing()
      .returning({ id: mediaAssets.id });

    /* A conflict means this exact supply already exists under ITS id; the new object stays unrowed. */
    const row = (
      await db
        .select({ id: mediaAssets.id, lifecycle: mediaAssets.assetLifecycleStatus, kind: mediaAssets.mediaKind })
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.tenantId, tenantId),
            eq(mediaAssets.suppliedArtifactId, artifactId),
            eq(mediaAssets.suppliedRevisionNo, revisionNo),
            eq(mediaAssets.suppliedSource, SUPPLIED_MEDIA_SOURCE),
            eq(mediaAssets.suppliedSourceFileId, driveFileId),
            eq(mediaAssets.byteDigest, stored.sha256Hex),
          ),
        )
        .limit(1)
    )[0];
    if (!row || row.kind !== "video") return refused("persistence-unavailable");
    if (row.lifecycle !== "admitted") return refused("asset-retired");
    return {
      status: inserted.length === 1 ? "admitted" : "existing",
      asset: {
        assetId: row.id,
        mimeType: SUPPLIED_VIDEO_MIME_TYPE,
        byteSize: stored.byteSize,
        byteDigest: stored.sha256Hex,
        width: v.width,
        height: v.height,
        container: v.container,
        durationMs: v.durationMs,
        videoCodec: v.videoCodec,
        audioCodec: v.audioCodec,
        frameRate: v.frameRate,
        sourceArtifactId: artifactId,
        sourceRevisionNo: revisionNo,
        suppliedSourceFileId: driveFileId,
      },
    };
  } catch {
    return refused("persistence-unavailable");
  }
}
