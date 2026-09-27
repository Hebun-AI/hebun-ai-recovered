/*
 * scripts/lib/mv7-production-acceptance.ts — ONE production generation, re-observation, admission and
 * playback, as testable steps (MV-7 production acceptance).
 *
 * AN ORCHESTRATOR, NOT AN AUTHORITY. Every write is made by a released writer:
 *
 *   transport availability   the released video resolver (selection + key + the Director control)
 *   register/dispatch/poll    the MV-4 lifecycle writer, through `runGenerationAcceptance` (ONE dispatch)
 *   output location           the transport's `locateOutput` (one status GET)
 *   bytes, probe, admission   the MV-7 admission writer (download seam, Storage V2, MV-3 policy)
 *   playback                  the Media video read model's signed grant
 *
 * This module writes no row, holds no control, reads no configuration and decides no admission. It
 * STOPS — never retries, never dispatches again — at the first step that is not a success, and it
 * stops BEFORE any output byte is fetched when the output host is not the approved exact host.
 *
 * `guardProviderFetch` is a second lock under the transport's one-unit budget: it lets at most ONE
 * non-GET request reach the provider origin and refuses any other BEFORE sending.
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
import { runGenerationAcceptance, type GenerationAcceptanceEvidence, MV6_GENERATION_POLL } from "./mv6-generation-acceptance";

export const MV7_PRODUCTION_CONFIRMATION = "--confirm-one-billable-pixverse-job";
export const MV7_PRODUCTION_PROMPT = "A slow camera pan across a handwoven kilim rug on a wooden floor in soft daylight.";

export interface ProviderFetchCounts {
  posts: number;
  gets: number;
  refused: number;
}

/**
 * Wrap `fetch` so that requests to `providerOrigin` are counted, and at most ONE non-GET ever leaves.
 * A second non-GET is refused before sending. Requests elsewhere (the media store) pass through.
 */
export function guardProviderFetch(inner: typeof fetch, providerOrigin: string): { readonly fetchImpl: typeof fetch; readonly counts: ProviderFetchCounts } {
  const counts: ProviderFetchCounts = { posts: 0, gets: 0, refused: 0 };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(`${providerOrigin}/`)) {
      const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
      if (method === "GET") counts.gets += 1;
      else if (counts.posts >= 1) {
        counts.refused += 1;
        throw new Error("MV-7 production acceptance: a second provider write was refused before sending");
      } else counts.posts += 1;
    }
    return inner(input, init);
  }) as typeof fetch;
  return { fetchImpl, counts };
}

export interface ProductionAcceptanceInput {
  readonly tenant: TenantContext;
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly promptText: string;
  readonly requestKey: string;
  readonly getDb: () => ControlPlaneDatabase;
  readonly resolveTransport: () => Promise<MediaAsyncGenerationTransportResolution>;
  readonly resolveStorageV1: () => MediaStorageResolution;
  readonly resolveStorageV2: () => MediaStorageV2Resolution;
  readonly countMediaAssets: () => Promise<number>;
  readonly invocationRow: (id: string) => Promise<Record<string, unknown> | null>;
  readonly assetRows: (invocationId: string) => Promise<Record<string, unknown>[]>;
  readonly download?: ProviderStreamDeps;
  readonly rangeFetch?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly poll?: Partial<Record<keyof typeof MV6_GENERATION_POLL, number>>;
}

export type ProductionAcceptanceStop =
  | "transport-unavailable"
  | "generation-not-succeeded"
  | "output-not-located"
  | "host-not-approved"
  | "not-admitted"
  | "admitted";

export interface ProductionAcceptanceReport {
  readonly stop: ProductionAcceptanceStop;
  readonly detail: string | null;
  readonly model: string | null;
  readonly generation: GenerationAcceptanceEvidence | null;
  readonly locateOutcome: string | null;
  readonly outputShape: MediaProviderOutputShape | null;
  readonly admission: AdmitGeneratedVideoResult | null;
  readonly invocation: {
    readonly state: string | null;
    readonly admissionOutcome: string | null;
    readonly admissionFailure: string | null;
    readonly outputRefIsJobId: boolean | null;
  } | null;
  readonly assetsForInvocation: number;
  readonly storedVerified: boolean;
  readonly storedMajorBrand: string | null;
  readonly readModelOrigin: string | null;
  readonly readModelInvocationLinked: boolean;
  readonly grantIssued: boolean;
  readonly rangeStatus: number | null;
  readonly rangeBytes: number | null;
}

const EMPTY = {
  detail: null,
  model: null,
  generation: null,
  locateOutcome: null,
  outputShape: null,
  admission: null,
  invocation: null,
  assetsForInvocation: 0,
  storedVerified: false,
  storedMajorBrand: null,
  readModelOrigin: null,
  readModelInvocationLinked: false,
  grantIssued: false,
  rangeStatus: null,
  rangeBytes: null,
} as const;

export async function runProductionAcceptance(input: ProductionAcceptanceInput): Promise<ProductionAcceptanceReport> {
  /* 1. The released resolver decides whether a live transport exists — the Director control included. */
  const resolution = await input.resolveTransport();
  if (resolution.status !== "available") return { ...EMPTY, stop: "transport-unavailable", detail: resolution.reason };
  const transport = resolution.transport;
  const model = transport.model;

  /* 2. Register → ONE dispatch → bounded polling, all by the MV-4 writer. */
  const generation = await runGenerationAcceptance({
    tenant: input.tenant,
    artifactId: input.artifactId,
    revisionNo: input.revisionNo,
    promptText: input.promptText,
    requestKey: input.requestKey,
    getDb: input.getDb,
    transport,
    countMediaAssets: input.countMediaAssets,
    sleep: input.sleep,
    poll: input.poll,
  });
  const invocationFacts = async (id: string | null) => {
    const row = id ? await input.invocationRow(id) : null;
    if (!row) return null;
    return {
      state: row.state === null ? null : String(row.state),
      admissionOutcome: row.admission_outcome === null ? null : String(row.admission_outcome),
      admissionFailure: row.admission_failure === null ? null : String(row.admission_failure),
      outputRefIsJobId: row.provider_output_ref === null ? null : row.provider_output_ref === row.provider_job_id,
    };
  };
  if (generation.stop !== "terminal" || generation.finalState !== "provider-succeeded" || !generation.invocationId || !generation.providerJobId) {
    return { ...EMPTY, stop: "generation-not-succeeded", detail: generation.detail ?? generation.stop, model, generation, invocation: await invocationFacts(generation.invocationId) };
  }
  const invocationId = generation.invocationId;

  /* 3. Re-observe: where is the output, and is its host the approved exact host? No byte yet. */
  if (typeof transport.locateOutput !== "function") {
    return { ...EMPTY, stop: "output-not-located", detail: "output-location-unsupported", model, generation, invocation: await invocationFacts(invocationId) };
  }
  let located;
  try {
    located = await transport.locateOutput({ providerJobId: generation.providerJobId });
  } catch {
    located = { status: "unreadable" as const };
  }
  if (located.status !== "located") {
    const detail = located.status === "not-located" ? located.reason : located.status;
    return { ...EMPTY, stop: "output-not-located", detail, model, generation, locateOutcome: located.status, invocation: await invocationFacts(invocationId) };
  }
  const shape = located.location.shape;
  if (!located.location.allowedHosts.includes(shape.hostname)) {
    return { ...EMPTY, stop: "host-not-approved", detail: shape.hostname, model, generation, locateOutcome: "located", outputShape: shape, invocation: await invocationFacts(invocationId) };
  }

  /* 4. Admission, by the MV-7 writer: one bounded fetch, Storage V2, probe, policy, one transaction. */
  const admission = await admitGeneratedVideo(input.tenant, { invocationId }, {
    getDb: input.getDb,
    resolveStorageV2: input.resolveStorageV2,
    resolveTransport: () => resolution,
    download: input.download,
  });
  const invocation = await invocationFacts(invocationId);
  const rows = await input.assetRows(invocationId);
  const base = { ...EMPTY, model, generation, locateOutcome: "located", outputShape: shape, admission, invocation, assetsForInvocation: rows.length };
  if (admission.status !== "admitted") return { ...base, stop: "not-admitted", detail: admission.status === "existing" ? "existing" : null };

  /* 5. Provider-free verification: the stored object, its brand, the read model, one signed Range. */
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
  return {
    ...base,
    stop: "admitted",
    storedVerified,
    storedMajorBrand,
    readModelOrigin: read.status === "read" ? read.video.origin : null,
    readModelInvocationLinked: read.status === "read" && read.video.invocationId === invocationId,
    grantIssued: read.status === "read" && read.access.url.length > 0,
    rangeStatus,
    rangeBytes,
  };
}
