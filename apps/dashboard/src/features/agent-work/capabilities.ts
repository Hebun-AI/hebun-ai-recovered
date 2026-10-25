/*
 * agent-work/capabilities.ts — AGENT-EXECUTION-1: what an agent may DO, not only propose.
 *
 * Until now an agent's mandate bounded one thing: the action kinds it may PROPOSE for Governance
 * (`proposal_scope`). Proposing is not work. This file declares the agent WORK capabilities — bounded
 * tasks an agent performs itself when a person assigns them — and the conditions under which each is
 * available. It is a contract, not an authority:
 *
 *   - it creates no table, no lifecycle and no permission. Every condition below is answered by the
 *     authority that already owns it (Agent Identity, Agent Mandate, Organizational Work, External-AI
 *     Data Use, the Director's provider control);
 *   - it grants nothing. An assignment is not an authorization, and the output of every capability
 *     here is something a human reviews before anything consequential can follow;
 *   - it is pure and client-safe, so Heby can explain a capability without reaching a server module.
 *
 * Adding a capability is adding an entry here and the server seam that performs it; a contract test
 * pins every entry to the mandate vocabulary and the platform data-use policy, so an entry cannot
 * claim a kind or a data class those authorities do not hold.
 */
import type { AgentOriginableActionKind } from "@/features/agent-origination/contracts";

export type AgentWorkCapabilityId = "prepare-work-draft";

export interface AgentWorkCapability {
  readonly id: AgentWorkCapabilityId;
  /** The authority whose seam performs the work. The capability never writes on its own. */
  readonly performedBy: string;
  /** What the person is asking for, in their words. */
  readonly label: string;
  readonly objective: string;
  /** Side-effect class, in the action registry's vocabulary. A work capability is never consequential. */
  readonly sideEffect: "PREPARATION_ONLY";
  /**
   * The mandate condition: the agent's in-force mandate must admit at least one of these responsibility-
   * scoped kinds AND grant responsibility for the work item's recorded scope. An agent drafts only for
   * work it is already responsible for.
   */
  readonly mandateKindsAnyOf: readonly AgentOriginableActionKind[];
  /** The External-AI Data Use purpose and classes the model call declares. The gate enforces them. */
  readonly dataUse: { readonly purpose: "assistance"; readonly dataClasses: readonly ("conversation" | "work-artifact")[] };
  /** What the agent is given. Nothing else reaches the model. */
  readonly input: readonly string[];
  readonly output: string;
  /** When the task counts as done, and who decides. */
  readonly completion: string;
  /** What the agent cannot do under this capability. Shown to the person before they assign. */
  readonly cannot: readonly string[];
  /** Governance authorization needed to perform the capability itself. */
  readonly authorizationRequired: false;
}

export const AGENT_WORK_CAPABILITIES: readonly AgentWorkCapability[] = Object.freeze([
  Object.freeze({
    id: "prepare-work-draft" as const,
    performedBy: "work-artifacts (prepareWorkArtifact); the person links the result through organizational-work's own action",
    label: "Prepare a draft for this work",
    objective: "Write one draft — a plan, a message or content — for a work item the agent is responsible for.",
    sideEffect: "PREPARATION_ONLY" as const,
    mandateKindsAnyOf: Object.freeze(["record-work", "set-work-declared-state"] as const),
    dataUse: Object.freeze({ purpose: "assistance" as const, dataClasses: Object.freeze(["conversation", "work-artifact"] as const) }),
    input: Object.freeze([
      "your instruction, in your words",
      "the draft's title and type you choose",
      "your organization's existing drafts, as Operations already shows them to Heby",
    ]),
    output: "One draft authored by the agent, which you then link to this work item as its evidence.",
    completion: "Done when a person with Governance authority accepts the draft in Operations.",
    cannot: Object.freeze([
      "read this work item or the work register — the work item is never sent to the model",
      "send, publish or change anything — a draft is text for review",
      "change the work item's state",
      "approve its own draft",
    ]),
    authorizationRequired: false as const,
  }),
]);

export function agentWorkCapability(id: AgentWorkCapabilityId): AgentWorkCapability {
  return AGENT_WORK_CAPABILITIES.find((capability) => capability.id === id)!;
}
