/*
 * work-artifacts/agent-authorship.server.ts — WHICH durable agent authored agent-generated work
 * (AGENT-RUNTIME-0).
 *
 * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────────
 *
 * R3W gave the Heby preparation path a truthful actor TYPE and a false actor ID: the revision said
 * `agent` and named `tenant.userId` — a person. The row therefore asserted that a machine wrote the
 * bytes while pointing at the human who asked for them, and the two halves of the canonical
 * polymorphic actor pair (S2) disagreed with each other.
 *
 * AGENT-ID-0 made a durable agent identity a real, tenant-scoped, human-owned row. This module is
 * the seam that carries that identity into authorship, and nothing else.
 *
 * ── IT IS NOT A SECOND AGENT LOOKUP AUTHORITY ────────────────────────────────
 *
 * It reads NOTHING itself. It contains no drizzle query, no table symbol, and no database handle of
 * its own; it calls `readDurableAgentIdentityState`, the released AGENT-ID-0.1 read seam, which is
 * already tenant-scoped by `eq(agents.tenantId, tenant.tenantId)` and already derives `inService`
 * from the absence of retirement. What this module adds is a DECISION over that state — which of
 * the tenant's identities may be recorded as an author — and a value that proves the decision was
 * actually taken.
 *
 * ── AUTHORSHIP IS NOT AUTHORITY ──────────────────────────────────────────────
 *
 * Resolving an authorship grants nothing. It issues no credential, opens no session, and confers no
 * role, membership, permission, permit or execution capability. The human `TenantContext` remains
 * the authorization context for the whole request; the agent identity supplies a NAME for the
 * author column and nothing more. Identity attribution is not authentication, authentication is not
 * authorization, and authorization is not execution.
 *
 * ── WHY THE VALUE IS BRANDED ─────────────────────────────────────────────────
 *
 * The writer must be unable to record an agent author that this module never verified. A plain
 * `{ agentId: string }` parameter would let any caller — today's or a future one — hand the writer
 * a uuid it read off a request body. `AgentAuthorship` carries a module-private symbol, so:
 *
 *   • no other module can CONSTRUCT one (it cannot name the key), and
 *   • no other module can FAKE one with a type cast, because `isAgentAuthorship` checks the symbol
 *     at runtime and the writer calls it.
 *
 * That is what makes "a client-supplied agent id cannot become an author" structural rather than a
 * matter of discipline.
 *
 * ── WHAT IT REFUSES, AND WHY IT NEVER SUBSTITUTES ────────────────────────────
 *
 * Every failure is a typed refusal. There is no fallback to the human id, no fabricated uuid, and no
 * silent downgrade of authorship to `human`: a model wrote the bytes, so recording a person as the
 * author would be the same class of lie this phase exists to remove. Availability is not worth a
 * false record.
 *
 * Server-only.
 */
import {
  readDurableAgentIdentityState,
  type AgentIdentityReadDeps,
} from "@/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

/*
 * The brand. Module-private ON PURPOSE — it is never exported, so no other module can write this
 * key into an object literal, and it exists at RUNTIME so a type cast cannot forge one either.
 */
const AGENT_AUTHORSHIP_BRAND: unique symbol = Symbol("hebun.work-artifacts.agent-authorship");

/**
 * Proof that a real, in-service, tenant-owned durable agent identity was resolved through the
 * authoritative read seam — and therefore that `agentId` may be recorded as an author.
 *
 * Obtainable ONLY from `resolveAgentAuthorship`. It is evidence of a lookup, never a grant.
 */
export interface AgentAuthorship {
  /** The durable agent identity's `agents.id`. Server-derived; no caller supplies it. */
  readonly agentId: string;
  readonly [AGENT_AUTHORSHIP_BRAND]: true;
}

/**
 * Why no durable agent may be recorded as the author. Closed on purpose, and each value is a fact
 * about the organization's state rather than a judgement about the work.
 */
export type AgentAuthorshipRefusal =
  /** No server-resolved tenant. There is no parameter through which a caller could supply one. */
  | "no-authorized-tenant-context"
  /**
   * The identity authority could not be reached. Deliberately DISTINCT from "no identity": telling
   * a tenant that owns an agent that it owns none would be a fabricated absence.
   */
  | "agent-identity-authority-unavailable"
  /** This tenant has never established a durable agent identity. Genesis is unspent. */
  | "no-durable-agent-identity"
  /** Every durable identity this tenant owns has been withdrawn from service. */
  | "durable-agent-identity-retired"
  /**
   * More than one identity is in service, so "the agent" does not name one thing. Unreachable under
   * today's one-shot genesis; present as a BOUNDARY rather than as an invitation, because the day a
   * second durable agent exists the caller must say which one — never this module by picking.
   */
  | "ambiguous-durable-agent-identity";

export type ResolveAgentAuthorshipResult =
  | { readonly status: "resolved"; readonly authorship: AgentAuthorship }
  | { readonly status: "refused"; readonly reason: AgentAuthorshipRefusal };

/**
 * Whether a value really came from this module.
 *
 * The writer's guard. A `value as AgentAuthorship` cast satisfies the compiler and fails here,
 * which is the whole reason the brand exists at runtime rather than only in the type system.
 */
export function isAgentAuthorship(value: unknown): value is AgentAuthorship {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[AGENT_AUTHORSHIP_BRAND] === true &&
    typeof (value as AgentAuthorship).agentId === "string" &&
    (value as AgentAuthorship).agentId.length > 0
  );
}

/**
 * Resolve WHICH durable agent identity may author agent-generated work for this tenant.
 *
 * The tenant comes from an already-resolved server-side context and the agent id is derived from
 * what the authority returned — there is no parameter for an agent id, so a caller cannot name
 * another organization's agent, a retired agent, or an agent that does not exist.
 *
 * NOT HARD-CODED TO ANY ONE AGENT. No name, no genesis identifier and no production uuid appears
 * here. The rule is a property — "the tenant's single in-service durable identity" — so the day
 * Marketing or Finance exists as a durable identity, this seam needs a caller-supplied selection
 * verified against the same read, not a new runtime.
 */
export async function resolveAgentAuthorship(
  tenant: TenantContext | null,
  deps: AgentIdentityReadDeps = {},
): Promise<ResolveAgentAuthorshipResult> {
  if (typeof window !== "undefined") {
    throw new Error("Agent authorship resolution is server-only.");
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
    authorship: { agentId: serving[0]!.agentId, [AGENT_AUTHORSHIP_BRAND]: true },
  };
}
