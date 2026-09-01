"use server";

/*
 * Server actions for the Organization Structure Authority (OSA-1).
 *
 * THIS FILE HOLDS NO AUTHORITY. Each action resolves the tenant SERVER-SIDE — `resolveTenantContext`
 * takes no argument, so there is no parameter through which a browser could name another
 * organization — hands the released writer exactly what the human typed, and returns its verdict
 * unchanged. No refusal is reworded here, because a second wording is a second interpretation.
 *
 * The Governance-authority gate, the active-member check, the slug uniqueness and the audit row all
 * live in `write-structure.server.ts` and are unreachable from the client.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  recordDepartment,
  renameDepartment,
  retireDepartment,
  setDepartmentOwner,
  type DepartmentWriteResult,
} from "@/features/organization-authority/write-structure.server";
import {
  placeHumanInDepartment,
  withdrawPlacement,
  type PlacementWriteResult,
} from "@/features/organization-authority/write-placement.server";

const ORGANIZATION_ROUTE = "/director/organization";

function revalidate(result: DepartmentWriteResult): DepartmentWriteResult {
  if (result.status === "recorded") revalidatePath(ORGANIZATION_ROUTE);
  return result;
}

/** A placement act has two success shapes — `recorded` and `withdrawn` — and both change the page. */
function revalidatePlacement(result: PlacementWriteResult): PlacementWriteResult {
  if (result.status === "recorded" || result.status === "withdrawn") {
    revalidatePath(ORGANIZATION_ROUTE);
  }
  return result;
}

export async function recordDepartmentAction(input: {
  name: string;
  slug: string;
  ownerUserId?: string | null;
}): Promise<DepartmentWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await recordDepartment(tenant, input));
}

export async function renameDepartmentAction(input: {
  departmentId: string;
  name: string;
  slug?: string;
}): Promise<DepartmentWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await renameDepartment(tenant, input));
}

export async function retireDepartmentAction(input: {
  departmentId: string;
}): Promise<DepartmentWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await retireDepartment(tenant, input));
}

export async function setDepartmentOwnerAction(input: {
  departmentId: string;
  ownerUserId: string | null;
}): Promise<DepartmentWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidate(await setDepartmentOwner(tenant, input));
}

/*
 * ── DEPARTMENTAL PLACEMENT ───────────────────────────────────────────────────
 *
 * The same posture, a different authority module. These two actions reach
 * `write-placement.server.ts`, which writes `department_placements` and `audit_log` and nothing
 * else — in particular it never writes `memberships`, which is why the fact lives in its own table
 * rather than as a column on the row a session reads.
 *
 * No refusal is reworded here either. `human-not-active-member` reaches the surface exactly as the
 * authority produced it, so a control can never explain a refusal the authority did not give.
 */
export async function placeHumanInDepartmentAction(input: {
  userId: string;
  departmentId: string;
}): Promise<PlacementWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidatePlacement(await placeHumanInDepartment(tenant, input));
}

export async function withdrawPlacementAction(input: {
  userId: string;
}): Promise<PlacementWriteResult> {
  const tenant = await resolveTenantContext();
  return revalidatePlacement(await withdrawPlacement(tenant, input));
}
