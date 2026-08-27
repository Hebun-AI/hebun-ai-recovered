"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { createDurableAgentIdentity } from "@/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "@/features/agent-identity/retire-durable-agent-identity.server";
/*
 * The RESULT SHAPES come from the contracts modules, not from the writers. Those two files declare
 * types and refusal codes and nothing else — no database handle, no query, no authority — so
 * importing them widens this boundary's reach by exactly nothing.
 */
import type { CreateDurableAgentIdentityResult } from "@/features/agent-identity/contracts";
import type { RetireDurableAgentIdentityResult } from "@/features/agent-identity/retirement-contracts";

/*
 * ── THE AGENT-ID-0.1 BOUNDARY ───────────────────────────────────────────────────────────────────
 *
 * The ONLY client-crossable way to reach the durable agent identity authority. It is deliberately
 * thin, and it holds no gate of its own — every refusal below is produced by the authority itself,
 * so this boundary cannot drift from the rules it fronts.
 *
 * WHAT THE CLIENT MAY SEND. A name, to create. An identifier, to retire. That is the whole payload.
 *
 * WHAT THE CLIENT CANNOT SEND, BECAUSE NO FIELD EXISTS FOR IT: tenant id, owner id, owner actor
 * type, created_by, created_by_type, manager, department, authority ceiling, role, permission,
 * credential, session, lifecycle status, retirement timestamp, retiring actor, execution capability,
 * governance state, successor. The types make every one of them unrepresentable; the authorities
 * resolve the tenant and the human from the R1 session and stamp their own clock.
 *
 * FAIL CLOSED. `resolveTenantContext()` returns `null` for an unauthenticated request and for an
 * unconfigured environment alike. That null is passed straight through, and both authorities refuse
 * `no-authorized-tenant-context` on it. There is no fallback identity, no anonymous tenant, and no
 * demo path — an unreachable authority is refused, never simulated.
 *
 * WHAT THESE ACTIONS DO NOT DO. They issue no credential, open no session, grant no permission,
 * assign no role, authorize no action, widen no Governance subject type, start no runtime and
 * execute nothing. Creating an identity and retiring one are the only two effects reachable here,
 * and neither of the authorities behind them imports a credential, session, permit, decision or
 * execution module.
 *
 * WHAT THESE ACTIONS ARE NOT. They are not the in-memory Agent Registry simulation. That subsystem
 * (`features/agent-crud`, over the "memory" persistence provider) is a client-side Command Bus
 * exercise that writes no database row; it is unchanged, unreachable from here, and labelled as
 * simulation at every control it offers.
 */

/**
 * ESTABLISH this tenant's first durable agent identity (AGENT-ID-0's ceremony).
 *
 * A ONE-SHOT. A tenant that already possesses a durable agent identity — including a RETIRED one —
 * is refused `agent-identity-already-exists`, because retirement leaves the row in place and the
 * genesis count is existence, not health.
 */
export async function createDurableAgentIdentityAction(input: {
  name: string;
}): Promise<CreateDurableAgentIdentityResult> {
  const tenant = await resolveTenantContext();
  const result = await createDurableAgentIdentity(tenant, { name: input?.name });
  if (result.status === "established") revalidatePath("/agents");
  return result;
}

/**
 * RETIRE a durable agent identity, on the authority of the human who owns it.
 *
 * The identifier is the only client-shaped value, and it is a LOOKUP KEY, never authority: an id
 * belonging to another organization selects no row and is refused `agent-identity-not-found`,
 * indistinguishably from an id that does not exist.
 *
 * Retirement is a WITHDRAWAL, not a deletion. Nothing is removed, no history is erased, the tenant
 * does not return to "no agent has ever existed", and no successor is created. There is no action in
 * this file that reinstates a retired identity, because no such authority was written.
 */
export async function retireDurableAgentIdentityAction(input: {
  agentId: string;
}): Promise<RetireDurableAgentIdentityResult> {
  const tenant = await resolveTenantContext();
  const result = await retireDurableAgentIdentity(tenant, { agentId: input?.agentId });
  if (result.status === "retired") revalidatePath("/agents");
  return result;
}
