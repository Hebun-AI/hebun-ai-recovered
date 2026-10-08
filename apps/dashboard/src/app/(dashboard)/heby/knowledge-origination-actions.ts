"use server";

/*
 * WF-3C — the boundary behind the EXPLICIT Knowledge mode of agent origination.
 *
 * Its own file, beside the released `originateHebyActionProposalAction` rather than inside it: the
 * client sends only `{ goal, agentId? }` (AP-1: agentId is a verified lookup key), and the mode is chosen by WHICH action a human pressed, never
 * by a client-supplied flag or by inferring intent from the goal. The tenant comes from the R1
 * session. The result is at most one PENDING record-work proposal citing ratified Knowledge.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  originateAgentAction,
  type OriginateActionResult,
} from "@/features/agent-origination/originate-action.server";

export async function originateKnowledgeGroundedProposalAction(
  /* AP-4B — `workScope` is the human's choice, carried as a value; the inlet resolves and refuses. */
  input: { readonly goal: string; readonly agentId?: string; readonly workScope?: unknown },
): Promise<OriginateActionResult> {
  return originateAgentAction(
    { goal: input?.goal, agentId: input?.agentId, workScope: input?.workScope },
    { resolveTenant: resolveTenantContext, knowledgeMode: true },
  );
}
