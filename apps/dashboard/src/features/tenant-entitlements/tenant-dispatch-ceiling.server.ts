/*
 * tenant-entitlements/tenant-dispatch-ceiling.server.ts — COMMERCIAL-ACTIVATION-1.
 *
 * The daily ceiling the AP-3 safety cap applies to a tenant, given the tenant's recorded plan. The cap
 * module asks ONE question here — "what is this tenant's ceiling for this class?" — and stays a cap:
 * it counts, locks and refuses exactly as released; only where its number comes from moved.
 *
 *   founding → the deployment cap, unchanged: pre-billing tenants keep 50 / 5 and every env override.
 *   free/pro → the plan's public limit. An operator-set env value still bounds it from above (and 0
 *              still turns a class off everywhere); absent, the plan's own limit applies.
 *
 * The deployment cap is passed IN (resolved by the cap module itself), so this module imports nothing
 * from the cap and there is no import cycle.
 */
import { eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { asPlanCode, COMMERCIAL_PLAN_LIMITS, type PlanCode } from "./plans";

export type DispatchClass = "model" | "media";

export interface DeploymentCap {
  /** The cap the deployment resolves for this class (the released AP-3 resolution). */
  readonly cap: number;
  /** True when an operator set the class's env value explicitly. */
  readonly operatorSet: boolean;
}

/** The tenant's recorded plan; a missing row or unknown value reads as `free`, the narrowest. */
export async function readTenantPlan(db: Pick<ControlPlaneDatabase, "select">, tenantId: string): Promise<PlanCode> {
  const [row] = await db.select({ plan: companies.plan }).from(companies).where(eq(companies.id, tenantId)).limit(1);
  return asPlanCode(row?.plan);
}

export function ceilingForPlan(plan: PlanCode, dispatchClass: DispatchClass, deployment: DeploymentCap): number {
  if (plan === "founding") return deployment.cap;
  const planCap = COMMERCIAL_PLAN_LIMITS[plan][dispatchClass];
  return deployment.operatorSet ? Math.min(planCap, deployment.cap) : planCap;
}

export async function resolveTenantDispatchCeiling(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  dispatchClass: DispatchClass,
  deployment: DeploymentCap,
): Promise<number> {
  return ceilingForPlan(await readTenantPlan(db, tenantId), dispatchClass, deployment);
}
