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
  prepareWorkArtifact,
  WORK_ARTIFACT_OWNER_WORKSPACE,
  type PrepareWorkArtifactResult,
} from "@/features/work-artifacts/prepare-work-artifact.server";
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
export async function prepareWorkArtifactAction(input: {
  prompt: string;
  route: string;
  artifactType: WorkArtifactType;
  title: string;
  conversationId?: string;
  artifactId?: string;
}): Promise<PrepareWorkArtifactResult> {
  const result = await prepareWorkArtifact(input, { resolveTenant: resolveTenantContext });
  if (result.status === "prepared") revalidatePath("/operations");
  return result;
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
