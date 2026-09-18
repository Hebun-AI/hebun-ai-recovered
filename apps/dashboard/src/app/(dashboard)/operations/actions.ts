"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import type {
  CreateWorkArtifactResult,
  ReviseWorkArtifactResult,
  RetireWorkArtifactResult,
  WorkArtifactReferenceResolution,
  WorkArtifactRevisionView,
  ContentDestination,
  WorkArtifactType,
} from "@/features/work-artifacts/contracts";
import {
  listWorkArtifacts,
  readWorkArtifactHistory,
  resolveWorkArtifactReference,
  type WorkArtifactListing,
} from "@/features/work-artifacts/read-work-artifacts.server";
import {
  createWorkArtifact,
  retireWorkArtifact,
  reviseWorkArtifact,
} from "@/features/work-artifacts/write-work-artifacts.server";
import {
  listArtifactMediaAssets,
  listRevisionMediaAssets,
  readMediaAsset,
  type ArtifactMediaAssetListing,
  type ReadMediaAssetResult,
  type RevisionMediaAssetListing,
} from "@/features/media-assets/read-media-assets.server";
import {
  acceptMediaAsset,
  declineMediaAsset,
  readMediaAssetReviewStates,
} from "@/features/media-asset-review/review-media-asset.server";
import type {
  MediaAssetReviewResult,
  MediaAssetReviewState,
} from "@/features/media-asset-review/contracts";
import { requestMediaGeneration } from "@/features/media-assets/request-media-generation.server";
import type {
  RequestMediaGenerationInput,
  RequestMediaGenerationResult,
} from "@/features/media-assets/contracts";
import {
  prepareWorkArtifact,
  WORK_ARTIFACT_OWNER_WORKSPACE,
  type PrepareWorkArtifactResult,
} from "@/features/work-artifacts/prepare-work-artifact.server";
import {
  acceptArtifactRevision,
  readArtifactRevisionReviewStates,
  readCurrentRevisionReviewStates,
  requestArtifactRevisionChanges,
} from "@/features/work-artifact-review/review-revision.server";
import type {
  ArtifactCurrentReviewStates,
  ArtifactRevisionReviewState,
  ArtifactReviewResult,
} from "@/features/work-artifact-review/contracts";
import {
  indexArtifactWorkPurpose,
  type ArtifactWorkPurposeIndex,
} from "@/features/organizational-work/artifact-work-purpose";
import { readWorkEvidenceReferences } from "@/features/organizational-work/read-work-evidence.server";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import type {
  CreateRecipientResult,
  RecipientEndpointKind,
  RecipientListing,
  ResolveRecipientResult,
  RetireRecipientResult,
} from "@/features/external-recipients/contracts";
import {
  listActiveRecipients,
  listRetiredRecipients,
  resolveRecipientReference,
} from "@/features/external-recipients/read-external-recipients.server";
import {
  createExternalRecipient,
  retireExternalRecipient,
} from "@/features/external-recipients/write-external-recipients.server";

/**
 * The R3W boundary for durable prepared work. It lives in the Operations workspace because both
 * action tools that could ever name an artifact as a `record-ref` —
 * `heby.operations.prepare-plan` and `heby.operations.send-communication` — declare
 * `ownerWorkspace: "operations"`. No eighth workspace is created and no new navigation appears.
 *
 * Every action here is thin and resolves the tenant SERVER-SIDE from the R1 session. The client
 * input is CONTENT AND CLASSIFICATION ONLY: it carries no tenant, no identity, no actor, no
 * lifecycle, no revision number, no digest and no authority, and the types make those
 * unrepresentable rather than merely discouraged.
 *
 * NOTHING HERE APPROVES ANYTHING. Preparing work asks nothing of Governance — anyone with a tenant
 * session may prepare, exactly as anyone may propose an action. The cost is paid at the approval
 * boundary, where a human and a Governance decision are both mandatory.
 */

/** Author prepared work directly, with no model involved. */
export async function createWorkArtifactAction(input: {
  artifactType: WorkArtifactType;
  title: string;
  content: string;
  sourceMessageId?: string;
  /*
   * CGO-1. Passed straight through to the domain writer, which refuses it on every type but
   * `content-draft` and requires it on that one. This action decides nothing about it — a second
   * copy of the rule here is a second place it could drift.
   */
  intendedDestination?: ContentDestination;
}): Promise<CreateWorkArtifactResult> {
  const tenant = await resolveTenantContext();
  const result = await createWorkArtifact(tenant, input, WORK_ARTIFACT_OWNER_WORKSPACE);
  if (result.status === "created") revalidatePath("/operations");
  return result;
}

/**
 * Append a new revision. The previous revision is untouched and stays byte-identical — there is no
 * server action, and no writer anywhere, that can edit revision content in place.
 */
export async function reviseWorkArtifactAction(input: {
  artifactId: string;
  content: string;
  sourceMessageId?: string;
}): Promise<ReviseWorkArtifactResult> {
  const tenant = await resolveTenantContext();
  const result = await reviseWorkArtifact(tenant, input);
  if (result.status === "revised") revalidatePath("/operations");
  return result;
}

/**
 * Close an artifact to further revisions. NOT a Governance act: it implies no approval, no
 * rejection and no judgement about the work, and it deletes nothing — every revision stays
 * readable forever.
 */
export async function retireWorkArtifactAction(input: {
  artifactId: string;
}): Promise<RetireWorkArtifactResult> {
  const tenant = await resolveTenantContext();
  const result = await retireWorkArtifact(tenant, input);
  if (result.status === "retired") revalidatePath("/operations");
  return result;
}

/** This tenant's prepared work. Never another tenant's, never a global list. */
export async function listWorkArtifactsAction(): Promise<WorkArtifactListing> {
  const tenant = await resolveTenantContext();
  return listWorkArtifacts(tenant);
}

/** Every revision of one artifact, oldest first. History in full. */
export async function readWorkArtifactHistoryAction(input: {
  artifactId: string;
}): Promise<readonly WorkArtifactRevisionView[]> {
  const tenant = await resolveTenantContext();
  return readWorkArtifactHistory(tenant, input.artifactId);
}

/*
 * ── TRH-10 — GOVERNANCE-OWNED REVIEW OF ONE EXACT REVISION ───────────────────
 *
 * These live beside the artifact surface because that surface OWNS PRESENTATION of the bytes a
 * human must read before deciding. They own no authority: the decision belongs to Governance, the
 * existence check and the transaction belong to `work-artifact-review`, and this file only carries
 * the request. Neither action can reach an artifact writer — no revision is created, no byte is
 * edited, and `current_revision` is not touched by either path.
 *
 * The tenant and the human come from the session; the client supplies the artifact, the revision it
 * was SHOWN, and a justification, and nothing else.
 */
export async function acceptArtifactRevisionAction(input: {
  artifactId: string;
  revisionId: string;
  justification: string;
}): Promise<ArtifactReviewResult> {
  const tenant = await resolveTenantContext();
  const result = await acceptArtifactRevision(tenant, input);
  if (result.status === "reviewed") revalidatePath("/operations");
  return result;
}

/** Records that Governance did not accept this revision. Creates no replacement revision. */
export async function requestArtifactRevisionChangesAction(input: {
  artifactId: string;
  revisionId: string;
  justification: string;
}): Promise<ArtifactReviewResult> {
  const tenant = await resolveTenantContext();
  const result = await requestArtifactRevisionChanges(tenant, input);
  if (result.status === "reviewed") revalidatePath("/operations");
  return result;
}

/** The DERIVED review state of each revision, read from the Governance ledger. */
export async function readArtifactRevisionReviewStatesAction(input: {
  artifactId: string;
}): Promise<readonly ArtifactRevisionReviewState[]> {
  const tenant = await resolveTenantContext();
  return readArtifactRevisionReviewStates(tenant, input.artifactId);
}

/**
 * CGO-8. The derived review state of the CURRENT revision of each named artifact, read from the
 * Governance ledger in one batch. A read: it decides nothing, writes nothing and names no writer.
 */
export async function readCurrentRevisionReviewStatesAction(input: {
  artifacts: readonly { artifactId: string; revisionNo: number }[];
}): Promise<ArtifactCurrentReviewStates> {
  const tenant = await resolveTenantContext();
  return readCurrentRevisionReviewStates(tenant, input.artifacts);
}

/**
 * Resolve one `work-artifact/<uuid>@<n>` reference to its exact bytes and standing.
 *
 * A superseded reference returns the bytes it actually names, marked superseded. It is never
 * silently upgraded to the current revision — that substitution is how an approval granted for one
 * draft comes to authorize a different one.
 */
export async function resolveWorkArtifactReferenceAction(input: {
  ref: string;
}): Promise<WorkArtifactReferenceResolution> {
  const tenant = await resolveTenantContext();
  return resolveWorkArtifactReference(tenant, input.ref);
}

/**
 * Ask Heby to prepare work and durably keep what it produced.
 *
 * DELIBERATELY NOT IN `heby/actions.ts`. `askHebyAction` answers questions and its whole path
 * imports no artifact writer, so an ordinary Heby answer has no representation in which it could
 * become prepared work. This action is the only route to a Heby-authored artifact, and it is
 * reached only when a human explicitly asked for one.
 */
/*
 * ── MEDIA-3: SEEING, AND DECIDING ABOUT, WHAT WAS GENERATED ──────────────────
 *
 * Four actions, each a pass-through to a released authority. None of them owns state, and together
 * they add no authority at all: the listing and the review states are DERIVED reads, the preview is
 * the released verified read, and the two decisions are the released Governance writers.
 *
 * WHY LISTING AND PREVIEW ARE SEPARATE ACTIONS. Listing must be cheap: it answers "what exists for
 * this revision" from the database alone, touching no store and minting no signed URL. Preview is
 * deliberately expensive: it re-verifies byte size and SHA-256 against the store before granting a
 * URL that lives ~60 s. Fusing them would either make a list of N assets do N store round-trips, or
 * hand out N grants that expire before anyone clicks one.
 */

/** Every admitted asset of one content-draft revision. A database read: no bytes, no access. */
export async function listRevisionMediaAssetsAction(input: {
  artifactId: string;
  revisionNo: number;
}): Promise<RevisionMediaAssetListing> {
  const tenant = await resolveTenantContext();
  return listRevisionMediaAssets(tenant, input);
}

/**
 * MEDIA-4A — every admitted asset of several drafts, across ALL of their revisions, in one read.
 *
 * The same pass-through discipline as the per-revision listing, one predicate wider. It answers
 * "which images exist for this draft, and which revision did each come from"; it does NOT decide
 * which revision is current, does not order revisions into a history, and records nothing.
 *
 * A DATABASE READ: no store, no bytes, no access, no signed URL.
 */
export async function listArtifactMediaAssetsAction(input: {
  artifactIds: readonly string[];
}): Promise<ArtifactMediaAssetListing> {
  const tenant = await resolveTenantContext();
  return listArtifactMediaAssets(tenant, input);
}

/**
 * The derived Governance review state of several assets, in one read.
 *
 * Returned as an array because a Map does not survive the server-action boundary. `null` decision
 * means NO DECISION HAS BEEN RECORDED — it is not, and must never be rendered as, an approval.
 */
export async function readMediaAssetReviewStatesAction(input: {
  assetIds: readonly string[];
}): Promise<readonly { assetId: string; state: MediaAssetReviewState }[]> {
  const tenant = await resolveTenantContext();
  const states = await readMediaAssetReviewStates(tenant, input.assetIds);
  return [...states].map(([assetId, state]) => ({ assetId, state }));
}

/**
 * A short-lived private read grant for ONE asset, requested when a human opens it.
 *
 * Reuses the released `readMediaAsset`, so size and SHA-256 are re-verified against the store
 * before any URL exists. The grant is minted per call, never persisted and never logged, and the
 * TTL is the released one — this action does not widen it.
 */
export async function readMediaAssetAction(input: { assetId: string }): Promise<ReadMediaAssetResult> {
  const tenant = await resolveTenantContext();
  return readMediaAsset(tenant, input.assetId);
}

/**
 * Governance accepts or declines one asset, bound to the digest the reviewer was shown.
 *
 * THE ONLY WRITERS ARE THE RELEASED ONES. This file does not touch `decision_records`, does not
 * touch `media_assets`, and cannot: accepting changes no byte, no lifecycle and no custody, and
 * grants no publication, no action request, no permit and no execution. A decision is a record of
 * judgement, not an effect.
 */
export async function reviewMediaAssetAction(input: {
  assetId: string;
  byteDigest: string;
  justification: string;
  decision: "accept" | "decline";
}): Promise<MediaAssetReviewResult> {
  const tenant = await resolveTenantContext();
  const payload = {
    assetId: input.assetId,
    byteDigest: input.byteDigest,
    justification: input.justification,
  };
  const result =
    input.decision === "accept"
      ? await acceptMediaAsset(tenant, payload)
      : await declineMediaAsset(tenant, payload);
  if (result.status === "reviewed") revalidatePath("/operations");
  return result;
}

/**
 * MEDIA-2B — THE ONLY HUMAN DOOR TO A REAL IMAGE GENERATION.
 *
 * This is the narrowest seam that makes the released MEDIA-1 authority reachable. It adds no
 * authority of its own: it resolves the tenant from the trusted session and hands the human's four
 * fields to `requestMediaGeneration`, which owns validation, idempotency, dispatch, admission,
 * storage and the asset row. There is no second generation path, no retry, and no way to reach the
 * transport from anywhere else in `src/app` or `src/components`.
 *
 * WHAT THIS DELIBERATELY CANNOT DO.
 *   - It cannot be reached by an agent. `resolveTenantContext` yields a human session or null, and
 *     the invocation row carries a `requested_by_actor_type = 'human'` CHECK underneath.
 *   - It cannot name a tenant. The tenant is never an input; a client-supplied one is impossible.
 *   - It cannot publish. Admission produces a `media_assets` row and a Governance review subject —
 *     never an action request, a permit or an execution. A generated asset is not an approved one.
 *   - It cannot edit, mask, or supply a reference image. Text-to-image only, by the transport's
 *     pinned parameters.
 *
 * `requestKey` is minted by the CLIENT once per form and resent verbatim on a retry of the same
 * submission, so a double submit collides on `(tenant_id, request_key)` and returns
 * `duplicate-request` without a second paid call. A genuinely new request needs a new key.
 */
export async function requestMediaGenerationAction(
  input: RequestMediaGenerationInput,
): Promise<RequestMediaGenerationResult> {
  const tenant = await resolveTenantContext();
  const result = await requestMediaGeneration(tenant, input);
  if (result.status === "admitted") revalidatePath("/operations");
  return result;
}

export async function prepareWorkArtifactAction(input: {
  prompt: string;
  route: string;
  artifactType: WorkArtifactType;
  /*
   * CGO-3. The human's declaration of where the prepared content is meant to go, carried to the
   * released validator unchanged. Required for a content draft, refused on every other type.
   */
  intendedDestination?: ContentDestination;
  title: string;
  conversationId?: string;
  artifactId?: string;
}): Promise<PrepareWorkArtifactResult> {
  const result = await prepareWorkArtifact(input, { resolveTenant: resolveTenantContext });
  if (result.status === "prepared") revalidatePath("/operations");
  return result;
}

/**
 * REV-3 — WHICH RECORDED WORK DECLARES EACH PREPARED ARTIFACT AS EVIDENCE.
 *
 * READS, GROUPS, AND OWNS NOTHING. The relationship belongs to the Work Authority and is read
 * through WEV-1's released seam — the one that already serves both directions. This action adds no
 * reader, no table and no write path: there is no way to declare, withdraw or edit a relationship
 * from anywhere in this file, and the artifact authority gains no say over it.
 *
 * The two reads are independent, so they run together. `listArtifacts` is injected with the listing
 * this surface has ALREADY fetched, so resolving referent labels costs no second artifact query —
 * the released seam's own injection point, used for its intended purpose.
 */
export async function readArtifactWorkPurposeAction(): Promise<ArtifactWorkPurposeIndex> {
  const tenant = await resolveTenantContext();
  const listing = await listWorkArtifacts(tenant);
  const [evidence, register] = await Promise.all([
    readWorkEvidenceReferences(tenant, { listArtifacts: async () => listing }),
    readWorkRegister(tenant),
  ]);
  return indexArtifactWorkPurpose(evidence, register);
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * R3R — RECORDED RECIPIENTS
 *
 * Same workspace, same reason. `heby.operations.send-communication` declares
 * `ownerWorkspace: "operations"` and names both `draftRef` and `recipientRef`, so the two
 * referents that action needs live under one owner. No new workspace, no new navigation, and
 * emphatically no CRM surface: list, add, retire, and nothing else.
 *
 * CREATION IS HUMAN ONLY. There is no Heby entry point below and none anywhere else — the writer
 * hard-codes `createdByType: "human"`. A model that infers "Jane at jane@example.com" from prose
 * cannot record her; the action that names an unrecorded recipient fails instead, which is the
 * behaviour R3W's record-ref repair already established for referents that do not exist.
 *
 * RECORDING AN ADDRESS IS NOT APPROVING A SEND. Nothing here consults Governance, issues a permit,
 * or causes an effect.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Record one addressable recipient. Human-authored, always. */
export async function createExternalRecipientAction(input: {
  displayName: string;
  endpointKind: RecipientEndpointKind;
  endpointValue: string;
}): Promise<CreateRecipientResult> {
  const tenant = await resolveTenantContext();
  const result = await createExternalRecipient(tenant, input);
  if (result.status === "created") revalidatePath("/operations");
  return result;
}

/**
 * Retire one recipient. The stored address is left exactly as it was — this is not a delete and
 * not an erasure, so a permit or audit entry naming it still resolves to the same bytes.
 */
export async function retireExternalRecipientAction(input: {
  recipientRef: string;
}): Promise<RetireRecipientResult> {
  const tenant = await resolveTenantContext();
  const result = await retireExternalRecipient(tenant, input);
  if (result.status === "retired") revalidatePath("/operations");
  return result;
}

/** This tenant's live recipients — the only set an action may name. */
export async function listActiveRecipientsAction(): Promise<RecipientListing> {
  const tenant = await resolveTenantContext();
  return listActiveRecipients(tenant);
}

/** What this tenant used to hold. Readable, and deliberately not proposable. */
export async function listRetiredRecipientsAction(): Promise<RecipientListing> {
  const tenant = await resolveTenantContext();
  return listRetiredRecipients(tenant);
}

/**
 * Resolve one exact reference, whatever its status.
 *
 * This is where the human approving a send gets the address from — a server-side read at the
 * approval surface, rather than the model's context window. Never substitutes: an unresolvable
 * reference is refused, not repaired to a similar one.
 */
export async function resolveRecipientReferenceAction(input: {
  recordRef: string;
}): Promise<ResolveRecipientResult> {
  const tenant = await resolveTenantContext();
  return resolveRecipientReference(tenant, input.recordRef);
}
