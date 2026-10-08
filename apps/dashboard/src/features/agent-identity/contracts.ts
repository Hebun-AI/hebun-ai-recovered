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
  /**
   * AP-1 — another IN-SERVICE identity of this organization already carries this name, compared
   * canonically (NFC, then simple Unicode lower-case). Decided by `agents_tenant_name_in_service_uq`.
   */
  | "agent-name-in-use"
  /** AP-1 — every Governance decision needs a reason, and registering an agent is one. */
  | "justification-required"
  /** This organization has no Governance authority at all, or it could not be resolved (APF-1). */
  | "no-governance-authority"
  /** Governance exists and the acting human does not hold it (APF-1). */
  | "not-the-governance-authority";

/*
 * AP-1 — REGISTERING AN AGENT IS A GOVERNANCE DECISION.
 *
 * Each identity is brought into existence by its own decision in the `agent-registration` domain —
 * the enum value the foundation baseline reserved for exactly this and every later domain declined
 * to borrow. The subject is the agent row itself (its id is minted before the decision so the two
 * can name each other in one transaction), and `approve` is mapped to its own outcome so the
 * decision can never be filed as a membership admission.
 *
 * MULTI-IDENTITY != UNLIMITED. The singleton count is gone; the ceiling is now that every identity
 * costs one recorded decision by the organization's Governance authority. No product policy about
 * how many agents an organization should have is implied.
 */
export const AGENT_REGISTRATION_SUBJECT_TYPE = "agent" as const;
export const AGENT_REGISTRATION_DECISION_TYPE = "approve" as const;
export const AGENT_REGISTRATION_DOMAIN = "agent-registration" as const;
export const AGENT_REGISTRATION_OUTCOME = "agent-registered" as const;

/**
 * L-1b — RETIREMENT IS A GOVERNANCE DECISION TOO, IN ITS OWN DOMAIN.
 *
 * Registration's domain records an agent coming into existence and nothing else, so a retirement is
 * filed under `agent-lifecycle`. Its subject type is its own (`agent-lifecycle`, subject id = the
 * agent's id) because the decision authority routes domain and outcome by subject, and the `agent`
 * subject must keep meaning "registered". The decision type is `revoke`; the outcome is mapped on the
 * subject FIRST, so it can never be recorded as the generic "Governance authority was revoked" —
 * retiring an agent takes nobody's authority away. Every authority reader that interprets `revoke`
 * filters on `subject_type = 'governance_decision'`, so this subject is invisible to them.
 */
export const AGENT_LIFECYCLE_SUBJECT_TYPE = "agent-lifecycle" as const;
export const AGENT_RETIREMENT_DECISION_TYPE = "revoke" as const;
export const AGENT_LIFECYCLE_DOMAIN = "agent-lifecycle" as const;
export const AGENT_RETIRED_OUTCOME = "agent-retired" as const;

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
 * Characters a name may not contain: C0/C1 controls, soft hyphen, zero-width and directional marks,
 * bidi embeddings/overrides, word joiners and the BOM. The SAME set as `agents_name_visible_chk`
 * (AP-1), so the writer refuses what the database would.
 */
const INVISIBLE_NAME_CHARACTERS =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/u;

/**
 * A name is accepted EXACTLY as given or refused. Nothing is trimmed, folded, or repaired — a
 * repaired name is a different name, and this authority has no mandate to rename anybody's agent.
 * Uniqueness is decided canonically by the database; the stored name is still the typed one.
 */
export function isWellFormedAgentName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_AGENT_NAME_LENGTH) return false;
  if (INVISIBLE_NAME_CHARACTERS.test(value)) return false;
  return value.trim() === value;
}

/**
 * AP-1 — WHICH agent a caller asks for, when it asks.
 *
 * A LOOKUP KEY, never authority: the resolvers verify it against this tenant's own identity read
 * and refuse an id that is malformed, foreign, unknown or retired. Omitted, the resolvers behave
 * exactly as before AP-1 — the single in-service identity, or `ambiguous-durable-agent-identity`.
 */
export interface AgentSelection {
  readonly agentId?: string | null;
}

/** Why an explicitly selected agent was not resolved. Foreign and unknown are indistinguishable. */
export type AgentSelectionRefusal = "selected-agent-unresolvable" | "selected-agent-retired";
