/*
 * action-authorization/agent-proposer.server.ts — WHICH durable agent may be recorded as the
 * proposer of a consequential action (AGENT-PROPOSAL-1).
 *
 * ── WHY THIS LIVES WITH THE PROPOSAL WRITER ──────────────────────────────────
 *
 * The authority that records a proposer owns the contract for who may be one. Putting this
 * anywhere else would let a caller define its own idea of a legitimate proposer and hand it to a
 * writer that had no way to disagree.
 *
 * ── IT IS NOT `AgentAuthorship`, AND THE DIFFERENCE IS NOT COSMETIC ──────────
 *
 * AGENT-RUNTIME-0 mints `AgentAuthorship` for "this agent wrote these bytes". This mints
 * `AgentProposer` for "this agent originated this act". They are different claims about different
 * facts, and a person can perfectly well propose sending a draft a machine wrote. Sharing one
 * token would mean an artifact-authorship proof silently unlocked a proposal write — one concept
 * quietly becoming a second authority. The two brands are deliberately incompatible, and a test
 * asserts that neither is assignable to the other.
 *
 * What IS shared is the underlying fact: both read `readDurableAgentIdentityState`, the released
 * AGENT-ID-0.1 seam. This module adds no query, no table and no lifecycle rule of its own.
 *
 * ── ATTRIBUTION IS NOT AUTHORITY ─────────────────────────────────────────────
 *
 * Resolving a proposer grants nothing: no credential, no session, no membership, no role, no
 * permission, no permit, no execution. The human `TenantContext` remains the authorization context
 * for the whole request. `proposed_by_actor_type` carries no `human` CHECK precisely so a real
 * agent may propose, while the approver and the permit authorizer stay CHECK-constrained to
 * `human` in the database. Nothing here touches those.
 *
 * ── NO FALLBACK, EVER ────────────────────────────────────────────────────────
 *
 * Every failure is a typed refusal. There is no fallback to the acting human's id, no fabricated
 * uuid, and no "if no agent, record it as human" — that last one would be the exact false
 * attribution this lineage has already repaired twice. Availability is not worth a false record.
 *
 * Server-only.
 */
import {
  readDurableAgentIdentityState,
  type AgentIdentityReadDeps,
} from "@/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

/*
 * The brand. Module-private ON PURPOSE — never exported, so no other module can write this key
 * into an object literal, and it exists at RUNTIME so a type cast cannot forge one either.
 */
const AGENT_PROPOSER_BRAND: unique symbol = Symbol("hebun.action-authorization.agent-proposer");

/**
 * Proof that a real, in-service, tenant-owned durable agent identity was resolved through the
 * authoritative read seam — and therefore that `agentId` may be recorded as a proposer.
 *
 * Obtainable ONLY from `resolveAgentProposer`. It is evidence of a lookup, never a grant.
 */
export interface AgentProposer {
  /** The durable agent identity's `agents.id`. Server-derived; no caller supplies it. */
  readonly agentId: string;
  readonly [AGENT_PROPOSER_BRAND]: true;
}

/**
 * Why no durable agent may be recorded as the proposer. Closed on purpose, and each value is a
 * fact about the organization's state rather than a judgement about the proposal.
 */
export type AgentProposerRefusal =
  /** No server-resolved tenant. There is no parameter through which a caller could supply one. */
  | "no-authorized-tenant-context"
  /**
   * The identity authority could not be reached. Deliberately DISTINCT from "no identity": telling
   * a tenant that owns an agent that it owns none would be a fabricated absence.
   */
  | "agent-identity-authority-unavailable"
  /** This tenant has never established a durable agent identity. */
  | "no-durable-agent-identity"
  /** Every durable identity this tenant owns has been withdrawn from service. */
  | "durable-agent-identity-retired"
  /**
   * More than one identity is in service, so "the agent" does not name one thing.
   *
   * THIS IS THE MULTI-AGENT BOUNDARY, and it is a refusal rather than a pick for a reason worth
   * stating: the day Marketing and Finance both serve, a resolver that quietly chose one would
   * attribute a Finance proposal to Marketing. Selection must then become an explicit,
   * server-derived input verified through this same read — never a guess made here.
   */
  | "ambiguous-durable-agent-identity";

export type ResolveAgentProposerResult =
  | { readonly status: "resolved"; readonly proposer: AgentProposer }
  | { readonly status: "refused"; readonly reason: AgentProposerRefusal };

/**
 * Whether a value really came from this module.
 *
 * The writer's guard. A `value as AgentProposer` cast satisfies the compiler and fails here, which
 * is the whole reason the brand exists at runtime rather than only in the type system.
 */
export function isAgentProposer(value: unknown): value is AgentProposer {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[AGENT_PROPOSER_BRAND] === true &&
    typeof (value as AgentProposer).agentId === "string" &&
    (value as AgentProposer).agentId.length > 0
  );
}

/**
 * Resolve WHICH durable agent identity may be recorded as a proposer for this tenant.
 *
 * The tenant comes from an already-resolved server-side context and the agent id is derived from
 * what the authority returned — there is no parameter for an agent id, so no caller, and certainly
 * no browser, can name another organization's agent, a retired agent, or an agent that does not
 * exist. A raw uuid does not become authoritative merely because a row carries it.
 *
 * NOT HARD-CODED TO ANY ONE AGENT. No name, no genesis identifier and no literal uuid appears
 * here; the rule is a property of the tenant's identity state.
 */
export async function resolveAgentProposer(
  tenant: TenantContext | null,
  deps: AgentIdentityReadDeps = {},
): Promise<ResolveAgentProposerResult> {
  if (typeof window !== "undefined") {
    throw new Error("Agent proposer resolution is server-only.");
  }
  if (!tenant?.tenantId) {
    return { status: "refused", reason: "no-authorized-tenant-context" };
  }

  const state = await readDurableAgentIdentityState(tenant, deps);
  if (state.status === "unavailable") {
    return { status: "refused", reason: "agent-identity-authority-unavailable" };
  }
  if (state.identities.length === 0) {
    return { status: "refused", reason: "no-durable-agent-identity" };
  }

  /* `inService` is DERIVED by the read seam from the absence of retirement, never stored. */
  const serving = state.identities.filter((identity) => identity.inService);
  if (serving.length === 0) {
    return { status: "refused", reason: "durable-agent-identity-retired" };
  }
  if (serving.length > 1) {
    return { status: "refused", reason: "ambiguous-durable-agent-identity" };
  }

  return {
    status: "resolved",
    proposer: { agentId: serving[0]!.agentId, [AGENT_PROPOSER_BRAND]: true },
  };
}
