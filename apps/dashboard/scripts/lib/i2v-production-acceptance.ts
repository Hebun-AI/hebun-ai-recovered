/*
 * scripts/lib/i2v-production-acceptance.ts — ONE production IMAGE → VIDEO generation, admission and
 * playback, as testable steps.
 *
 * AN ORCHESTRATOR, NOT AN AUTHORITY. Every write is made by a released writer:
 *
 *   transport availability   the released video resolver, asked for an `image` transport (selection +
 *                            key + the SEPARATE `higgsfield-image-to-video` Director control)
 *   source verify + upload   `requestAsyncVideoGeneration` (private-store read, size + SHA-256 against
 *   + register + dispatch    the row, MV-4 registration with lineage, the transport's documented
 *                            upload, ONE dispatch)
 *   poll                     the MV-4 lifecycle writer, bounded by MV-6's polling policy
 *   output location          the transport's `locateOutput` (one status GET)
 *   bytes, probe, admission  the MV-7 admission writer
 *   playback                 the Media video read model's signed grant
 *
 * It writes no row, holds no control, reads no configuration and decides no admission. It STOPS at the
 * first step that is not a success — never retries, never dispatches again — and BEFORE any output
 * byte is fetched when the output host is not the approved exact host.
 *
 * `guardImageToVideoFetch` is a second lock under the transport: at most ONE upload-preparation POST,
 * ONE presigned PUT and ONE generation POST may leave; any second one is refused BEFORE sending. The
 * private Media store is exempt (it is Hebun's own), and is identified by its origin, not by guessing.
 */
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type {
  MediaAsyncGenerationTransportResolution,
  MediaProviderOutputShape,
} from "../../src/features/media-assets/async-generation-transport";
import type { MediaStorageV2Resolution } from "../../src/features/media-assets/media-storage.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import type { ProviderStreamDeps } from "../../src/features/media-assets/provider-output-download.server";
import { admitGeneratedVideo, type AdmitGeneratedVideoResult } from "../../src/features/media-assets/admit-generated-video.server";
import { mp4MajorBrand } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { readMediaVideo } from "../../src/features/media-assets/read-media-videos.server";
import {
  pollAsyncMediaGeneration,
  readAsyncMediaGeneration,
  requestAsyncVideoGeneration,
} from "../../src/features/media-assets/async-generation-lifecycle.server";
import { HIGGSFIELD_UPLOAD_PREPARE_URL } from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { MV6_GENERATION_POLL } from "./mv6-generation-acceptance";

export const I2V_PRODUCTION_CONFIRMATION = "--confirm-one-billable-image-to-video-generation";
export const I2V_PRODUCTION_PROMPT = "A slow camera push-in with soft natural light.";

export interface ImageToVideoFetchCounts {
  uploadPreparations: number;
  uploadPuts: number;
  generationPosts: number;
  providerGets: number;
  refused: number;
}

/**
 * Wrap `fetch`: at most ONE upload-preparation POST and ONE generation POST to `providerOrigin`, and
 * ONE PUT anywhere other than `storeOrigin`. A second of any kind is refused before sending. GETs to
 * the provider are counted. Requests to the store, and output GETs, pass through.
 */
export function guardImageToVideoFetch(
  inner: typeof fetch,
  providerOrigin: string,
  storeOrigin: string,
): { readonly fetchImpl: typeof fetch; readonly counts: ImageToVideoFetchCounts } {
  const counts: ImageToVideoFetchCounts = { uploadPreparations: 0, uploadPuts: 0, generationPosts: 0, providerGets: 0, refused: 0 };
  const refuse = (what: string): never => {
    counts.refused += 1;
    throw new Error(`IMAGE → VIDEO production acceptance: a second ${what} was refused before sending`);
  };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    if (url.startsWith(`${providerOrigin}/`)) {
      if (method === "GET") counts.providerGets += 1;
      else if (url === HIGGSFIELD_UPLOAD_PREPARE_URL) {
        if (counts.uploadPreparations >= 1) refuse("upload preparation");
        counts.uploadPreparations += 1;
      } else {
        if (counts.generationPosts >= 1) refuse("generation POST");
        counts.generationPosts += 1;
      }
    } else if (method !== "GET" && !(storeOrigin && url.startsWith(`${storeOrigin}/`))) {
      if (counts.uploadPuts >= 1) refuse("upload PUT");
      counts.uploadPuts += 1;
    }
    return inner(input, init);
  }) as typeof fetch;
  return { fetchImpl, counts };
}

export interface ImageToVideoAcceptanceInput {
  readonly tenant: TenantContext;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly sourceAssetId: string;
  readonly promptText: string;
  readonly requestKey: string;
  readonly getDb: () => ControlPlaneDatabase;
  /** The released resolver, asked for an `image` transport. */
  readonly resolveTransport: () => Promise<MediaAsyncGenerationTransportResolution>;
  readonly resolveStorageV1: () => MediaStorageResolution;
  readonly resolveStorageV2: () => MediaStorageV2Resolution;
  readonly countMediaAssets: () => Promise<number>;
  readonly invocationRow: (id: string) => Promise<Record<string, unknown> | null>;
  readonly assetRows: (invocationId: string) => Promise<Record<string, unknown>[]>;
  readonly download?: ProviderStreamDeps;
  readonly rangeFetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly poll?: Partial<Record<keyof typeof MV6_GENERATION_POLL, number>>;
}

export type ImageToVideoAcceptanceStop =
  | "transport-unavailable"
  | "not-dispatched"
  | "generation-not-succeeded"
  | "output-not-located"
  | "host-not-approved"
  | "not-admitted"
  | "admitted";

export interface ImageToVideoAcceptanceReport {
  readonly stop: ImageToVideoAcceptanceStop;
  readonly detail: string | null;
  readonly model: string | null;
  readonly invocationId: string | null;
  readonly dispatchState: string | null;
  readonly finalState: string | null;
  readonly providerFailure: string | null;
  readonly polls: number;
  readonly unreadableObservations: number;
  readonly elapsedMs: number;
  readonly lineageSourceAssetId: string | null;
  readonly outputShape: MediaProviderOutputShape | null;
  readonly admission: AdmitGeneratedVideoResult | null;
  readonly admissionOutcome: string | null;
  readonly assetsForInvocation: number;
  readonly mediaAssetsBefore: number;
  readonly mediaAssetsAfter: number;
  readonly storedVerified: boolean;
  readonly storedMajorBrand: string | null;
  readonly readModelOrigin: string | null;
  readonly readModelInvocationLinked: boolean;
  readonly rangeStatus: number | null;
  readonly rangeBytes: number | null;
}

const TERMINAL = new Set(["provider-succeeded", "provider-failed", "dispatch-unknown", "dispatch-failed"]);

export async function runImageToVideoAcceptance(input: ImageToVideoAcceptanceInput): Promise<ImageToVideoAcceptanceReport> {
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = input.now ?? (() => Date.now());
  const cfg = { ...MV6_GENERATION_POLL, ...input.poll };
  const started = now();
  const mediaAssetsBefore = await input.countMediaAssets();
  let polls = 0;
  let unreadable = 0;
  let consecutiveUnreadable = 0;

  const report = async (
    stop: ImageToVideoAcceptanceStop,
    over: Partial<ImageToVideoAcceptanceReport> & { invocationId?: string | null } = {},
  ): Promise<ImageToVideoAcceptanceReport> => {
    const id = over.invocationId ?? null;
    const row = id ? await input.invocationRow(id) : null;
    return {
      stop,
      detail: null,
      model: null,
      invocationId: id,
      dispatchState: null,
      finalState: row?.state == null ? null : String(row.state),
      providerFailure: row?.provider_failure == null ? null : String(row.provider_failure),
      polls,
      unreadableObservations: unreadable,
      elapsedMs: now() - started,
      lineageSourceAssetId: row?.source_media_asset_id == null ? null : String(row.source_media_asset_id),
      outputShape: null,
      admission: null,
      admissionOutcome: row?.admission_outcome == null ? null : String(row.admission_outcome),
      assetsForInvocation: id ? (await input.assetRows(id)).length : 0,
      mediaAssetsBefore,
      mediaAssetsAfter: await input.countMediaAssets(),
      storedVerified: false,
      storedMajorBrand: null,
      readModelOrigin: null,
      readModelInvocationLinked: false,
      rangeStatus: null,
      rangeBytes: null,
      ...over,
    };
  };

  /* 1. The released resolver decides whether an IMAGE transport exists — its own control included. */
  const resolution = await input.resolveTransport();
  if (resolution.status !== "available") return report("transport-unavailable", { detail: resolution.reason });
  const transport = resolution.transport;
  if ((transport.inputMode ?? "text") !== "image") return report("transport-unavailable", { detail: "not-an-image-transport" });
  const model = transport.model;
  const deps = { getDb: input.getDb, resolveStorage: input.resolveStorageV1, resolveTransport: () => resolution };

  /* 2. Verify the source, register with lineage, upload, and dispatch ONCE — the released request. */
  const requested = await requestAsyncVideoGeneration(
    input.tenant,
    {
      artifactId: input.artifactId,
      revisionNo: input.revisionNo,
      promptText: input.promptText,
      requestKey: input.requestKey,
      sourceAssetId: input.sourceAssetId,
    },
    deps,
  );
  if (requested.status === "refused") return report("not-dispatched", { detail: requested.reason, model });
  const invocationId = requested.invocationId;
  if (requested.status === "registered-not-sent") return report("not-dispatched", { detail: requested.reason, model, invocationId });
  if (requested.state !== "provider-pending") {
    return report("generation-not-succeeded", { detail: requested.state, model, invocationId, dispatchState: requested.state });
  }

  /* 3. Bounded polling by the MV-4 writer. Nothing here can dispatch. */
  let delay: number = cfg.firstDelayMs;
  for (;;) {
    if (now() - started >= cfg.deadlineMs) return report("generation-not-succeeded", { detail: "deadline", model, invocationId, dispatchState: "provider-pending" });
    await sleep(delay + Math.floor(Math.random() * cfg.jitterMs));
    delay = Math.min(delay * cfg.growth, cfg.maxDelayMs);
    polls += 1;
    const observed = await pollAsyncMediaGeneration(input.tenant, invocationId, deps);
    if (observed.status === "refused") return report("generation-not-succeeded", { detail: observed.reason, model, invocationId, dispatchState: "provider-pending" });
    if (observed.status === "transitioned" || (observed.status === "no-transition" && TERMINAL.has(observed.state))) break;
    if (observed.status === "observation-unreadable") {
      unreadable += 1;
      consecutiveUnreadable += 1;
      if (consecutiveUnreadable >= cfg.maxConsecutiveUnreadable) {
        return report("generation-not-succeeded", { detail: "unreadable-streak", model, invocationId, dispatchState: "provider-pending" });
      }
    } else consecutiveUnreadable = 0;
  }
  const state = await readAsyncMediaGeneration(input.tenant, invocationId, { getDb: input.getDb });
  if (state.status !== "read" || state.generation.state !== "provider-succeeded") {
    return report("generation-not-succeeded", { model, invocationId, dispatchState: "provider-pending" });
  }
  const jobRow = await input.invocationRow(invocationId);
  const providerJobId = jobRow?.provider_job_id == null ? null : String(jobRow.provider_job_id);
  if (!providerJobId || typeof transport.locateOutput !== "function") {
    return report("output-not-located", { detail: "no-job-or-no-locate", model, invocationId, dispatchState: "provider-pending" });
  }

  /* 4. Re-observe: where is the output, and is its host the approved exact host? No byte yet. */
  let located;
  try {
    located = await transport.locateOutput({ providerJobId });
  } catch {
    located = { status: "unreadable" as const };
  }
  if (located.status !== "located") {
    return report("output-not-located", { detail: located.status === "not-located" ? located.reason : located.status, model, invocationId, dispatchState: "provider-pending" });
  }
  const shape = located.location.shape;
  if (!located.location.allowedHosts.includes(shape.hostname)) {
    return report("host-not-approved", { detail: shape.hostname, model, invocationId, dispatchState: "provider-pending", outputShape: shape });
  }

  /* 5. Admission, by the MV-7 writer, through the same image transport. */
  const admission = await admitGeneratedVideo(input.tenant, { invocationId }, {
    getDb: input.getDb,
    resolveStorageV2: input.resolveStorageV2,
    resolveTransport: () => resolution,
    download: input.download,
  });
  const base = { model, invocationId, dispatchState: "provider-pending", outputShape: shape, admission };
  if (admission.status !== "admitted") return report("not-admitted", { ...base, detail: admission.status });

  /* 6. Provider-free verification: stored bytes, brand, read model, one signed Range. */
  const rows = await input.assetRows(invocationId);
  const row = rows[0];
  let storedVerified = false;
  let storedMajorBrand: string | null = null;
  const v1 = input.resolveStorageV1();
  const v2 = input.resolveStorageV2();
  if (row && rows.length === 1) {
    if (v1.status === "available") {
      const stored = await v1.store.verify(String(row.storage_key)).catch(() => null);
      storedVerified =
        stored?.status === "present" && stored.sha256Hex === row.byte_digest && stored.byteSize === row.byte_size && row.byte_digest === admission.asset.byteDigest;
    }
    if (v2.status === "available") {
      const head = await v2.client.readRange({ key: String(row.storage_key), contentType: "video/mp4", start: 0, end: 11 }).catch(() => null);
      if (head?.status === "range") storedMajorBrand = mp4MajorBrand(head.bytes);
    }
  }
  const read = await readMediaVideo(input.tenant, admission.asset.assetId, { getDb: input.getDb, resolveStorage: input.resolveStorageV1 });
  let rangeStatus: number | null = null;
  let rangeBytes: number | null = null;
  if (read.status === "read") {
    const part = await (input.rangeFetch ?? fetch)(read.access.url, { headers: { range: "bytes=0-1023" } });
    rangeStatus = part.status;
    rangeBytes = (await part.arrayBuffer()).byteLength;
  }
  return report("admitted", {
    ...base,
    storedVerified,
    storedMajorBrand,
    readModelOrigin: read.status === "read" ? read.video.origin : null,
    readModelInvocationLinked: read.status === "read" && read.video.invocationId === invocationId,
    rangeStatus,
    rangeBytes,
  });
}
