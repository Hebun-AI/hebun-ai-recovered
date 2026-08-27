/*
 * AGENT-ID-0 — the contract for a durable, human-owned agent identity.
 *
 * An agent identity is a NAME AND AN OWNER, and nothing else. It is not a credential, not a
 * session, not a permission, not a role, not an authorization, and not a running thing. Everything
 * this file refuses to describe is refused deliberately: there is no field here through which a
 * caller could ask for authority, because the phase that would grant it has not happened.
 *
 * The refusal reasons below are PRODUCT reason codes. They are what a caller reads, what a test
 * matches on, and what a bite-proof must see before it may claim a guard bit. They are not prose.
 */

/** Why a durable agent identity was not established. Closed on purpose. */
export type AgentIdentityRefusal =
  /** No server-resolved tenant + human. A caller cannot supply one; there is no parameter for it. */
  | "no-authorized-tenant-context"
  /** The name is absent, empty, padded, or longer than the boundary allows. Never trimmed. */
  | "malformed-agent-name"
  /** The control-plane database is not reachable. Fail closed; never fall back to memory. */
  | "authority-unavailable"
  /** The context named a human who is not a live row in `users`. Ownership must be real. */
  | "human-owner-unresolved"
  /** This tenant already possesses a durable agent identity. This authority is a one-shot. */
  | "agent-identity-already-exists";

/**
 * What the authority returns on success. Deliberately narrow: the caller learns the identity's id,
 * its tenant, its name, and who owns it. No lifecycle, no health, no capability, no posture —
 * because none of those were written.
 */
export interface DurableAgentIdentity {
  readonly agentId: string;
  readonly tenantId: string;
  readonly name: string;
  /** Always the literal "human". The column is polymorphic; this authority is not. */
  readonly humanOwnerType: "human";
  readonly humanOwnerId: string;
}

export type CreateDurableAgentIdentityResult =
  | { readonly status: "established"; readonly identity: DurableAgentIdentity }
  | { readonly status: "refused"; readonly reason: AgentIdentityRefusal };

/**
 * The longest name a durable agent identity may carry. `agents.name` is `text` with no database
 * bound, so the bound is this constant's job. Chosen to match the display surfaces that already
 * exist rather than an arbitrary round number.
 */
export const MAX_AGENT_NAME_LENGTH = 120;

/**
 * A name is accepted EXACTLY as given or refused. Nothing is trimmed, folded, or repaired — a
 * repaired name is a different name, and this authority has no mandate to rename anybody's agent.
 */
export function isWellFormedAgentName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_AGENT_NAME_LENGTH) return false;
  return value.trim() === value;
}
