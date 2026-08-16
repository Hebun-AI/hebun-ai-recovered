"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import type {
  CreateWorkArtifactResult,
  ReviseWorkArtifactResult,
  RetireWorkArtifactResult,
  WorkArtifactReferenceResolution,
  WorkArtifactRevisionView,
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
