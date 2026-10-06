"use server";

/*
 * WF-3C — the boundary behind the EXPLICIT Knowledge mode of agent origination.
 *
 * Its own file, beside the released `originateHebyActionProposalAction` rather than inside it: the
 * client still sends only `{ goal }`, and the mode is chosen by WHICH action a human pressed, never
 * by a client-supplied flag or by inferring intent from the goal. The tenant comes from the R1
 * session. The result is at most one PENDING record-work proposal citing ratified Knowledge.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  originateAgentAction,
  type OriginateActionResult,
} from "@/features/agent-origination/originate-action.server";

export async function originateKnowledgeGroundedProposalAction(
  input: { readonly goal: string },
): Promise<OriginateActionResult> {
  return originateAgentAction({ goal: input?.goal }, { resolveTenant: resolveTenantContext, knowledgeMode: true });
}
