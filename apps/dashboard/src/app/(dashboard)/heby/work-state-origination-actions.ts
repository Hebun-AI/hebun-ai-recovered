"use server";

/*
 * WORK-UPDATE V1 — the boundary behind Heby's "propose a state change for this work item" affordance.
 *
 * Its own file, beside the other origination boundaries, so WORK-1's server actions stay unable to
 * reach agent origination. The browser supplies the item the person is looking at, the state they
 * chose and, when more than one agent is in service, which agent — three lookup values, each
 * resolved for the session's tenant on the server. The model is shown neither the item nor its
 * state. A proposal is a pending request for /approvals; nothing is approved and no work changes here.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  originateWorkStateChange,
  type OriginateWorkStateResult,
} from "@/features/agent-origination/originate-work-state.server";
import { preflightWorkStateOrigination } from "@/features/origination-availability/read-origination-availability.server";

export async function proposeWorkStateChangeAction(input: {
  readonly workItemId: string;
  readonly toState: string;
  readonly agentId?: string;
}): Promise<OriginateWorkStateResult> {
  return originateWorkStateChange(
    {
      workItemId: typeof input?.workItemId === "string" ? input.workItemId : "",
      toState: input?.toState,
      ...(typeof input?.agentId === "string" ? { agentId: input.agentId } : {}),
    },
    { resolveTenant: resolveTenantContext, preflight: (tenant, agentId, workDomainId) => preflightWorkStateOrigination(tenant, agentId, workDomainId) },
  );
}
