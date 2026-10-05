/*
 * action-authorization/agent-mandate-ceiling.ts — THE ONE ANSWER to "does this agent's recorded
 * ceiling admit this act?" (AMA-2, shared by APF-1).
 *
 * Pure. It reads nothing and owns nothing: the caller hands it what the Agent Mandate Authority
 * said, and it answers with a refusal or `null`. AMA-2 wrote this decision inside the proposal
 * writer, where it was the only place a mandate constrained anything. APF-1 gives the same question
 * two more askers — the standing issuer and the machine executor — because a mandate withdrawn
 * AFTER a proposal was filed must still stop the act. Three copies of "which aliases admit which
 * registry kind" would be three answers free to drift; this is one.
 */
import {
  AGENT_ORIGINABLE_REGISTRY_KIND,
  type AgentOriginableActionKind,
} from "@/features/agent-origination/contracts";
import type { ActionRequestRefusal } from "./contracts";

export type AgentMandateCeilingRefusal = Extract<
  ActionRequestRefusal,
  "agent-mandate-authority-unavailable" | "no-agent-mandate" | "action-outside-agent-mandate"
>;

/**
 * Returns `null` to proceed, or the refusal. There is no third answer and no default: a mandate that
 * could not be read is never treated as one that permits.
 */
/**
 * The shape of the Agent Mandate Authority's effective read, stated STRUCTURALLY so this module
 * imports nothing from that authority: it is handed what the authority said and reaches no mandate
 * itself. `readEffectiveAgentMandate` and its runtime twin both return values of this shape.
 */
export type MandateReadForCeiling =
  | { readonly status: "unavailable" }
  | {
      readonly status: "known";
      readonly mandate: { readonly proposalScope: readonly AgentOriginableActionKind[] } | null;
    };

export function refuseOutsideAgentMandate(
  read: MandateReadForCeiling,
  actionKind: string,
): AgentMandateCeilingRefusal | null {
  /* (A) Hebun could not look. An unreachable ceiling is not an absent one. */
  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";
  /* (B) Hebun looked, and nobody has bounded this agent. NO MANDATE != UNLIMITED MANDATE. */
  if (!read.mandate) return "no-agent-mandate";

  /*
   * (C) A bound exists. The stored scope is in the ORIGINATION ALIAS vocabulary and the action
   * carries a REGISTRY kind, so the comparison goes through the declared map rather than through
   * string equality. An EMPTY scope — withdrawal — admits nothing, which is what withdrawal means.
   */
  const admitted = read.mandate.proposalScope.some(
    (alias) => AGENT_ORIGINABLE_REGISTRY_KIND[alias] === actionKind,
  );
  return admitted ? null : "action-outside-agent-mandate";
}
