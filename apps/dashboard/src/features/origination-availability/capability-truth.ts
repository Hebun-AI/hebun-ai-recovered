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
 * "Not exposed" is the mandate's scope minus the kinds some released surface asks an agent about.
 * An unavailable projection yields NO capability claims — absence of an answer is not a "cannot".
 *
 * WORK-UPDATE V1 — FOUR LAYERS, KEPT APART:
 *   platform supports   the originable vocabulary (`AGENT_ORIGINABLE_ACTION_KINDS`, the mandate CHECK);
 *                       a mandate cannot name anything else, so "Mandate permits" is always inside it
 *   mandate permits     the effective scope, as the projection read it
 *   offered through UI  `canProposeNow` (the Heby proposal path, fully checked by the projection) and
 *                       `proposableFromWorkItem` (asked from one selected item; responsibility for THAT
 *                       item's domain is checked when a person asks, before any model call)
 *   authorized to run   never a property of an agent or a mandate: one Governance decision and one
 *                       permit per proposal. Nothing on this card is authorized for execution.
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

/**
 * Kinds an agent is asked about from ONE selected work item rather than from a Heby message. A fact
 * about where the product offers the question — not an authority: it lists only what the mandate
 * already permits, and every check still happens when a person asks.
 */
export const PROPOSABLE_FROM_A_SELECTED_WORK_ITEM: readonly string[] = Object.freeze(["set-work-declared-state"]);

export type AgentCapabilityTruth =
  | {
      readonly status: "known";
      readonly mandateRevision: number;
      readonly mandatePermits: readonly string[];
      readonly canProposeNow: readonly string[];
      readonly proposableFromWorkItem: readonly string[];
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
    proposableFromWorkItem: scope.filter((kind) => PROPOSABLE_FROM_A_SELECTED_WORK_ITEM.includes(kind)),
    permittedButNotExposed: scope.filter(
      (kind) => kind !== availability.originable && !PROPOSABLE_FROM_A_SELECTED_WORK_ITEM.includes(kind),
    ),
  };
}

/**
 * HEBY-PRODUCT-UX-1 — the same availability, stated to Heby's model as grounding DATA, so Heby can
 * say what a person can do here instead of "I cannot record a work item". Pure, like the derivation
 * above: availability is read by `readOriginationAvailability` and nothing here widens it.
 *
 *     PROPOSED  !=  HUMAN-APPROVED  !=  AUTHORIZED EXECUTION  !=  COMPLETED
 *
 * Worded with explicit actors and active verbs, never a bare participle: Heby repeats this text, and
 * the response validator (rightly) reads an un-negated, unattributed "approved"/"authorized" as an
 * action claim. The f81a088b wording ("an approved, unexpired authorization", "Authorized internal
 * execution") was itself withheld in production, so every faithful answer was refused.
 * `tests/heby-capability-truth` passes this constant through the real validator.
 */
export const ORGANIZATIONAL_WORK_STAGES =
  "Recording organizational work has four separate stages, and that a stage exists says nothing about " +
  "whether it has happened. (1) Proposal: when the option is offered, a person asks an in-service agent, " +
  "with 'Propose as organizational work…' under their own Heby message, to prepare a proposal that the " +
  "message become one work item; the result is a pending proposal awaiting review, nothing more. " +
  "(2) Governance decision: a human with Governance authority decides whether the proposal may proceed, " +
  "either by deciding it in Approvals or through a standing Governance authorization that a human set up " +
  "in advance with explicit limits; the agent never decides. (3) Execution: the recording can run only " +
  "under an unexpired, single-use authorization that Governance authority issues for that proposal, " +
  "through Hebun's existing governed execution path, started by a human with that authority or, where an " +
  "organization has turned on automatic delivery, by Hebun's governed machine path. (4) Completion: the " +
  "work item exists only when Hebun's authoritative execution record shows it; until then nothing has " +
  "been recorded. Whether a standing authorization or automatic delivery exists for this organization is " +
  "not in your context, so never say either way. Heby itself cannot approve, authorize, execute or " +
  "record anything; it can explain this path and say whether it is offered now.";

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
