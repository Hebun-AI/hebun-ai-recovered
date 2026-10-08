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
import { parseWorkScope, type WorkScope } from "@/features/work-domain/work-scope";
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

/* ═══════════════════════════════════════════════════════════════════════════
 * AP-4B — THE RESPONSIBILITY DIMENSION, ASKED BY THE SAME ASKERS.
 *
 * A mandate's kind ceiling says WHICH ACTS an agent may propose; its responsibility says WHICH KIND
 * OF WORK. For `record-work` both must admit, and the second is answered here, beside the first, so
 * the inlet, the standing issuer, the spend and the machine executor all ask one function. Every
 * other kind — `send` among them — is outside AP-4 and passes through untouched (`null`).
 *
 *   organization scope  ← admitted only by an explicit organization-level grant
 *   domain scope        ← admitted only by a grant of THAT domain, while the domain is in service
 *   no grants           ← undeclared: admits nothing
 *
 * Organization-level covers no domain and a domain grant covers no organization work: neither is a
 * superset of the other. The work scope is the one frozen into the request's payload — the value a
 * human chose and the Director approved — never a value the caller re-states.
 * ═════════════════════════════════════════════════════════════════════════ */

export type AgentResponsibilityRefusal = Extract<
  ActionRequestRefusal,
  "agent-mandate-authority-unavailable" | "no-agent-mandate" | "work-scope-required" | "work-outside-agent-responsibility"
>;

/** Structural, like {@link MandateReadForCeiling}: what the Agent Mandate Authority reported. */
export type MandateReadForResponsibility =
  | { readonly status: "unavailable" }
  | {
      readonly status: "known";
      readonly mandate: {
        readonly responsibility: readonly (
          | { readonly kind: "organization" }
          | { readonly kind: "domain"; readonly workDomainId: string; readonly inService: boolean }
        )[];
      } | null;
    };

/** The one registry kind AP-4 scopes responsibility to, in the registry vocabulary. */
export const RESPONSIBILITY_SCOPED_REGISTRY_KIND = AGENT_ORIGINABLE_REGISTRY_KIND["record-work"];

export function refuseOutsideAgentResponsibility(
  read: MandateReadForResponsibility,
  actionKind: string,
  workScope: WorkScope | null,
): AgentResponsibilityRefusal | null {
  if (actionKind !== RESPONSIBILITY_SCOPED_REGISTRY_KIND) return null;
  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";
  if (!read.mandate) return "no-agent-mandate";
  const scope = parseWorkScope(workScope);
  if (!scope) return "work-scope-required";
  const admitted = read.mandate.responsibility.some((grant) =>
    scope.kind === "organization"
      ? grant.kind === "organization"
      : grant.kind === "domain" && grant.inService && grant.workDomainId === scope.workDomainId,
  );
  return admitted ? null : "work-outside-agent-responsibility";
}
