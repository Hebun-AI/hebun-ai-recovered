/*
 * media-assets/async-generation-lifecycle.server.ts — THE writer of the asynchronous generation
 * lifecycle on `media_generation_invocations` (MV-4).
 *
 * One authority, extended: an asynchronous attempt is the same invocation row the synchronous path
 * writes, carrying `output_media_kind` and the provider-side facts of a long-running job. There is no
 * second job table and no second writer. The synchronous path (`request-media-generation.server.ts`)
 * keeps owning its own `registered → terminal` transitions; every transition below is owned here.
 *
 * ── THE LIFECYCLE ───────────────────────────────────────────────────────────
 *
 *   registered ──► dispatching ──► provider-pending ──► provider-succeeded
 *                       │                  │   ▲ poll        (output reference only)
 *                       │                  │   └─ pending: last_polled_at, poll_count
 *                       │                  └──────────────► provider-failed
 *                       ├──────────────────────────────────► provider-failed   (provider rejected)
 *                       └──────────────────────────────────► dispatch-unknown  (terminal in MV-4)
 *
 * EVERY TRANSITION IS COMPARE-AND-SWAP: `UPDATE … WHERE tenant_id = ? AND id = ? AND state = <from>`.
 * A write that finds the row elsewhere changes nothing and reports `no-transition` with the state it
 * found. That is what makes a repeated or concurrent poll, or a duplicate completion observation, a
 * no-op instead of a second transition. Terminal states have no outgoing edge here, so nothing moves
 * them.
 *
 * INTENT IS PERSISTED BEFORE THE EXTERNAL CALL. `dispatching` is written first; only a row this call
 * moved into `dispatching` is dispatched. If the process dies mid-call the row says "may have been
 * sent", which is true, rather than "registered", which would claim it was not.
 *
 * DISPATCH-UNKNOWN IS NOT FAILURE. A thrown or timed-out dispatch, or an acceptance that names no
 * usable job, lands in `dispatch-unknown` with no failure code. It is not retried — not here, not by
 * any caller: a second attempt is a new human request with a new request key.
 *
 * PROVIDER COMPLETION IS NOT MEDIA ADMISSION. `provider-succeeded` records the provider's OPAQUE output
 * reference and the moment Hebun observed completion. It does not retrieve, verify, store or admit.
 * This module never writes `media_assets`, and never touches `admission_outcome`.
 *
 * GOVERNANCE IS NOT CONSULTED — the existing generation boundary, unchanged: an authenticated human
 * requests, a durable agent is the author, the source is this tenant's draft revision. Authorization
 * of real paid/external dispatch is deferred to MV-6 by Director decision. The transport performs a
 * dispatch; it never authorizes one.
 *
 * NEVER WRITTEN HERE: `media_assets`, the draft, a Governance decision, an action request, a permit, an
 * execution attempt, a URL, or a credential.
 *
 * Server-only.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaGenerationInvocations } from "@/db/schema/media-asset";
import { workArtifactRevisions, workArtifacts } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveAgentAuthorship } from "@/features/work-artifacts/agent-authorship.server";
import {
  MEDIA_ASSET_LIMITS,
  MEDIA_GENERATION_TRANSPORTS,
  MEDIA_PROVIDER_FAILURES,
  countCodePoints,
  isUuid,
  type MediaInvocationState,
} from "./contracts";
import { digestImageToVideoInput, digestVideoGenerationInput } from "./input-digest";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { readVerifiedSourceImage, selectEligibleSourceImageRow } from "./read-verified-source-image.server";
import type {
  MediaAsyncDispatchOutcome,
  MediaAsyncGenerationTransport,
  MediaAsyncGenerationTransportResolution,
  MediaAsyncInputMode,
  MediaAsyncPollOutcome,
  MediaAsyncProviderFailure,
  MediaAsyncTransportRequest,
  MediaPreparedSourceImage,
} from "./async-generation-transport";
import { resolveMediaAsyncGenerationTransport } from "./async-generation-transport.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import { isExternalGenerativeUseCleared, type RecordedDataUseDecision } from "./external-generative-data-use";
import { resolveExternalGenerativeEligibility } from "./external-generative-eligibility.server";

export interface AsyncGenerationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /** IMAGE → VIDEO: the resolver is told which input mode the attempt needs. Absent = `text`. */
  readonly resolveTransport?: (
    request?: MediaAsyncTransportRequest,
  ) => MediaAsyncGenerationTransportResolution | Promise<MediaAsyncGenerationTransportResolution>;
  /** IMAGE → VIDEO: the private Media store the source image is read from (never a URL). */
  readonly resolveStorage?: () => MediaStorageResolution;
  /** DATA-USE-MEDIA-GUARD-1 — tests only; no application door passes it. */
  readonly dataUseDecisions?: readonly RecordedDataUseDecision[];
}

export type AsyncGenerationRefusal =
  | "unauthenticated"
  | "invalid-input"
  | "generation-transport-unavailable"
  | "persistence-unavailable"
  | "no-durable-agent"
  | "source-revision-unresolvable"
  | "duplicate-request"
  | "invocation-not-found"
  | "transport-mismatch"
  /* IMAGE → VIDEO — the MEDIA-5 source eligibility, refused before any row or provider call. */
  | "source-asset-unresolvable"
  | "source-asset-not-image"
  | "source-asset-retired"
  | "source-asset-unavailable"
  | "storage-unavailable"
  /* DATA-USE-MEDIA-GUARD-1 — no recorded data-use decision allows this source for this provider. */
  | "source-data-use-not-cleared"
  /* IMAGE → VIDEO — after registration, before any generation POST. Nothing was generated. */
  | "source-type-unsupported"
  | "source-upload-refused"
  | "source-upload-unknown"
  /** A row that names a source image cannot be dispatched without its prepared source (and vice versa). */
  | "source-not-prepared";

export interface RegisterAsyncGenerationInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly promptText: string;
  readonly requestKey: string;
  /**
   * IMAGE → VIDEO. The admitted image this video is generated FROM — an asset id, never a URL. When
   * present, the attempt needs an `image` transport and records the MEDIA-5 lineage column
   * `source_media_asset_id`. Absent: text-to-video, byte-identical to before.
   */
  readonly sourceAssetId?: string | null;
}

export type RegisterAsyncGenerationResult =
  | { readonly status: "refused"; readonly reason: AsyncGenerationRefusal }
  | { readonly status: "registered"; readonly invocationId: string };

export type AsyncTransitionResult =
  | { readonly status: "refused"; readonly reason: AsyncGenerationRefusal }
  /** The row was not where this step starts; nothing was written and nothing was called. */
  | { readonly status: "no-transition"; readonly state: MediaInvocationState }
  /** The step ran. `state` is what the row now holds (or would, if the final write failed). */
  | { readonly status: "transitioned"; readonly from: MediaInvocationState; readonly state: MediaInvocationState }
  /** A poll READ the provider saying the job is still pending; only the observation counters moved. */
  | { readonly status: "observed-pending"; readonly state: "provider-pending" }
  /**
   * MV-6: a poll was made but no authoritative answer was read — a network failure, an unreadable
   * body, or a provider answer the lifecycle cannot record (e.g. the provider no longer answers for a
   * known job id). The row stays `provider-pending`, the last provider fact Hebun holds; only the
   * observation counters moved. It is NOT "still pending", and it is NOT a failure.
   */
  | { readonly status: "observation-unreadable"; readonly state: "provider-pending" };

/** Mirrors `media_generation_invocations_output_ref_chk`: opaque, bounded, and never a URL. */
export const PROVIDER_OUTPUT_REF_RE = /^[A-Za-z0-9._:-]{1,256}$/;
const PROVIDER_JOB_ID_MAX = 256;

function refused(reason: AsyncGenerationRefusal): { status: "refused"; reason: AsyncGenerationRefusal } {
  return { status: "refused", reason };
}

function closedFailure(failure: unknown): MediaAsyncProviderFailure {
  return (MEDIA_PROVIDER_FAILURES as readonly string[]).includes(failure as string) && failure !== "dispatch-error"
    ? (failure as MediaAsyncProviderFailure)
    : "malformed-response";
}

function usableJobId(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= PROVIDER_JOB_ID_MAX ? value : null;
}

async function resolveTransport(
  deps: AsyncGenerationDeps,
  inputMode: MediaAsyncInputMode = "text",
): Promise<MediaAsyncGenerationTransport | null> {
  let resolution: MediaAsyncGenerationTransportResolution;
  try {
    resolution = await (deps.resolveTransport ?? ((request) => resolveMediaAsyncGenerationTransport({}, request)))({ inputMode });
  } catch {
    return null;
  }
  if (resolution.status !== "available") return null;
  const t = resolution.transport;
  if (!(MEDIA_GENERATION_TRANSPORTS as readonly string[]).includes(t.transport) || t.outputMediaKind !== "video") return null;
  /* IMAGE → VIDEO: a transport answers only for the input mode it declares. */
  if ((t.inputMode ?? "text") !== inputMode) return null;
  if (inputMode === "image" && typeof t.prepareSourceImage !== "function") return null;
  return t;
}

/* ── Registration: the idempotent boundary, BEFORE anything is dispatched ───── */

export async function registerAsyncMediaGeneration(
  tenant: TenantContext | null,
  input: RegisterAsyncGenerationInput | null,
  deps: AsyncGenerationDeps = {},
): Promise<RegisterAsyncGenerationResult> {
  if (typeof window !== "undefined") throw new Error("Media generation is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (
    !input ||
    !isUuid(input.artifactId) ||
    !isUuid(input.requestKey) ||
    !Number.isSafeInteger(input.revisionNo) ||
    input.revisionNo < 1 ||
    typeof input.promptText !== "string" ||
    input.promptText.trim().length === 0 ||
    countCodePoints(input.promptText) > MEDIA_ASSET_LIMITS.maxPromptCodePoints
  ) {
    return refused("invalid-input");
  }

  const sourceAssetId = input.sourceAssetId ?? null;
  if (sourceAssetId !== null && !isUuid(sourceAssetId)) return refused("source-asset-unresolvable");
  const transport = await resolveTransport(deps, sourceAssetId === null ? "text" : "image");
  if (!transport) return refused("generation-transport-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = deps.now ?? (() => new Date());

  /*
   * IMAGE → VIDEO: the source's eligibility and digest are read from the Media row HERE, so the
   * recorded lineage and input identity name the admitted bytes. (The bytes themselves are verified
   * by `requestAsyncVideoGeneration` before this call and again never trusted from the store.)
   */
  let sourceDigest: string | null = null;
  if (sourceAssetId !== null) {
    let eligible;
    try {
      eligible = await selectEligibleSourceImageRow(db, tenant.tenantId, sourceAssetId);
    } catch {
      return refused("persistence-unavailable");
    }
    if (eligible.status === "refused") return refused(eligible.reason);
    sourceDigest = eligible.byteDigest;

    /*
     * DATA-USE-MEDIA-GUARD-1 — custody is not permission to hand the image to an external model. The
     * provider is the resolved transport's own; the recorded decision for it, `image-to-video` and the
     * source's lineage must be `allowed`. Refused here, before any row and before the upload that is
     * the first byte to leave Hebun. The provider switch being on changes nothing about this.
     */
    let dataUse;
    try {
      dataUse = await resolveExternalGenerativeEligibility(
        db,
        tenant.tenantId,
        sourceAssetId,
        { provider: transport.provider, purpose: "image-to-video" },
        { dataUseDecisions: deps.dataUseDecisions },
      );
    } catch {
      return refused("persistence-unavailable");
    }
    if (!isExternalGenerativeUseCleared(dataUse)) return refused("source-data-use-not-cleared");
  }

  const authorship = await resolveAgentAuthorship(tenant, { getDb: () => db });
  if (authorship.status !== "resolved") return refused("no-durable-agent");

  /* The same source rule the synchronous path applies: THIS tenant's content-draft, still a draft. */
  let source: { readonly contentDigest: string } | undefined;
  try {
    source = (
      await db
        .select({ contentDigest: workArtifactRevisions.contentDigest })
        .from(workArtifactRevisions)
        .innerJoin(
          workArtifacts,
          and(eq(workArtifacts.id, workArtifactRevisions.artifactId), eq(workArtifacts.tenantId, workArtifactRevisions.tenantId)),
        )
        .where(
          and(
            eq(workArtifactRevisions.tenantId, tenant.tenantId),
            eq(workArtifactRevisions.artifactId, input.artifactId),
            eq(workArtifactRevisions.revisionNo, input.revisionNo),
            eq(workArtifacts.artifactType, "content-draft"),
            eq(workArtifacts.artifactLifecycleStatus, "draft"),
          ),
        )
        .limit(1)
    )[0];
  } catch {
    return refused("persistence-unavailable");
  }
  if (!source) return refused("source-revision-unresolvable");

  const identity = {
    promptText: input.promptText,
    sourceArtifactId: input.artifactId,
    sourceRevisionNo: input.revisionNo,
    sourceContentDigest: source.contentDigest,
    transport: transport.transport,
    provider: transport.provider,
    model: transport.model,
  };
  /* v3 for text-to-video, unchanged; v4 exactly when a source image is named. */
  const inputDigest =
    sourceAssetId !== null && sourceDigest !== null
      ? digestImageToVideoInput({ ...identity, sourceAsset: { assetId: sourceAssetId, byteDigest: sourceDigest } })
      : digestVideoGenerationInput(identity);

  let invocationId: string | undefined;
  try {
    invocationId = (
      await db
        .insert(mediaGenerationInvocations)
        .values({
          tenantId: tenant.tenantId,
          requestKey: input.requestKey,
          requestedByActorType: "human",
          requestedByActorId: tenant.userId,
          agentId: authorship.authorship.agentId,
          sourceArtifactId: input.artifactId,
          sourceRevisionNo: input.revisionNo,
          /* MEDIA-5 lineage, reused: null for text-to-video, the source image for image-to-video. */
          sourceMediaAssetId: sourceAssetId === null ? null : sourceAssetId.toLowerCase(),
          promptText: input.promptText,
          inputDigest,
          transport: transport.transport,
          provider: transport.provider,
          model: transport.model,
          outputMediaKind: "video",
          state: "registered",
          requestedAt: now(),
        })
        .onConflictDoNothing({ target: [mediaGenerationInvocations.tenantId, mediaGenerationInvocations.requestKey] })
        .returning({ id: mediaGenerationInvocations.id })
    )[0]?.id;
  } catch {
    return refused("persistence-unavailable");
  }
  if (!invocationId) return refused("duplicate-request");
  return { status: "registered", invocationId };
}

/* ── Shared: the tenant-scoped row, and the one CAS primitive ─────────────── */

interface AsyncRow {
  readonly state: MediaInvocationState;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
  readonly outputMediaKind: string;
  readonly providerJobId: string | null;
  readonly promptText: string;
  readonly inputDigest: string;
  readonly sourceMediaAssetId: string | null;
}

async function loadRow(db: ControlPlaneDatabase, tenantId: string, invocationId: string): Promise<AsyncRow | null> {
  const rows = await db
    .select({
      state: mediaGenerationInvocations.state,
      transport: mediaGenerationInvocations.transport,
      provider: mediaGenerationInvocations.provider,
      model: mediaGenerationInvocations.model,
      outputMediaKind: mediaGenerationInvocations.outputMediaKind,
      providerJobId: mediaGenerationInvocations.providerJobId,
      promptText: mediaGenerationInvocations.promptText,
      inputDigest: mediaGenerationInvocations.inputDigest,
      sourceMediaAssetId: mediaGenerationInvocations.sourceMediaAssetId,
    })
    .from(mediaGenerationInvocations)
    .where(and(eq(mediaGenerationInvocations.tenantId, tenantId), eq(mediaGenerationInvocations.id, invocationId)))
    .limit(1);
  return (rows[0] as AsyncRow | undefined) ?? null;
}

type InvocationPatch = Partial<typeof mediaGenerationInvocations.$inferInsert>;

/** THE compare-and-swap. True only when this call moved the row out of `from`. */
async function cas(
  db: ControlPlaneDatabase,
  tenantId: string,
  invocationId: string,
  from: MediaInvocationState,
  patch: InvocationPatch,
): Promise<boolean> {
  const moved = await db
    .update(mediaGenerationInvocations)
    .set(patch)
    .where(
      and(
        eq(mediaGenerationInvocations.tenantId, tenantId),
        eq(mediaGenerationInvocations.id, invocationId),
        eq(mediaGenerationInvocations.state, from),
        eq(mediaGenerationInvocations.outputMediaKind, "video"),
      ),
    )
    .returning({ id: mediaGenerationInvocations.id });
  return moved.length === 1;
}

async function prelude(
  tenant: TenantContext | null,
  invocationId: string,
  deps: AsyncGenerationDeps,
): Promise<
  | { readonly ok: false; readonly result: AsyncTransitionResult }
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly tenantId: string; readonly row: AsyncRow; readonly transport: MediaAsyncGenerationTransport; readonly now: () => Date }
> {
  if (!tenant?.tenantId || !tenant.userId) return { ok: false, result: refused("unauthenticated") };
  if (!isUuid(invocationId)) return { ok: false, result: refused("invocation-not-found") };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { ok: false, result: refused("persistence-unavailable") };
  let row: AsyncRow | null;
  try {
    row = await loadRow(db, tenant.tenantId, invocationId);
  } catch {
    return { ok: false, result: refused("persistence-unavailable") };
  }
  if (!row || row.outputMediaKind !== "video") return { ok: false, result: refused("invocation-not-found") };
  /* The transport is resolved for the input mode this attempt was registered with. */
  const transport = await resolveTransport(deps, row.sourceMediaAssetId === null ? "text" : "image");
  if (!transport) return { ok: false, result: refused("generation-transport-unavailable") };
  /* A job is only ever advanced through the transport identity it was registered with. */
  if (transport.transport !== row.transport || transport.provider !== row.provider || transport.model !== row.model) {
    return { ok: false, result: refused("transport-mismatch") };
  }
  return { ok: true, db, tenantId: tenant.tenantId, row, transport, now: deps.now ?? (() => new Date()) };
}

/* ── Dispatch: registered → dispatching → pending | failed | unknown ───────── */

export async function dispatchAsyncMediaGeneration(
  tenant: TenantContext | null,
  invocationId: string,
  deps: AsyncGenerationDeps = {},
  /**
   * IMAGE → VIDEO. The source prepared for THIS attempt, in this process, moments ago. Never read from
   * a row: the provider-facing URL is transport data and is not persisted.
   */
  options: { readonly source?: MediaPreparedSourceImage } = {},
): Promise<AsyncTransitionResult> {
  if (typeof window !== "undefined") throw new Error("Media generation is server-only.");
  const p = await prelude(tenant, invocationId, deps);
  if (!p.ok) return p.result;
  const { db, tenantId, row, transport, now } = p;
  if (row.state !== "registered") return { status: "no-transition", state: row.state };
  /* A source-image attempt is dispatched only with its prepared source; a text attempt never with one. */
  if ((row.sourceMediaAssetId !== null) !== (options.source !== undefined)) return refused("source-not-prepared");

  /* Intent first. Only the call that moves the row into `dispatching` may dispatch it. */
  let claimed: boolean;
  try {
    claimed = await cas(db, tenantId, invocationId, "registered", { state: "dispatching" });
  } catch {
    return refused("persistence-unavailable");
  }
  if (!claimed) {
    const current = await loadRow(db, tenantId, invocationId).catch(() => null);
    return { status: "no-transition", state: current?.state ?? row.state };
  }

  let outcome: MediaAsyncDispatchOutcome;
  try {
    outcome = await transport.dispatch({
      promptText: row.promptText,
      inputDigest: row.inputDigest,
      invocationId,
      ...(options.source ? { source: options.source } : {}),
    });
  } catch {
    /* It may have left Hebun. A throw is ambiguous, never a failure. */
    outcome = { status: "unknown" };
  }

  let to: MediaInvocationState;
  let patch: InvocationPatch;
  const at = now();
  const jobId = outcome.status === "accepted" ? usableJobId(outcome.providerJobId) : null;
  if (outcome.status === "accepted" && jobId) {
    to = "provider-pending";
    patch = { state: to, providerJobId: jobId, providerAcceptedAt: at };
  } else if (outcome.status === "rejected") {
    to = "provider-failed";
    patch = {
      state: to,
      providerFailure: closedFailure(outcome.failure),
      providerJobId: usableJobId(outcome.providerJobId),
      finalizedAt: at,
    };
  } else {
    /* `unknown`, or an acceptance naming no job Hebun could ever poll: fate unknowable. */
    to = "dispatch-unknown";
    patch = { state: to, finalizedAt: at };
  }
  try {
    await cas(db, tenantId, invocationId, "dispatching", patch);
  } catch {
    /* The row stays `dispatching` — "may have been sent" — which remains true. */
  }
  return { status: "transitioned", from: "registered", state: to };
}

/*
 * ── VIDEO CONTENT CHAIN: the human request, as ONE register-then-dispatch ────
 *
 * The application door's whole use of this lifecycle: register (the idempotent boundary) and, only
 * for the row THIS call registered, dispatch it once. Both steps are the functions above, unchanged;
 * this adds no transition, no writer and no retry. A duplicate request key registers nothing and
 * therefore dispatches nothing. A registered row whose dispatch was refused before any call (e.g. the
 * transport became unavailable between the two steps) stays `registered` — nothing was sent — and is
 * reported as exactly that, never as a failure.
 */
export type RequestAsyncVideoGenerationResult =
  | { readonly status: "refused"; readonly reason: AsyncGenerationRefusal }
  | { readonly status: "registered-not-sent"; readonly invocationId: string; readonly reason: AsyncGenerationRefusal }
  | { readonly status: "dispatched"; readonly invocationId: string; readonly state: MediaInvocationState };

export async function requestAsyncVideoGeneration(
  tenant: TenantContext | null,
  input: RegisterAsyncGenerationInput | null,
  deps: AsyncGenerationDeps = {},
): Promise<RequestAsyncVideoGenerationResult> {
  if (typeof window !== "undefined") throw new Error("Media generation is server-only.");

  /*
   * IMAGE → VIDEO, before anything is recorded: the source image is read from the PRIVATE Media store
   * and its size and SHA-256 are verified against its row (MEDIA-5 semantics). A mismatch registers
   * nothing and sends nothing.
   */
  const sourceAssetId = input?.sourceAssetId ?? null;
  let verified: { readonly bytes: Uint8Array; readonly mimeType: string } | null = null;
  if (sourceAssetId !== null) {
    if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
    const db = (deps.getDb ?? resolveMediaDbOrNull)();
    if (!db) return refused("persistence-unavailable");
    const read = await readVerifiedSourceImage(db, (deps.resolveStorage ?? resolveMediaObjectStore)(), tenant.tenantId, sourceAssetId);
    if (read.status === "refused") return refused(read.reason);
    verified = { bytes: read.source.bytes, mimeType: read.source.mimeType };
  }

  const registered = await registerAsyncMediaGeneration(tenant, input, deps);
  if (registered.status !== "registered") return registered;

  /*
   * IMAGE → VIDEO, after the intent is recorded and before the generation POST: the transport hands
   * the verified bytes to the provider's documented upload. Its URL stays inside the prepared source.
   * Any refusal leaves the row `registered` — no generation was requested — and nothing is retried.
   */
  let source: MediaPreparedSourceImage | undefined;
  if (verified !== null) {
    const transport = await resolveTransport(deps, "image");
    if (!transport?.prepareSourceImage) {
      return { status: "registered-not-sent", invocationId: registered.invocationId, reason: "generation-transport-unavailable" };
    }
    let prepared;
    try {
      prepared = await transport.prepareSourceImage({ bytes: verified.bytes, contentType: verified.mimeType });
    } catch {
      prepared = { status: "refused" as const, reason: "upload-unknown" as const };
    }
    if (prepared.status !== "prepared") {
      const reason: AsyncGenerationRefusal =
        prepared.reason === "unsupported-type" ? "source-type-unsupported" : prepared.reason === "upload-refused" ? "source-upload-refused" : "source-upload-unknown";
      return { status: "registered-not-sent", invocationId: registered.invocationId, reason };
    }
    source = prepared.source;
  }

  const dispatched = await dispatchAsyncMediaGeneration(tenant, registered.invocationId, deps, source ? { source } : {});
  if (dispatched.status === "refused") {
    return { status: "registered-not-sent", invocationId: registered.invocationId, reason: dispatched.reason };
  }
  return { status: "dispatched", invocationId: registered.invocationId, state: dispatched.state };
}

/* ── Poll: provider-pending → pending (observed) | succeeded | failed ──────── */

export async function pollAsyncMediaGeneration(
  tenant: TenantContext | null,
  invocationId: string,
  deps: AsyncGenerationDeps = {},
): Promise<AsyncTransitionResult> {
  if (typeof window !== "undefined") throw new Error("Media generation is server-only.");
  const p = await prelude(tenant, invocationId, deps);
  if (!p.ok) return p.result;
  const { db, tenantId, row, transport, now } = p;
  /* Only a pending job is polled. A terminal job is never asked again. */
  if (row.state !== "provider-pending" || !row.providerJobId) return { status: "no-transition", state: row.state };

  let observation: MediaAsyncPollOutcome | null;
  try {
    observation = await transport.poll({ providerJobId: row.providerJobId });
  } catch {
    observation = null;
  }

  const at = now();
  const counted: InvocationPatch = { lastPolledAt: at, pollCount: sql`${mediaGenerationInvocations.pollCount} + 1` as never };
  let to: MediaInvocationState;
  let patch: InvocationPatch;
  if (observation?.status === "succeeded") {
    if (typeof observation.outputRef === "string" && PROVIDER_OUTPUT_REF_RE.test(observation.outputRef)) {
      to = "provider-succeeded";
      /* Provider completion only. `admission_outcome` stays `not-attempted`; no asset exists. */
      patch = { ...counted, state: to, providerOutputRef: observation.outputRef, providerCompletedAt: at, finalizedAt: at };
    } else {
      to = "provider-failed";
      patch = { ...counted, state: to, providerFailure: "malformed-response", providerCompletedAt: at, finalizedAt: at };
    }
  } else if (observation?.status === "failed") {
    to = "provider-failed";
    patch = { ...counted, state: to, providerFailure: closedFailure(observation.failure), providerCompletedAt: at, finalizedAt: at };
  } else {
    /* Still pending, or unreadable: an observation, not a transition. Which one is reported below. */
    to = "provider-pending";
    patch = counted;
  }

  let moved: boolean;
  try {
    moved = await cas(db, tenantId, invocationId, "provider-pending", patch);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!moved) {
    /* Someone else's observation landed first. Ours changes nothing. */
    const current = await loadRow(db, tenantId, invocationId).catch(() => null);
    return { status: "no-transition", state: current?.state ?? row.state };
  }
  if (to !== "provider-pending") return { status: "transitioned", from: "provider-pending", state: to };
  return observation?.status === "pending"
    ? { status: "observed-pending", state: "provider-pending" }
    : { status: "observation-unreadable", state: "provider-pending" };
}

/* ── Read: what Hebun knows about one asynchronous attempt ────────────────── */

export interface AsyncGenerationView {
  readonly invocationId: string;
  readonly outputMediaKind: "video";
  readonly state: MediaInvocationState;
  /** `fake` is SIMULATED — a test transport, never a provider's answer. */
  readonly simulated: boolean;
  readonly provider: string;
  readonly model: string;
  readonly providerAcceptedAt: string | null;
  readonly providerCompletedAt: string | null;
  readonly lastPolledAt: string | null;
  readonly pollCount: number;
  readonly providerFailure: string | null;
  /** True when the provider reported an output reference. NOT a Media asset. */
  readonly providerOutputReported: boolean;
  readonly admissionOutcome: string;
}

export type ReadAsyncGenerationResult =
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly generation: AsyncGenerationView };

export async function readAsyncMediaGeneration(
  tenant: TenantContext | null,
  invocationId: string,
  deps: Pick<AsyncGenerationDeps, "getDb"> = {},
): Promise<ReadAsyncGenerationResult> {
  if (typeof window !== "undefined") throw new Error("Media generation reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };
  if (!isUuid(invocationId)) return { status: "not-found" };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable" };
  const t = mediaGenerationInvocations;
  let r;
  try {
    r = (
      await db
        .select({
          id: t.id,
          outputMediaKind: t.outputMediaKind,
          state: t.state,
          transport: t.transport,
          provider: t.provider,
          model: t.model,
          providerAcceptedAt: t.providerAcceptedAt,
          providerCompletedAt: t.providerCompletedAt,
          lastPolledAt: t.lastPolledAt,
          pollCount: t.pollCount,
          providerFailure: t.providerFailure,
          providerOutputRef: t.providerOutputRef,
          admissionOutcome: t.admissionOutcome,
        })
        .from(t)
        .where(and(eq(t.tenantId, tenant.tenantId), eq(t.id, invocationId), eq(t.outputMediaKind, "video")))
        .limit(1)
    )[0];
  } catch {
    return { status: "unavailable" };
  }
  if (!r) return { status: "not-found" };
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    status: "read",
    generation: {
      invocationId: r.id,
      outputMediaKind: "video",
      state: r.state as MediaInvocationState,
      simulated: r.transport === "fake",
      provider: r.provider,
      model: r.model,
      providerAcceptedAt: iso(r.providerAcceptedAt),
      providerCompletedAt: iso(r.providerCompletedAt),
      lastPolledAt: iso(r.lastPolledAt),
      pollCount: r.pollCount,
      providerFailure: r.providerFailure,
      providerOutputReported: r.providerOutputRef !== null,
      admissionOutcome: r.admissionOutcome,
    },
  };
}

/*
 * ── VIDEO CONTENT CHAIN: every video attempt of several drafts, in one read ──
 *
 * The same view as `readAsyncMediaGeneration`, listed per draft so a human can see what they asked
 * for and where each attempt stands. A READ: it moves nothing, calls no provider and resolves no
 * transport. The provider output reference stays inside this module — only whether one was reported.
 * `sourceRevisionNo` is the invocation's own source revision (provenance), never "the current one".
 */
export interface AsyncGenerationListing {
  readonly status: "read";
  readonly generations: readonly (AsyncGenerationView & {
    readonly sourceArtifactId: string;
    readonly sourceRevisionNo: number;
    readonly requestedAt: string;
    /** IMAGE → VIDEO: the MEDIA-5 lineage — the admitted image this video is generated from, or null. */
    readonly sourceMediaAssetId: string | null;
  })[];
}

export async function listArtifactVideoGenerations(
  tenant: TenantContext | null,
  input: { readonly artifactIds: readonly string[] } | null,
  deps: Pick<AsyncGenerationDeps, "getDb"> = {},
): Promise<AsyncGenerationListing | { readonly status: "unavailable" }> {
  if (typeof window !== "undefined") throw new Error("Media generation reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const ids = (input?.artifactIds ?? []).filter(isUuid);
  if (ids.length === 0) return { status: "read", generations: [] };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable" };
  const t = mediaGenerationInvocations;
  let rows;
  try {
    rows = await db
      .select({
        id: t.id,
        state: t.state,
        transport: t.transport,
        provider: t.provider,
        model: t.model,
        providerAcceptedAt: t.providerAcceptedAt,
        providerCompletedAt: t.providerCompletedAt,
        lastPolledAt: t.lastPolledAt,
        pollCount: t.pollCount,
        providerFailure: t.providerFailure,
        outputReported: sql<boolean>`${t.providerOutputRef} is not null`,
        admissionOutcome: t.admissionOutcome,
        sourceArtifactId: t.sourceArtifactId,
        sourceRevisionNo: t.sourceRevisionNo,
        requestedAt: t.requestedAt,
        sourceMediaAssetId: t.sourceMediaAssetId,
      })
      .from(t)
      .where(and(eq(t.tenantId, tenant.tenantId), eq(t.outputMediaKind, "video"), inArray(t.sourceArtifactId, ids)))
      .orderBy(desc(t.requestedAt), desc(t.id));
  } catch {
    return { status: "unavailable" };
  }
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  return {
    status: "read",
    generations: rows.map((r) => ({
      invocationId: r.id,
      outputMediaKind: "video" as const,
      state: r.state as MediaInvocationState,
      simulated: r.transport === "fake",
      provider: r.provider,
      model: r.model,
      providerAcceptedAt: iso(r.providerAcceptedAt),
      providerCompletedAt: iso(r.providerCompletedAt),
      lastPolledAt: iso(r.lastPolledAt),
      pollCount: r.pollCount,
      providerFailure: r.providerFailure,
      providerOutputReported: r.outputReported === true,
      admissionOutcome: r.admissionOutcome,
      sourceArtifactId: r.sourceArtifactId,
      sourceRevisionNo: r.sourceRevisionNo,
      requestedAt: new Date(r.requestedAt).toISOString(),
      sourceMediaAssetId: r.sourceMediaAssetId,
    })),
  };
}
