/*
 * tenant-entitlements/agent-limit.server.ts — P5-4. The plan's agent limit, enforced inside the agent
 * registration's own transaction (the seam that creates the agent), exactly like the member limit.
 *
 * An agent counts until it is retired; a suspended agent still counts. Founding has no plan limit. A
 * per-tenant transaction-scoped advisory lock serializes two concurrent registrations, so "count then
 * insert" cannot both see the last free place. Agents above a limit (a downgraded plan) are kept; only
 * a new registration is refused.
 */
import { and, count, eq, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import { agentNotRetiredCondition } from "@/features/agent-identity/in-service";
import { readTenantPlan } from "./tenant-dispatch-ceiling.server";
import { planFeatures } from "./plans";

type TransactionHandle = Pick<ControlPlaneDatabase, "execute" | "select">;

/** Whether this tenant's plan admits one more agent. Call inside the registering transaction. */
export async function agentLimitAdmitsWithin(tx: TransactionHandle, tenantId: string): Promise<boolean> {
  const limit = planFeatures(await readTenantPlan(tx as Pick<ControlPlaneDatabase, "select">, tenantId)).agentLimit;
  if (limit === null) return true;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hebun.plan-agent-limit'), hashtext(${tenantId}))`);
  const [row] = await tx
    .select({ n: count() })
    .from(agents)
    .where(and(eq(agents.tenantId, tenantId), agentNotRetiredCondition()));
  return Number(row?.n ?? 0) < limit;
}
