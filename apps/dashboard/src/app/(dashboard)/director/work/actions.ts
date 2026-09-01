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
  recordWork,
  retireWork,
  retitleWork,
  setWorkAccountableHuman,
  setWorkDeclaredState,
  type WorkWriteResult,
} from "@/features/organizational-work/write-work.server";
import type { WorkDeclaredState } from "@/features/organizational-work/work-contracts";

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
