/*
 * origination-availability/capability-truth.ts — what ONE agent can PROPOSE right now, kept apart from
 * what its mandate permits and from what it has no authority to do at all (WF-2).
 *
 * A PURE DERIVATION of the WF-1 availability projection. It reads nothing and decides nothing: the
 * projection already asked every authority, and this only arranges its answer so four facts cannot
 * merge on screen:
 *
 *     MANDATE PERMITS  !=  REACHABLE NOW  !=  AVAILABLE  !=  AUTHORIZED  !=  EXECUTED
 *
 * "Not exposed" is the mandate's scope minus the one kind the released origination path can file.
 * An unavailable projection yields NO capability claims — absence of an answer is not a "cannot".
 */
import type { AgentOriginationAvailability, OriginationUnavailableReason } from "./contracts";

/** An agent itself never holds these. A human-governed subsystem may still do them, after a human. */
export const AGENT_HAS_NO_AUTHORITY_TO = Object.freeze([
  "approve its own proposals",
  "issue permits",
  "execute actions",
  "create organizational work directly",
  "send external communications directly",
  "grant itself more authority",
] as const);

export type AgentCapabilityTruth =
  | {
      readonly status: "known";
      readonly mandateRevision: number;
      readonly mandatePermits: readonly string[];
      readonly canProposeNow: readonly string[];
      readonly permittedButNotExposed: readonly string[];
    }
  | { readonly status: "unavailable"; readonly reason: OriginationUnavailableReason };

export function deriveAgentCapabilityTruth(availability: AgentOriginationAvailability): AgentCapabilityTruth {
  if (availability.status !== "available") return { status: "unavailable", reason: availability.reason };
  const scope = availability.mandate.proposalScope;
  return {
    status: "known",
    mandateRevision: availability.mandate.revision,
    mandatePermits: scope,
    canProposeNow: [availability.originable],
    permittedButNotExposed: scope.filter((kind) => kind !== availability.originable),
  };
}

/**
 * HEBY-PRODUCT-UX-1 — the same availability, stated to Heby's model as grounding DATA, so Heby can
 * say what a person can do here instead of "I cannot record a work item". Pure, like the derivation
 * above: availability is read by `readOriginationAvailability` and nothing here widens it.
 *
 *     PROPOSED  !=  HUMAN-APPROVED  !=  AUTHORIZED EXECUTION  !=  COMPLETED
 */
export const ORGANIZATIONAL_WORK_STAGES =
  "Recording organizational work has four separate stages. (1) Proposal: a person asks an in-service " +
  "agent, with 'Propose as organizational work…' under their own Heby message, to propose that message " +
  "as one work item; the result is a pending proposal, nothing more. (2) Human Governance decision: a " +
  "person with Governance authority approves or rejects it in Approvals. (3) Authorized internal " +
  "execution: only an approved, unexpired authorization can be used to record the work item. (4) " +
  "Completion: the work item exists only once that execution is recorded. Heby itself cannot approve, " +
  "authorize, execute or record anything; it can explain this path and say whether it is offered now.";

const ORIGINATION_UNAVAILABLE_GROUNDING: Readonly<Record<OriginationUnavailableReason, string>> = {
  "tenant-unavailable": "no signed-in organization context was available for the check",
  "no-agent": "this organization has no durable agent",
  "agent-retired": "this organization's agent is not in service",
  "multiple-agents": "more than one agent is in service; the person chooses which one to ask when they use the option",
  "selected-agent-unresolvable": "the selected agent is not one of this organization's agents",
  "mandate-unavailable": "the agent has no mandate in effect",
  "proposal-scope-unavailable": "the agent's mandate does not admit proposing organizational work",
  "no-work-responsibility": "the agent's mandate grants it responsibility for no work scope in service",
  "model-unavailable": "the model runtime the agent needs is not available right now",
  "external-ai-not-authorized": "this organization has not authorized the external model use agent proposals need",
  "temporarily-unavailable": "Hebun could not confirm the agent's current authority right now (unknown, not refused)",
};

/** One grounding sentence: whether the proposal path (stage 1) is offered now, and why not. */
export function describeOriginationForGrounding(availability: AgentOriginationAvailability): string {
  const truth = deriveAgentCapabilityTruth(availability);
  if (truth.status === "known" && availability.status === "available") {
    return (
      `Offered now: ${availability.agent.name} can be asked to propose ${truth.canProposeNow.join(", ")} ` +
      `(mandate revision ${truth.mandateRevision}). Checked at the time of this answer and checked again when the person asks.`
    );
  }
  const reason = truth.status === "unavailable" ? truth.reason : "temporarily-unavailable";
  return `Not offered right now: ${ORIGINATION_UNAVAILABLE_GROUNDING[reason]}.`;
}
