/*
 * plan-usage/plan-usage.server.ts — V1-STAGE-6 Plan & Usage, READ ONLY.
 *
 * Composes three facts Hebun already holds and invents none:
 *
 *   plan     → `companies.plan` of the SESSION's tenant, read through the session's own membership.
 *   dispatch → the AP-3 safety cap: today's ceiling and the admissions it counted (measured rows).
 *   tokens   → R2F.1 recorded provider usage (a lower bound, never a bill).
 *
 * No price, currency, invoice or total-due exists anywhere in Hebun, so none is derived here. Every
 * read is keyed by the session, never by input; nothing is written.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { companies } from "@/db/schema/company";
import { memberships } from "@/db/schema/membership";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readAiDispatchUsageToday, type AiDispatchUsageRead } from "@/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";
import { readRecordedProviderUsage } from "@/features/heby-provider-ops/provider-usage-aggregation.server";
import type { RecordedProviderUsageRead } from "@/features/heby-provider-ops/usage-contracts";

export type PlanUsageRead =
  | { readonly status: "unauthenticated" }
  | { readonly status: "unavailable" }
  | {
      readonly status: "read";
      readonly organization: { readonly name: string; readonly plan: string };
      readonly dispatch: AiDispatchUsageRead;
      readonly recorded: RecordedProviderUsageRead;
      readonly readAt: string;
    };

export interface PlanUsageDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

function dbOf(deps: PlanUsageDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

export async function readPlanAndUsage(tenant: TenantContext | null, deps: PlanUsageDeps = {}): Promise<PlanUsageRead> {
  if (typeof window !== "undefined") throw new Error("Plan and usage reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId || !tenant.membershipId) return { status: "unauthenticated" };
  const db = dbOf(deps);
  if (!db) return { status: "unavailable" };
  const now = deps.now ?? (() => new Date());
  try {
    const [org] = await db
      .select({ name: companies.name, plan: companies.plan })
      .from(memberships)
      .innerJoin(companies, eq(companies.id, memberships.tenantId))
      .where(and(eq(memberships.id, tenant.membershipId), eq(memberships.tenantId, tenant.tenantId), eq(memberships.userId, tenant.userId)));
    if (!org) return { status: "unavailable" };
    const [dispatch, recorded] = await Promise.all([
      readAiDispatchUsageToday(tenant.tenantId, { getDb: () => db, now, env: deps.env }),
      readRecordedProviderUsage(tenant, { getDb: () => db }),
    ]);
    return { status: "read", organization: org, dispatch, recorded, readAt: now().toISOString() };
  } catch {
    return { status: "unavailable" };
  }
}
