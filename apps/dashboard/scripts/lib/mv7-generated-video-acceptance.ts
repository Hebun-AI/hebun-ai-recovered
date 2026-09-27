/*
 * scripts/lib/mv7-generated-video-acceptance.ts — MV-7 real-provider acceptance, as testable steps.
 *
 * TWO STAGES, TWO DIRECTOR GATES.
 *
 *   reobserve   ONE status GET of an already-completed job. No generation POST is possible (the
 *               transport's budget is zero AND the guarded fetch refuses any POST before sending), no
 *               output byte is fetched, nothing is written anywhere. Reports the provider state and the
 *               output URL's SHAPE only: scheme, exact hostname, query parameter NAMES, path structure.
 *
 *   admit       Only once a Director-approved output host is in the transport's exact allowlist. A
 *               disposable Postgres + local store; the invocation is an ACCEPTANCE FIXTURE carrying the
 *               real request id as `provider-pending` (the dispatch happened in MV-6's destroyed
 *               disposable environment, not here); the REAL MV-4 poll moves it to provider-succeeded;
 *               the REAL admission writer admits; then storage, row, read model and Range are verified.
 *
 * Neither stage prints, logs or persists the output URL or a query value. Neither claims more than it
 * did: `reobserve` can say "provider output REOBSERVED" and nothing else.
 */
import type { HiggsfieldFetch } from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import type {
  MediaAsyncGenerationTransport,
  MediaProviderOutputShape,
} from "../../src/features/media-assets/async-generation-transport";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { MediaStorageV2Resolution } from "../../src/features/media-assets/media-storage.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import type { ProviderStreamDeps } from "../../src/features/media-assets/provider-output-download.server";
import { pollAsyncMediaGeneration } from "../../src/features/media-assets/async-generation-lifecycle.server";
import { admitGeneratedVideo, type AdmitGeneratedVideoResult } from "../../src/features/media-assets/admit-generated-video.server";
import { readMediaVideo } from "../../src/features/media-assets/read-media-videos.server";
import { mp4MajorBrand } from "../../src/features/media-assets/admit-supplied-drive-video.server";

export const MV7_ACCEPTANCE_REQUEST_ID = "f23c6488-d651-4acc-8cef-206ceb96cec7";
export const MV7_REOBSERVE_CONFIRMATION = "--confirm-one-status-read";
export const MV7_ADMIT_CONFIRMATION = "--confirm-one-output-fetch";

export interface GuardedFetchCounts {
  gets: number;
  posts: number;
  refused: number;
}

/**
 * A fetch that can only ever send `maxGets` GETs, each to one of `allowedUrls`. A POST is counted and
 * refused BEFORE anything is sent — a structural second lock under the zero spend budget.
 */
export function guardedHiggsfieldFetch(
  inner: HiggsfieldFetch,
  options: { readonly maxGets: number; readonly allowedUrls: readonly string[] },
): { readonly fetchImpl: HiggsfieldFetch; readonly counts: GuardedFetchCounts } {
  const counts: GuardedFetchCounts = { gets: 0, posts: 0, refused: 0 };
  const fetchImpl: HiggsfieldFetch = async (url, init) => {
    if (init.method !== "GET") {
      counts.posts += 1;
      counts.refused += 1;
      throw new Error("MV-7 acceptance: a non-GET request was refused before sending");
    }
    if (!options.allowedUrls.includes(url) || counts.gets >= options.maxGets) {
      counts.refused += 1;
      throw new Error("MV-7 acceptance: a GET outside the approved budget was refused before sending");
    }
    counts.gets += 1;
    return inner(url, init);
  };
  return { fetchImpl, counts };
}

export interface ReobservationReport {
  readonly reobserved: boolean;
  /** located | not-located | not-found | unreadable | refused */
  readonly outcome: string;
  /** For not-located: pending | failed | no-output. */
  readonly reason: string | null;
  readonly urlPresent: boolean;
  readonly shape: MediaProviderOutputShape | null;
  readonly gets: number;
  readonly posts: number;
}

export async function runReobservation(input: {
  readonly transport: MediaAsyncGenerationTransport;
  readonly requestId: string;
  readonly counts: GuardedFetchCounts;
}): Promise<ReobservationReport> {
  const base = { gets: 0, posts: 0 };
  if (typeof input.transport.locateOutput !== "function") {
    return { reobserved: false, outcome: "refused", reason: "output-location-unsupported", urlPresent: false, shape: null, ...base };
  }
  let r;
  try {
    r = await input.transport.locateOutput({ providerJobId: input.requestId });
  } catch {
    r = { status: "unreadable" as const };
  }
  const counted = { gets: input.counts.gets, posts: input.counts.posts };
  if (r.status === "located") {
    return { reobserved: true, outcome: "located", reason: null, urlPresent: true, shape: r.location.shape, ...counted };
  }
  if (r.status === "not-located") {
    return { reobserved: true, outcome: "not-located", reason: r.reason, urlPresent: false, shape: null, ...counted };
  }
  return { reobserved: false, outcome: r.status, reason: null, urlPresent: false, shape: null, ...counted };
}

/** Human-readable lines. Built from the report only, which holds no URL, path or query value. */
export function describeReobservation(r: ReobservationReport): string[] {
  const lines = [
    `request re-observed: ${r.reobserved ? "YES" : "NO"}`,
    `provider answer: ${r.outcome}${r.reason ? ` (${r.reason})` : ""}`,
    `output URL present: ${r.urlPresent ? "YES" : "NO"}`,
  ];
  if (r.shape) {
    lines.push(
      `scheme: ${r.shape.scheme}`,
      `hostname: ${r.shape.hostname}`,
      `explicit port: ${r.shape.hasPort ? "YES" : "NO"}; embedded credentials: ${r.shape.hasCredentials ? "YES" : "NO"}`,
      `query parameter names: ${r.shape.queryParameterNames.length > 0 ? r.shape.queryParameterNames.join(", ") : "(none)"}`,
      `path: ${r.shape.pathSegmentCount} segment(s); last-segment extension: ${r.shape.pathExtension ?? "(none)"}`,
    );
  }
  lines.push(`requests: ${r.gets} GET, ${r.posts} POST attempted (POST is refused before sending)`);
  lines.push(
    r.urlPresent
      ? "provider output REOBSERVED — no byte retrieved, validated, stored or admitted"
      : "provider output NOT reobserved — stop",
  );
  return lines;
}

/* ── STAGE 2: admission, on a disposable environment (separate Director gate) ─────────────── */

/** What the disposable environment provides. Built by tests/helpers/mv7-acceptance-environment.ts. */
export interface Mv7AdmissionEnvironment {
  readonly tenant: TenantContext;
  readonly getDb: () => ControlPlaneDatabase;
  readonly storageV1: () => MediaStorageResolution;
  readonly storageV2: () => MediaStorageV2Resolution;
  /** ACCEPTANCE FIXTURE: a `provider-pending` invocation carrying the real request id. */
  readonly seedPendingInvocation: (identity: { transport: string; provider: string; model: string }, requestId: string) => Promise<string>;
  readonly invocationRow: (id: string) => Promise<Record<string, unknown>>;
  readonly assetRows: (invocationId: string) => Promise<Record<string, unknown>[]>;
  readonly countMediaAssets: () => Promise<number>;
}

export interface AdmissionAcceptanceReport {
  readonly stop: "admitted" | "poll-not-succeeded" | "not-admitted";
  readonly pollOutcome: string;
  readonly admission: AdmitGeneratedVideoResult | null;
  readonly invocationAdmissionOutcome: string | null;
  readonly invocationAdmissionFailure: string | null;
  readonly mediaAssetsBefore: number;
  readonly mediaAssetsAfter: number;
  readonly storedVerified: boolean;
  /** The ISO-BMFF major brand read back from the STORED object's first 12 bytes. */
  readonly storedMajorBrand: string | null;
  readonly readModelOrigin: string | null;
  readonly readModelInvocationId: string | null;
  readonly grantIssued: boolean;
  readonly rangeStatus: number | null;
  readonly rangeBytes: number | null;
}

export async function runAdmissionAcceptance(input: {
  readonly env: Mv7AdmissionEnvironment;
  readonly transport: MediaAsyncGenerationTransport;
  readonly requestId: string;
  readonly download?: ProviderStreamDeps;
  readonly rangeFetch?: typeof fetch;
}): Promise<AdmissionAcceptanceReport> {
  const { env, transport } = input;
  const resolveTransport = () => ({ status: "available" as const, transport });
  const before = await env.countMediaAssets();
  const id = await env.seedPendingInvocation(transport, input.requestId);

  /* The REAL MV-4 writer owns provider-succeeded: one poll (a status GET). */
  const polled = await pollAsyncMediaGeneration(env.tenant, id, { getDb: env.getDb, resolveTransport });
  const pollOutcome = polled.status === "transitioned" ? polled.state : polled.status;
  const empty = {
    admission: null,
    invocationAdmissionOutcome: null,
    invocationAdmissionFailure: null,
    storedVerified: false,
    storedMajorBrand: null,
    readModelOrigin: null,
    readModelInvocationId: null,
    grantIssued: false,
    rangeStatus: null,
    rangeBytes: null,
  };
  if (pollOutcome !== "provider-succeeded") {
    return { stop: "poll-not-succeeded", pollOutcome, mediaAssetsBefore: before, mediaAssetsAfter: await env.countMediaAssets(), ...empty };
  }

  const admission = await admitGeneratedVideo(env.tenant, { invocationId: id }, {
    getDb: env.getDb,
    resolveStorageV2: env.storageV2,
    resolveTransport,
    download: input.download,
  });
  const inv = await env.invocationRow(id);
  const invocationAdmissionOutcome = String(inv.admission_outcome);
  const invocationAdmissionFailure = inv.admission_failure === null ? null : String(inv.admission_failure);
  const after = await env.countMediaAssets();
  if (admission.status !== "admitted") {
    return { stop: "not-admitted", pollOutcome, mediaAssetsBefore: before, mediaAssetsAfter: after, ...empty, admission, invocationAdmissionOutcome, invocationAdmissionFailure };
  }

  /* Verification, provider-free: the stored object, the row, the read model, one signed Range. */
  const rows = await env.assetRows(id);
  const row = rows[0];
  let storedVerified = false;
  const v1 = env.storageV1();
  if (row && rows.length === 1 && v1.status === "available") {
    const stored = await v1.store.verify(String(row.storage_key)).catch(() => null);
    storedVerified =
      stored?.status === "present" && stored.sha256Hex === row.byte_digest && stored.byteSize === row.byte_size && row.byte_digest === admission.asset.byteDigest;
  }
  let storedMajorBrand: string | null = null;
  const v2 = env.storageV2();
  if (row && v2.status === "available") {
    const head = await v2.client.readRange({ key: String(row.storage_key), contentType: "video/mp4", start: 0, end: 11 }).catch(() => null);
    if (head?.status === "range") storedMajorBrand = mp4MajorBrand(head.bytes);
  }
  const read = await readMediaVideo(env.tenant, admission.asset.assetId, { getDb: env.getDb, resolveStorage: env.storageV1 });
  let rangeStatus: number | null = null;
  let rangeBytes: number | null = null;
  if (read.status === "read") {
    const part = await (input.rangeFetch ?? fetch)(read.access.url, { headers: { range: "bytes=0-1023" } });
    rangeStatus = part.status;
    rangeBytes = (await part.arrayBuffer()).byteLength;
  }
  return {
    stop: "admitted",
    pollOutcome,
    admission,
    invocationAdmissionOutcome,
    invocationAdmissionFailure,
    mediaAssetsBefore: before,
    mediaAssetsAfter: after,
    storedVerified,
    storedMajorBrand,
    readModelOrigin: read.status === "read" ? read.video.origin : null,
    readModelInvocationId: read.status === "read" ? read.video.invocationId : null,
    grantIssued: read.status === "read" && read.access.url.length > 0,
    rangeStatus,
    rangeBytes,
  };
}
