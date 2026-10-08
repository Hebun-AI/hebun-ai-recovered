/*
 * organization-authority/read-agent-placement.server.ts — WHERE EACH AGENT SITS (AP-2).
 *
 * Tenant-scoped, read-only, the same scope as the durable agent identity read on `/agents`. It
 * selects the placement column and the department it names — nothing about identity beyond the id
 * and in-service status the state derivation needs — and derives one of four states
 * (`deriveAgentPlacementState`). A retired agent's preserved `department_id` is reported as
 * `historical`, never as a current placement.
 *
 * Two answers, never collapsed: `unavailable` (the control plane did not answer) is not "no agent
 * is placed".
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import { departments } from "@/db/schema/department";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isAgentInService } from "@/features/agent-identity/in-service";
import { ACTIVE_LIFECYCLE_STATUS } from "./read-structure.server";
import {
  deriveAgentPlacementState,
  type AgentPlacementRegister,
} from "./agent-placement-contracts";

export interface AgentPlacementReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export async function readAgentPlacements(
  tenant: TenantContext | null,
  deps: AgentPlacementReadDeps = {},
): Promise<AgentPlacementRegister> {
  if (typeof window !== "undefined") throw new Error("Agent placement reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };

  let db: ControlPlaneDatabase | null;
  try {
    db = deps.getDb ? deps.getDb() : getControlPlaneDb();
  } catch {
    db = null;
  }
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({
        agentId: agents.id,
        retiredAt: agents.retiredAt,
        suspendedAt: agents.suspendedAt,
        lifecycle: agents.agentLifecycleStatus,
        departmentId: departments.id,
        name: departments.name,
        slug: departments.slug,
        departmentLifecycle: departments.lifecycleStatus,
      })
      .from(agents)
      .leftJoin(
        departments,
        and(eq(departments.tenantId, agents.tenantId), eq(departments.id, agents.departmentId)),
      )
      .where(eq(agents.tenantId, tenant.tenantId));

    return {
      status: "available",
      placements: rows.map((row) => {
        const agentInService = isAgentInService(row);
        const department =
          row.departmentId && row.name !== null && row.slug !== null
            ? {
                departmentId: row.departmentId,
                name: row.name,
                slug: row.slug,
                inService: row.departmentLifecycle === ACTIVE_LIFECYCLE_STATUS,
              }
            : null;
        return {
          agentId: row.agentId,
          agentInService,
          state: deriveAgentPlacementState(agentInService, department),
          department,
        };
      }),
    };
  } catch {
    return { status: "unavailable" };
  }
}
