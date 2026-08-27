/*
 * action-authorization/agent-proposer-display.server.ts — turning an agent proposer id into a name
 * a human can read (AGENT-PROPOSAL-2).
 *
 * ── WHY THIS EXISTS NOW AND NOT BEFORE ───────────────────────────────────────
 *
 * APP-2 deliberately did NOT project `proposed_by_actor_id` to the client, and said why: "a raw
 * uuid is not a name, no identity display seam exists to turn it into one". That was true. AGENT-ID
 * built the durable identity, AGENT-PROPOSAL-1 made an agent a real proposer, and the missing piece
 * was exactly this — the seam that answers "which agent?" without inventing anything.
 *
 * ── IT IS NOT A SECOND IDENTITY STORE ────────────────────────────────────────
 *
 * No table, no query, no handle. It calls `readDurableAgentIdentityState`, the released AGENT-ID-0.1
 * read seam, which is already tenant-scoped by `eq(agents.tenantId, tenant.tenantId)`. Cross-tenant
 * resolution is therefore not something this module has to defend against — it has no way to ask.
 *
 * ── THE RAW ID STILL NEVER REACHES THE BROWSER ───────────────────────────────
 *
 * APP-2's data-minimization guarantee is unchanged. The id is consulted HERE, on the server, and
 * what crosses to the client is a display name. An id that resolves to nothing yields `null`, never
 * the uuid as a fallback label: showing an internal identifier because a lookup failed is exactly
 * the leak the minimization rule exists to prevent.
 *
 * ── RETIREMENT DOES NOT ERASE AUTHORSHIP ─────────────────────────────────────
 *
 * A retired agent's past proposal keeps its name. The identity row survives retirement by design,
 * so the lookup still answers, and `inService` travels with the name so a surface can say the agent
 * has since been withdrawn WITHOUT implying the proposal is invalid. Hiding the name of a retired
 * proposer would make the record less true, not safer.
 *
 * Server-only. Reads only.
 */
import {
  readDurableAgentIdentityState,
  type AgentIdentityReadDeps,
} from "@/features/agent-identity/read-durable-agent-identity.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";

/** The minimum a review surface needs to name a proposer. No id, no profile, no configuration. */
export interface AgentProposerDisplay {
  readonly name: string;
  /** Derived by the read seam from the absence of retirement. Never stored. */
  readonly inService: boolean;
}

/**
 * Resolve display identities for the agent ids that appear in one tenant's proposals.
 *
 * Returns a map keyed by agent id. An id that this tenant does not own is simply ABSENT from the
 * result — there is no "unknown agent" placeholder, because a caller that got one would have to
 * decide what to render for it, and the honest answer is that the surface shows the actor class it
 * already had.
 *
 * An UNAVAILABLE identity authority yields an empty map rather than a throw. A review queue that
 * cannot name its proposers is degraded; a review queue that fails to load is broken, and the
 * second is a worse outcome for a human trying to decide about a pending consequential act.
 */
export async function resolveAgentProposerDisplays(
  tenant: TenantContext | null,
  agentIds: readonly string[],
  deps: AgentIdentityReadDeps = {},
): Promise<ReadonlyMap<string, AgentProposerDisplay>> {
  if (typeof window !== "undefined") {
    throw new Error("Agent proposer display resolution is server-only.");
  }
  const empty: ReadonlyMap<string, AgentProposerDisplay> = new Map();
  if (!tenant?.tenantId || agentIds.length === 0) return empty;

  const state = await readDurableAgentIdentityState(tenant, deps);
  if (state.status !== "known") return empty;

  const wanted = new Set(agentIds);
  const resolved = new Map<string, AgentProposerDisplay>();
  for (const identity of state.identities) {
    if (!wanted.has(identity.agentId)) continue;
    resolved.set(identity.agentId, { name: identity.name, inService: identity.inService });
  }
  return resolved;
}
