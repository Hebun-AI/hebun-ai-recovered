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
import {
  preflightWorkStateOrigination,
  readWorkStateAgentChoices,
} from "@/features/origination-availability/read-origination-availability.server";
import type { WorkStateAgentChoices } from "@/features/origination-availability/contracts";

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

/*
 * WORK-UPDATE-AGENT-SELECTION-1 — the chooser's list for the item the person is looking at: this
 * tenant's in-service agents and whether each is responsible for the item's work domain. A read;
 * the item id is a lookup key resolved for the session's tenant. It decides nothing — the proposal
 * above re-resolves whichever agent is sent.
 */
export async function readWorkStateAgentChoicesAction(input: { readonly workItemId: string }): Promise<WorkStateAgentChoices> {
  return readWorkStateAgentChoices(await resolveTenantContext(), typeof input?.workItemId === "string" ? input.workItemId : "");
}
