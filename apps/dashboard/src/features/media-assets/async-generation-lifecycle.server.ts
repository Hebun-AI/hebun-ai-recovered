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
import { and, eq, sql } from "drizzle-orm";
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
import { digestVideoGenerationInput } from "./input-digest";
import type {
  MediaAsyncDispatchOutcome,
  MediaAsyncGenerationTransport,
  MediaAsyncGenerationTransportResolution,
  MediaAsyncPollOutcome,
  MediaAsyncProviderFailure,
} from "./async-generation-transport";
import { resolveMediaAsyncGenerationTransport } from "./async-generation-transport.server";
import { resolveMediaDbOrNull } from "./media-db.server";

export interface AsyncGenerationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveTransport?: () => MediaAsyncGenerationTransportResolution | Promise<MediaAsyncGenerationTransportResolution>;
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
  | "transport-mismatch";

export interface RegisterAsyncGenerationInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly promptText: string;
  readonly requestKey: string;
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
  /** A poll found the job still pending (or unreadable); only the observation counters moved. */
  | { readonly status: "observed-pending"; readonly state: "provider-pending" };

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

async function resolveTransport(deps: AsyncGenerationDeps): Promise<MediaAsyncGenerationTransport | null> {
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

  const transport = await resolveTransport(deps);
  if (!transport) return refused("generation-transport-unavailable");
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = deps.now ?? (() => new Date());

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

  const inputDigest = digestVideoGenerationInput({
    promptText: input.promptText,
    sourceArtifactId: input.artifactId,
    sourceRevisionNo: input.revisionNo,
    sourceContentDigest: source.contentDigest,
    transport: transport.transport,
    provider: transport.provider,
    model: transport.model,
  });

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
  const transport = await resolveTransport(deps);
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
): Promise<AsyncTransitionResult> {
  if (typeof window !== "undefined") throw new Error("Media generation is server-only.");
  const p = await prelude(tenant, invocationId, deps);
  if (!p.ok) return p.result;
  const { db, tenantId, row, transport, now } = p;
  if (row.state !== "registered") return { status: "no-transition", state: row.state };

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
    outcome = await transport.dispatch({ promptText: row.promptText, inputDigest: row.inputDigest, invocationId });
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
    /* Still pending, or unreadable: an observation, not a transition. */
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
  return to === "provider-pending"
    ? { status: "observed-pending", state: "provider-pending" }
    : { status: "transitioned", from: "provider-pending", state: to };
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
