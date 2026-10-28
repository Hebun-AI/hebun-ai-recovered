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
      /*
       * RA-AUTH-1 — the stored scope may also hold PREPARATION kinds (`prepare-research`). They are
       * not aliases, map to no registry kind, and therefore admit no act below.
       */
      readonly mandate: { readonly proposalScope: readonly string[] } | null;
    };

/** Whether a stored scope member is an origination alias — own property of the declared map only. */
function isOriginationAlias(member: string): member is AgentOriginableActionKind {
  return Object.prototype.hasOwnProperty.call(AGENT_ORIGINABLE_REGISTRY_KIND, member);
}

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
    (alias) => isOriginationAlias(alias) && AGENT_ORIGINABLE_REGISTRY_KIND[alias] === actionKind,
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

/**
 * WORK-UPDATE V1 — every registry kind whose payload names a work scope that the agent must be
 * responsible for. `record-work` (AP-4) and `set-work-declared-state`, whose scope is the TARGET
 * item's own work domain, frozen into the digest at proposal and re-checked here at spend.
 */
export const WORK_STATE_SCOPED_REGISTRY_KIND = AGENT_ORIGINABLE_REGISTRY_KIND["set-work-declared-state"];
export const RESPONSIBILITY_SCOPED_REGISTRY_KINDS: readonly string[] = Object.freeze([
  RESPONSIBILITY_SCOPED_REGISTRY_KIND,
  WORK_STATE_SCOPED_REGISTRY_KIND,
]);

export function refuseOutsideAgentResponsibility(
  read: MandateReadForResponsibility,
  actionKind: string,
  workScope: WorkScope | null,
): AgentResponsibilityRefusal | null {
  if (!RESPONSIBILITY_SCOPED_REGISTRY_KINDS.includes(actionKind)) return null;
  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";
  if (!read.mandate) return "no-agent-mandate";
  return refuseOutsideResponsibilityGrants(read.mandate.responsibility, workScope);
}

type ResponsibilityGrants = NonNullable<Extract<MandateReadForResponsibility, { status: "known" }>["mandate"]>["responsibility"];

/** The responsibility test both ceilings share: the work scope must be covered by a stated grant. */
function refuseOutsideResponsibilityGrants(
  grants: ResponsibilityGrants,
  workScope: WorkScope | null,
): "work-scope-required" | "work-outside-agent-responsibility" | null {
  const scope = parseWorkScope(workScope);
  if (!scope) return "work-scope-required";
  const admitted = grants.some((grant) =>
    scope.kind === "organization"
      ? grant.kind === "organization"
      : grant.kind === "domain" && grant.inService && grant.workDomainId === scope.workDomainId,
  );
  return admitted ? null : "work-outside-agent-responsibility";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * RA-AUTH-1 — THE PREPARATION CEILING, BESIDE THE ACTION CEILING.
 *
 * "Does this agent's recorded mandate admit this PREPARATION for this work?" A preparation kind is
 * not an action, so it is never answered by `refuseOutsideAgentMandate` (whose map it is not in);
 * it is answered here, by the same two dimensions, in the same order, with the same refusals:
 *
 *   unreadable mandate                 → agent-mandate-authority-unavailable
 *   no mandate                         → no-agent-mandate
 *   kind not in the scope (withdrawn)  → action-outside-agent-mandate
 *   no work scope                      → work-scope-required
 *   scope not covered by a grant       → work-outside-agent-responsibility
 *
 * Every preparation kind is responsibility-scoped. The read is the tenant-scoped effective mandate
 * the caller just took, so another tenant's agent, a superseded revision and a withdrawal all arrive
 * here as "no mandate" or "not in scope". An origination alias handed in as a preparation kind is
 * refused: this function can never admit an action.
 * ═════════════════════════════════════════════════════════════════════════ */

export type AgentPreparationRefusal = AgentMandateCeilingRefusal | AgentResponsibilityRefusal;

export function refuseOutsideAgentPreparation(
  read: MandateReadForCeiling & MandateReadForResponsibility,
  /* A released preparation kind (`AGENT_PREPARATION_KINDS`); typed structurally, like the reads, so this module imports nothing from the mandate authority. */
  preparationKind: string,
  workScope: WorkScope | null,
): AgentPreparationRefusal | null {
  if (read.status === "unavailable") return "agent-mandate-authority-unavailable";
  if (!read.mandate) return "no-agent-mandate";
  if (isOriginationAlias(preparationKind)) return "action-outside-agent-mandate";
  if (!read.mandate.proposalScope.includes(preparationKind)) return "action-outside-agent-mandate";
  return refuseOutsideResponsibilityGrants(read.mandate.responsibility, workScope);
}
