/*
 * L-2b — the contract for SUSPENDING and REACTIVATING a durable, human-owned agent identity.
 *
 * Suspension is the reversible sibling of retirement: the organization stops an agent from acting
 * without withdrawing its identity. Reactivation returns a SUSPENDED agent to service, and only a
 * suspended one — a retired agent is never reactivated, because retirement is terminal.
 *
 * Reactivation restores SERVICE, and writes nothing else. Suspension blocked existing permits and
 * envelopes at USE without ending them, so reactivation is REFUSED while any is still usable: it
 * never silently restores execution authority granted before it.
 */
import { isDurableAgentIdentityId } from "./retirement-contracts";

export { isDurableAgentIdentityId };

/** Why a suspension or reactivation was not performed. Closed on purpose. */
export type AgentServiceTransitionRefusal =
  /** No server-resolved tenant + human. A caller cannot supply one; there is no parameter for it. */
  | "no-authorized-tenant-context"
  /** The identifier is absent, or is not the uuid shape `agents.id` carries. Never coerced. */
  | "malformed-agent-id"
  /** Every Governance decision needs a stated reason. */
  | "justification-required"
  /** The control-plane database is not reachable. Fail closed. */
  | "authority-unavailable"
  /** No such identity IN THIS TENANT — indistinguishable from another organization's agent. */
  | "agent-identity-not-found"
  /** The acting human is not the identity's human owner. */
  | "not-the-human-owner"
  /** This organization has no Governance authority at all, or it could not be resolved. */
  | "no-governance-authority"
  /** Governance exists and the acting human does not hold it. */
  | "not-the-governance-authority"
  /** Retired is terminal: it can be neither suspended nor reactivated. */
  | "agent-identity-retired"
  /** Suspend only: the agent is already suspended. */
  | "agent-already-suspended"
  /** Reactivate only: the agent is in service, so there is nothing to reactivate. */
  | "agent-not-suspended"
  /** The recorded lifecycle fields disagree (L-2a `indeterminate`). Never repaired by a transition. */
  | "agent-service-status-indeterminate"
  /** Reactivate only: the agent holds an unexpired, unspent, unrevoked permit. Revoke it or let it expire. */
  | "agent-has-usable-permits"
  /** Reactivate only: the agent's standing envelope is active and its window not closed. Withdraw it or let it close. */
  | "agent-has-valid-standing-envelope";

export type AgentServiceTransition = "suspended" | "reactivated";

export interface AgentServiceTransitionRecord {
  readonly agentId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly transition: AgentServiceTransition;
  /** ISO-8601, server-stamped inside the transaction that performed the transition. */
  readonly at: string;
  readonly byType: "human";
  readonly byId: string;
  /** The `agent-lifecycle` decision and session written in the same transaction. */
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
}

export type AgentServiceTransitionResult =
  | { readonly status: AgentServiceTransition; readonly record: AgentServiceTransitionRecord }
  | { readonly status: "refused"; readonly reason: AgentServiceTransitionRefusal };

/** The lifecycle value suspension writes. Present in the enum since Spec 42; L-2b is its first writer. */
export const SUSPENDED_AGENT_LIFECYCLE_STATUS = "suspended" as const;
