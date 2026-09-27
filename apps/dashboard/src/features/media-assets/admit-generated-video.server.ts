/*
 * media-assets/admit-generated-video.server.ts — A PROVIDER-GENERATED VIDEO, ADMITTED (MV-7).
 *
 * THE ONE OWNER of the admission transition of an asynchronous video invocation:
 *
 *   media_generation_invocations.admission_outcome   not-attempted → admitted | refused | failed
 *
 * It never writes `state`. The generation lifecycle (`registered → … → provider-succeeded`) stays with
 * `async-generation-lifecycle.server.ts`, which never touches `admission_outcome`; the two writers
 * split the row by column, and every write here is a compare-and-swap that REQUIRES
 * `state = 'provider-succeeded'` and `admission_outcome = 'not-attempted'`.
 *
 * ── THE CHAIN ────────────────────────────────────────────────────────────────
 *
 *   1. this tenant's video invocation, provider-succeeded, admission not attempted
 *   2. the transport it was registered with (same transport, provider, model), able to locateOutput
 *   3. ONE re-observation of the completed job → an output location (URL behind `reveal()`)
 *   4. ONE bounded, address-checked stream of the output (`openProviderOutputStream`)
 *   5. the MV-3 bounded relay (count + SHA-256 + first bytes) into Storage V2 WRITE-V2, probe=required
 *   6. the store's measurement must equal the relay's
 *   7. the MV-3 video policy over the PROBED facts and the relayed ISO-BMFF brand — the raw provider
 *      bytes, never normalized: a video the policy refuses is refused, not repaired
 *   8. ONE transaction: insert the generated asset (`invocation_id` = its provenance) AND move the
 *      invocation to `admitted`. The asset cannot exist without the transition, nor the reverse.
 *
 * ── WHEN `admission_outcome` IS WRITTEN, AND WHEN IT IS NOT ───────────────────
 *
 * Only when Hebun holds a VERDICT ABOUT THESE BYTES:
 *
 *   refused   byte-size-exceeded | probe-failed | video-not-admissible | integrity-mismatch
 *   failed    persistence-failed (bytes stored, the admission transaction did not commit)
 *   admitted  step 8
 *
 * Nothing before a verdict is recorded — the job not re-located, a host not approved, an address
 * refused, a transfer or store fault. Those say nothing about the output; recording them would turn a
 * transient or configuration fact into a permanent admission outcome. The caller gets the reason.
 *
 * ── WHAT NEVER HAPPENS HERE ──────────────────────────────────────────────────
 *
 * No dispatch (a generation POST is unreachable: only `locateOutput` is called), no retry, no second
 * download, no normalization, no URL in a row, result, error or log, no Governance decision, no
 * selection, no publication. A refusal after the store linked the object leaves unrowed custody under
 * a random key — unreadable through Media (every read starts from a row), never deleted (the store has
 * no delete verb). The result says so (`bytesOrphaned`).
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { MEDIA_ASSET_LIMITS, MEDIA_GENERATION_TRANSPORTS, isUuid, mediaAssetStorageKey } from "./contracts";
import type { MediaAsyncGenerationTransport, MediaAsyncGenerationTransportResolution } from "./async-generation-transport";
import { resolveMediaAsyncGenerationTransport } from "./async-generation-transport.server";
import { boundedRelay, evaluateVideoPolicy, mp4MajorBrand, SUPPLIED_VIDEO_MIME_TYPE } from "./admit-supplied-drive-video.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import { resolveMediaStorageV2, type MediaStorageV2Resolution } from "./media-storage.server";
import { openProviderOutputStream, type ProviderStreamDeps, type ProviderStreamRefusal } from "./provider-output-download.server";
import { VPS_MEDIA_STORE_BACKEND } from "./vps-media-object-store.server";
import type { StoredObjectFacts } from "./vps-media-storage-v2.server";

export const GENERATED_VIDEO_MIME_TYPE = SUPPLIED_VIDEO_MIME_TYPE;

/** Nothing was written: no verdict about the output exists. */
export type AdmitGeneratedVideoRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "storage-unavailable"
  | "persistence-unavailable"
  | "invocation-not-found"
  | "provider-not-succeeded"
  | "admission-already-decided"
  | "generation-transport-unavailable"
  | "transport-mismatch"
  | "output-location-unsupported"
  | "output-not-located"
  | Exclude<ProviderStreamRefusal, "byte-size-exceeded">
  | "transfer-failed";

/** A recorded verdict: `admission_failure` carries exactly one of these. */
export type GeneratedVideoAdmissionFailure =
  | "byte-size-exceeded"
  | "probe-failed"
  | "video-not-admissible"
  | "integrity-mismatch"
  | "persistence-failed";

export interface GeneratedVideoAsset {
  readonly assetId: string;
  readonly invocationId: string;
  readonly mimeType: typeof GENERATED_VIDEO_MIME_TYPE;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly container: string;
  readonly durationMs: number;
  readonly videoCodec: string;
  readonly audioCodec: string | null;
  readonly frameRate: string;
}

export type AdmitGeneratedVideoResult =
  | { readonly status: "admitted" | "existing"; readonly asset: GeneratedVideoAsset }
  | { readonly status: "refused"; readonly reason: AdmitGeneratedVideoRefusal; readonly detail?: string }
  | {
      readonly status: "not-admitted";
      readonly outcome: "refused" | "failed";
      readonly failure: GeneratedVideoAdmissionFailure;
      readonly detail?: string;
      /** True when the store linked bytes no row names. */
      readonly bytesOrphaned: boolean;
    };

export interface AdmitGeneratedVideoDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorageV2?: () => MediaStorageV2Resolution;
  readonly resolveTransport?: () => MediaAsyncGenerationTransportResolution | Promise<MediaAsyncGenerationTransportResolution>;
  readonly download?: ProviderStreamDeps;
  readonly now?: () => Date;
  readonly newAssetId?: () => string;
}

const refused = (reason: AdmitGeneratedVideoRefusal, detail?: string): AdmitGeneratedVideoResult => ({
  status: "refused",
  reason,
  ...(detail ? { detail } : {}),
});

type Verdict =
  | { readonly status: "stored"; readonly facts: StoredObjectFacts; readonly relayBytes: number; readonly relayDigest: string; readonly brand: string | null }
  | { readonly status: "overrun" }
  | { readonly status: "store-refused"; readonly code: number | null };

async function resolveTransport(deps: AdmitGeneratedVideoDeps): Promise<MediaAsyncGenerationTransport | null> {
  let resolution: MediaAsyncGenerationTransportResolution;
  try {
    resolution = await (deps.resolveTransport ?? resolveMediaAsyncGenerationTransport)();
  } catch {
    return null;
  }
  if (resolution.status !== "available") return null;
  const t = resolution.transport;
  if (!(MEDIA_GENERATION_TRANSPORTS as readonly string[]).includes(t.transport) || t.outputMediaKind !== "video") return null;
  return t;
}

export async function admitGeneratedVideo(
  tenant: TenantContext | null,
  input: { readonly invocationId: string } | null,
  deps: AdmitGeneratedVideoDeps = {},
): Promise<AdmitGeneratedVideoResult> {
  if (typeof window !== "undefined") throw new Error("Media admission is server-only.");

  /* ── WHO, AND WHICH ATTEMPT ── */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!input || !isUuid(input.invocationId)) return refused("invalid-input");
  const tenantId = tenant.tenantId;
  const invocationId = input.invocationId.toLowerCase();

  const storage = (deps.resolveStorageV2 ?? resolveMediaStorageV2)();
  if (storage.status !== "available") return refused("storage-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  const thisInvocation = and(eq(mediaGenerationInvocations.tenantId, tenantId), eq(mediaGenerationInvocations.id, invocationId));
  let row;
  try {
    row = (
      await db
        .select({
          state: mediaGenerationInvocations.state,
          outputMediaKind: mediaGenerationInvocations.outputMediaKind,
          transport: mediaGenerationInvocations.transport,
          provider: mediaGenerationInvocations.provider,
          model: mediaGenerationInvocations.model,
          outputRef: mediaGenerationInvocations.providerOutputRef,
          admissionOutcome: mediaGenerationInvocations.admissionOutcome,
        })
        .from(mediaGenerationInvocations)
        .where(thisInvocation)
        .limit(1)
    )[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!row || row.outputMediaKind !== "video") return refused("invocation-not-found");
  if (row.state !== "provider-succeeded" || !row.outputRef) return refused("provider-not-succeeded");
  if (row.admissionOutcome === "admitted") {
    const existing = await readAdmitted(db, tenantId, invocationId).catch(() => null);
    return existing ? { status: "existing", asset: existing } : refused("persistence-unavailable");
  }
  if (row.admissionOutcome !== "not-attempted") return refused("admission-already-decided", row.admissionOutcome);

  /* ── THE TRANSPORT IT WAS REGISTERED WITH, AND ONLY A STATUS READ OF IT ── */
  const transport = await resolveTransport(deps);
  if (!transport) return refused("generation-transport-unavailable");
  if (transport.transport !== row.transport || transport.provider !== row.provider || transport.model !== row.model) {
    return refused("transport-mismatch");
  }
  if (typeof transport.locateOutput !== "function") return refused("output-location-unsupported");

  let located;
  try {
    located = await transport.locateOutput({ providerJobId: row.outputRef });
  } catch {
    located = { status: "unreadable" as const };
  }
  if (located.status !== "located") {
    return refused("output-not-located", located.status === "not-located" ? located.reason : located.status);
  }

  /* ── ONE BOUNDED STREAM, RELAYED INTO ONE WRITE-ONCE KEY, PROBED BY THE STORE ── */
  const opened = await openProviderOutputStream(located.location, GENERATED_VIDEO_MIME_TYPE, deps.download);
  if (opened.status === "refused") {
    if (opened.reason === "byte-size-exceeded") return notAdmitted(db, thisInvocation, "refused", "byte-size-exceeded", undefined, false);
    return refused(opened.reason);
  }

  const assetId = (deps.newAssetId ?? randomUUID)();
  const storageKey = mediaAssetStorageKey(tenantId, assetId);
  const relay = boundedRelay(MEDIA_ASSET_LIMITS.maxByteSize);
  let verdict: Verdict;
  try {
    const facts = await storage.client.putStream({
      key: storageKey,
      contentType: GENERATED_VIDEO_MIME_TYPE,
      body: opened.body.pipeThrough(relay.stream),
      maxBytes: MEDIA_ASSET_LIMITS.maxByteSize,
      probe: "required",
    });
    const r = relay.result();
    verdict = { status: "stored", facts, relayBytes: r.count, relayDigest: r.digest, brand: mp4MajorBrand(r.head) };
  } catch (error) {
    if (relay.result().overrun || opened.overran()) verdict = { status: "overrun" };
    else {
      const m = /\((\d{3})\)/.exec(error instanceof Error ? error.message : "");
      verdict = { status: "store-refused", code: m ? Number(m[1]) : null };
    }
  }

  if (verdict.status === "overrun") return notAdmitted(db, thisInvocation, "refused", "byte-size-exceeded", undefined, false);
  if (verdict.status === "store-refused") {
    if (verdict.code === 413) return notAdmitted(db, thisInvocation, "refused", "byte-size-exceeded", undefined, false);
    if (verdict.code === 422) return notAdmitted(db, thisInvocation, "refused", "probe-failed", undefined, false);
    /* A transfer or store fault says nothing about the output. Nothing is recorded. */
    return refused("transfer-failed", verdict.code === null ? "unreachable" : `store-${verdict.code}`);
  }

  /* ── THE STORE'S MEASUREMENT MUST BE THE RELAY'S; THEN THE POLICY OVER PROBED FACTS ── */
  const stored = verdict.facts;
  if (stored.byteSize !== verdict.relayBytes || stored.sha256Hex !== verdict.relayDigest) {
    return notAdmitted(db, thisInvocation, "refused", "integrity-mismatch", undefined, true);
  }
  if (stored.byteSize < 1 || stored.byteSize > MEDIA_ASSET_LIMITS.maxByteSize) {
    return notAdmitted(db, thisInvocation, "refused", "byte-size-exceeded", undefined, true);
  }
  const policy = evaluateVideoPolicy(stored.probe, verdict.brand);
  if (policy.status !== "admissible") return notAdmitted(db, thisInvocation, "refused", "video-not-admissible", policy.detail, true);
  const v = policy.facts;

  /* ── ONE TRANSACTION: THE ASSET AND ITS ADMISSION, OR NEITHER ── */
  const admittedAt = (deps.now ?? (() => new Date()))();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(mediaAssets).values({
        id: assetId,
        tenantId,
        invocationId,
        mediaKind: "video",
        mimeType: GENERATED_VIDEO_MIME_TYPE,
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
      });
      const marked = await tx
        .update(mediaGenerationInvocations)
        .set({ admissionOutcome: "admitted", admissionFailure: null })
        .where(
          and(
            thisInvocation,
            eq(mediaGenerationInvocations.state, "provider-succeeded"),
            eq(mediaGenerationInvocations.admissionOutcome, "not-attempted"),
            eq(mediaGenerationInvocations.outputMediaKind, "video"),
          ),
        )
        .returning({ id: mediaGenerationInvocations.id });
      if (marked.length !== 1) throw new AdmissionRaced();
    });
  } catch (error) {
    /* Another admission decided first: its verdict stands, ours is unrowed custody. */
    if (error instanceof AdmissionRaced || isUniqueViolation(error)) {
      const existing = await readAdmitted(db, tenantId, invocationId).catch(() => null);
      return existing ? { status: "existing", asset: existing } : refused("admission-already-decided");
    }
    return notAdmitted(db, thisInvocation, "failed", "persistence-failed", undefined, true);
  }

  return {
    status: "admitted",
    asset: {
      assetId,
      invocationId,
      mimeType: GENERATED_VIDEO_MIME_TYPE,
      byteSize: stored.byteSize,
      byteDigest: stored.sha256Hex,
      width: v.width,
      height: v.height,
      container: v.container,
      durationMs: v.durationMs,
      videoCodec: v.videoCodec,
      audioCodec: v.audioCodec,
      frameRate: v.frameRate,
    },
  };
}

class AdmissionRaced extends Error {}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Record a verdict about these bytes. Only from `not-attempted`; never touches `state`. */
async function notAdmitted(
  db: ControlPlaneDatabase,
  thisInvocation: ReturnType<typeof and>,
  outcome: "refused" | "failed",
  failure: GeneratedVideoAdmissionFailure,
  detail: string | undefined,
  bytesOrphaned: boolean,
): Promise<AdmitGeneratedVideoResult> {
  try {
    await db
      .update(mediaGenerationInvocations)
      .set({ admissionOutcome: outcome, admissionFailure: failure })
      .where(
        and(
          thisInvocation,
          eq(mediaGenerationInvocations.state, "provider-succeeded"),
          eq(mediaGenerationInvocations.admissionOutcome, "not-attempted"),
          eq(mediaGenerationInvocations.outputMediaKind, "video"),
        ),
      );
  } catch {
    /* The row stays `not-attempted`; the result below is still the truth about this call. */
  }
  return { status: "not-admitted", outcome, failure, ...(detail ? { detail } : {}), bytesOrphaned };
}

async function readAdmitted(db: ControlPlaneDatabase, tenantId: string, invocationId: string): Promise<GeneratedVideoAsset | null> {
  const r = (
    await db
      .select({
        id: mediaAssets.id,
        mediaKind: mediaAssets.mediaKind,
        byteSize: mediaAssets.byteSize,
        byteDigest: mediaAssets.byteDigest,
        width: mediaAssets.width,
        height: mediaAssets.height,
        container: mediaAssets.videoContainer,
        durationMs: mediaAssets.videoDurationMs,
        videoCodec: mediaAssets.videoCodec,
        audioCodec: mediaAssets.audioCodec,
        frameRate: mediaAssets.videoFrameRate,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.invocationId, invocationId)))
      .limit(1)
  )[0];
  if (!r || r.mediaKind !== "video" || r.container === null || r.durationMs === null || r.videoCodec === null || r.frameRate === null) return null;
  return {
    assetId: r.id,
    invocationId,
    mimeType: GENERATED_VIDEO_MIME_TYPE,
    byteSize: r.byteSize,
    byteDigest: r.byteDigest,
    width: r.width,
    height: r.height,
    container: r.container,
    durationMs: r.durationMs,
    videoCodec: r.videoCodec,
    audioCodec: r.audioCodec,
    frameRate: r.frameRate,
  };
}
