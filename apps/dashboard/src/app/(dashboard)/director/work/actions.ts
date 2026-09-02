"use server";

/*
 * Server actions for the Organizational Work Authority (WORK-1).
 *
 * THIS FILE HOLDS NO AUTHORITY. Each action resolves the tenant SERVER-SIDE — `resolveTenantContext`
 * takes no argument, so there is no parameter through which a browser could name another
 * organization — hands the released writer exactly what the human supplied, and returns its verdict
 * unchanged. No refusal is reworded here, because a second wording is a second interpretation.
 *
 * The Governance-authority gate, the department lifecycle check, the accountable-human eligibility
 * check, the row lock and the audit row all live in `write-work.server.ts` and are unreachable from
 * the client.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  declareWorkEvidenceReference,
  withdrawWorkEvidenceReference,
  recordWork,
  retireWork,
  retitleWork,
  setWorkAccountableHuman,
  setWorkDeclaredState,
  type WorkWriteResult,
} from "@/features/organizational-work/write-work.server";
import type {
  WorkDeclaredState,
  WorkReferenceKind,
} from "@/features/organizational-work/work-contracts";
import { proposeRecordWorkAction as fileRecordWorkProposal } from "@/features/heby-action-inlet/record-work-proposal.server";
import type { RecordWorkProposalResult } from "@/features/heby-action-inlet/contracts";

const WORK_ROUTE = "/director/work";

function revalidate(result: WorkWriteResult): WorkWriteResult {
  if (result.status === "recorded") revalidatePath(WORK_ROUTE);
  return result;
}

export async function recordWorkAction(input: {
  title: string;
  declaredState?: WorkDeclaredState;
  departmentId?: string | null;
  accountableUserId?: string | null;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await recordWork(tenant, input));
}

export async function retitleWorkAction(input: {
  workItemId: string;
  title: string;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await retitleWork(tenant, input));
}

export async function setWorkDeclaredStateAction(input: {
  workItemId: string;
  declaredState: WorkDeclaredState;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await setWorkDeclaredState(tenant, input));
}

export async function setWorkAccountableHumanAction(input: {
  workItemId: string;
  accountableUserId: string | null;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await setWorkAccountableHuman(tenant, input));
}

export async function retireWorkAction(input: {
  workItemId: string;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await retireWork(tenant, input));
}

/**
 * Propose recording work FOR GOVERNANCE, instead of recording it (GIA-1).
 *
 * ── WHY THIS SITS BESIDE `recordWorkAction` AND DOES NOT REPLACE IT ──────────
 *
 * `recordWorkAction` is a human recording their own organization's work under their own Governance
 * authority. It is unchanged, and it is still the ordinary way work gets recorded.
 *
 * This one records NOTHING. It files a pending action request that a human then decides at
 * `/approvals`, and only a separately-spent permit lets HEBUN perform the mutation. The two exist
 * side by side because they answer different questions:
 *
 *   recordWorkAction               a human authors a record        `created_by_type = human`
 *   proposeRecordWorkForGovernance a human authorizes Hebun to      `created_by_type = system`
 *
 * The second is the path a durable agent can originate a proposal into. That is the whole reason it
 * exists — an agent has no representation in which to call the first.
 *
 * THIS FILE STILL HOLDS NO AUTHORITY. The tenant is resolved server-side, the department reference
 * is resolved by the Organization Authority inside the inlet, and the inlet's verdict is returned
 * unchanged and unreworded.
 */
export async function proposeRecordWorkForGovernanceAction(input: {
  title: string;
  departmentRef: string;
}): Promise<RecordWorkProposalResult> {
  const tenant = await resolveTenantContext();
  const result = await fileRecordWorkProposal(tenant, {
    title: String(input?.title ?? ""),
    departmentRef: String(input?.departmentRef ?? ""),
  });
  /*
   * The REGISTER is deliberately not revalidated. Filing a proposal records no work item, and
   * refreshing the list would suggest something landed there. The decision surface is where the
   * new row actually appears.
   */
  if (result.status === "proposed") revalidatePath("/approvals");
  return result;
}

/**
 * WEV-1 — DECLARE WHAT A WORK ITEM CONCERNS.
 *
 * A human act. The client supplies a work item, a referent kind and the referent's own id, and
 * NOTHING ELSE — no tenant, no actor, no label, no standing. The Work Authority resolves the tenant
 * server-side, checks the referent exists inside it, and the database refuses a declarer who is not
 * a human. This surface holds no authority and rewords no refusal.
 */
export async function declareWorkReferenceAction(input: {
  workItemId: string;
  kind: WorkReferenceKind;
  referentId: string;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(
    await declareWorkEvidenceReference(tenant, {
      workItemId: String(input?.workItemId ?? ""),
      referent: { kind: input?.kind, referentId: String(input?.referentId ?? "") },
    }),
  );
}

/**
 * WEV-1 — WITHDRAW A DECLARATION.
 *
 * It says only that this work no longer declares that reference as current. The referent is not
 * touched, the row is not deleted, and the audit keeps both acts.
 */
export async function withdrawWorkReferenceAction(input: {
  referenceId: string;
}): Promise<WorkWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(
    await withdrawWorkEvidenceReference(tenant, { referenceId: String(input?.referenceId ?? "") }),
  );
}
