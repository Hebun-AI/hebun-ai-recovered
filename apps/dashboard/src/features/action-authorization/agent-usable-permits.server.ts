/*
 * L-2b — does this agent still hold a permit that could be SPENT right now?
 *
 * Read INSIDE a caller's transaction, with the exact predicate the spend uses
 * (`consume-action-permit.server.ts`: `status = 'active' AND expires_at > now()`, database clock),
 * over permits whose request this agent proposed. Expired, consumed and revoked permits are not
 * usable and are not counted. Reads only; it revokes nothing and is not a second revocation system —
 * a human ends a permit through `revoke-action-permit.server.ts`, or it expires.
 */
import { and, eq, gt, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";

export async function countUsableAgentPermitsWithin(
  tx: ControlPlaneDatabase,
  tenantId: string,
  agentId: string,
): Promise<number> {
  const rows = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(actionPermits)
    .innerJoin(
      hebyActionRequests,
      and(
        eq(actionPermits.actionRequestId, hebyActionRequests.id),
        eq(actionPermits.tenantId, hebyActionRequests.tenantId),
      ),
    )
    .where(
      and(
        eq(actionPermits.tenantId, tenantId),
        eq(hebyActionRequests.proposedByActorType, "agent"),
        eq(hebyActionRequests.proposedByActorId, agentId),
        eq(actionPermits.status, "active"),
        gt(actionPermits.expiresAt, sql`now()`),
      ),
    );
  return Number(rows[0]?.n ?? 0);
}
