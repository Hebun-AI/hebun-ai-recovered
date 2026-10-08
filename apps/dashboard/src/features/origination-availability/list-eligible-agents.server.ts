/*
 * origination-availability/list-eligible-agents.server.ts — WHO COULD propose this kind of work? (AP-4B)
 *
 * A READ-ONLY ELIGIBILITY PROJECTION. For one work scope it lists this tenant's in-service agents whose
 * effective mandate admits `record-work` AND grants responsibility for that scope — answered by the
 * same shared ceiling every enforcement point asks, never re-derived here.
 *
 * WHAT IT IS NOT, and a firewall test pins each:
 *   - not ranking: the order is the identity read's own order; there is no score, weight or "best";
 *   - not routing or default selection: it never picks one, and a single eligible agent is still a
 *     list a human chooses from;
 *   - not authorization: nothing reads this to admit anything. The inlet, the standing issuer and the
 *     spend re-ask the Agent Mandate Authority, and their answer wins;
 *   - not reachable from those enforcement points: they may not import this module.
 *
 * Fails closed: an unreadable authority makes the whole answer unavailable, never "everyone".
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  refuseOutsideAgentMandate,
  refuseOutsideAgentResponsibility,
  RESPONSIBILITY_SCOPED_REGISTRY_KIND,
} from "@/features/action-authorization/agent-mandate-ceiling";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";
import { readEffectiveAgentMandate } from "@/features/agent-mandate/read-agent-mandate.server";
import type { WorkScope } from "@/features/work-domain/work-scope";

export type EligibleAgentsRead =
  | { readonly status: "read"; readonly agents: readonly { readonly agentId: string; readonly name: string }[] }
  | { readonly status: "unavailable" };

export async function listEligibleAgents(
  tenant: TenantContext | null,
  workScope: WorkScope,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<EligibleAgentsRead> {
  if (typeof window !== "undefined") throw new Error("Agent eligibility is server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  const identity = await readDurableAgentIdentityState(tenant, deps);
  if (identity.status !== "known") return { status: "unavailable" };

  const agents: { agentId: string; name: string }[] = [];
  for (const candidate of identity.identities) {
    if (!candidate.inService) continue;
    const mandate = await readEffectiveAgentMandate(tenant, candidate.agentId, deps);
    if (mandate.status !== "known") return { status: "unavailable" };
    if (refuseOutsideAgentMandate(mandate, RESPONSIBILITY_SCOPED_REGISTRY_KIND)) continue;
    if (refuseOutsideAgentResponsibility(mandate, RESPONSIBILITY_SCOPED_REGISTRY_KIND, workScope)) continue;
    agents.push({ agentId: candidate.agentId, name: candidate.name });
  }
  return { status: "read", agents };
}
