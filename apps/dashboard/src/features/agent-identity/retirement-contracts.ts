/*
 * AGENT-ID-0.1 — the contract for RETIRING a durable, human-owned agent identity.
 *
 * ── RETIREMENT IS NOT DELETION, AND NOT NONEXISTENCE ─────────────────────────
 *
 * A tenant that has established a durable agent identity has crossed a boundary permanently. This
 * contract cannot express the sentence "no agent has ever existed here", because retirement never
 * makes that sentence true again. What it expresses is narrower and honest:
 *
 *     THE ORGANIZATION HAS WITHDRAWN THIS IDENTITY FROM SERVICE.
 *
 * The row survives. The name survives. The ownership pair survives. The creation attribution
 * survives. The genesis one-shot stays SPENT — `createDurableAgentIdentity` counts rows for the
 * tenant with no lifecycle predicate at all, so a retired identity still closes that door, and
 * reopening it is not something this file can ask for.
 *
 * ── WHAT IT DELIBERATELY CANNOT SAY ──────────────────────────────────────────
 *
 * There is no successor field, no replacement field, no reason field and no reinstatement result.
 * Succession is a separate authorization the Director has not granted; a `replacedByAgentId` written
 * here would be a fabricated fact about an agent that does not exist. A reason string would be prose
 * this authority cannot verify. Both are absent rather than optional, because an optional field is
 * an invitation and an absent one is a boundary.
 */

/** Why a durable agent identity was not retired. Closed on purpose. */
export type AgentRetirementRefusal =
  /** No server-resolved tenant + human. A caller cannot supply one; there is no parameter for it. */
  | "no-authorized-tenant-context"
  /** The identifier is absent, or is not the uuid shape `agents.id` carries. Never coerced. */
  | "malformed-agent-id"
  /** The control-plane database is not reachable. Fail closed; never fall back to memory. */
  | "authority-unavailable"
  /**
   * No such identity IN THIS TENANT. Deliberately indistinguishable from "belongs to somebody else":
   * a distinct refusal would turn this authority into an oracle for which uuids exist elsewhere.
   */
  | "agent-identity-not-found"
  /**
   * The acting human is not the identity's human owner. Ownership is the fact AGENT-ID-0 wrote, so
   * ownership is the authority retirement reads — not a role, not a band, not a permission.
   */
  | "not-the-human-owner"
  /** Already withdrawn from service. Terminal states are not re-enterable. */
  | "agent-identity-already-retired";

/**
 * What the authority returns on success. The retired identity still has a name and an owner, because
 * retirement removed neither. `retiredAt` is the server's clock, never a caller's.
 */
export interface RetiredAgentIdentity {
  readonly agentId: string;
  readonly tenantId: string;
  readonly name: string;
  /** ISO-8601, server-stamped inside the transaction that performed the transition. */
  readonly retiredAt: string;
  /** Always the literal "human". No other actor type can reach this authority. */
  readonly retiredByType: "human";
  readonly retiredById: string;
}

export type RetireDurableAgentIdentityResult =
  | { readonly status: "retired"; readonly retirement: RetiredAgentIdentity }
  | { readonly status: "refused"; readonly reason: AgentRetirementRefusal };

/**
 * `agents.id` is `uuid`, so a value that is not a uuid can never match a row. Refusing it here is not
 * a convenience: passing a non-uuid string to a uuid comparison raises a database error, and a
 * database error is not a product answer.
 */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An identifier is accepted EXACTLY as given or refused. Nothing is trimmed, padded or lowercased. */
export function isDurableAgentIdentityId(value: unknown): value is string {
  return typeof value === "string" && UUID_SHAPE.test(value);
}

/**
 * The durable agent lifecycle value that means "withdrawn from service".
 *
 * It was NOT invented for this phase. `agent_lifecycle_status` has carried `retired` since Spec 42,
 * alongside `retired_at`, and until now the enum value had zero writers. AGENT-ID-0.1 is simply its
 * first writer — which is why this phase needs no migration and why nothing downstream has to learn
 * a new state.
 */
export const RETIRED_AGENT_LIFECYCLE_STATUS = "retired" as const;
