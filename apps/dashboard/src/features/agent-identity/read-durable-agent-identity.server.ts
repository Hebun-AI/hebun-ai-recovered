/*
 * AGENT-ID-0.1 — reading this tenant's durable agent identity.
 *
 * READ-ONLY, and read-only in the way that can be proved: this module contains no insert, no update,
 * no delete and no transaction. It grants nothing, decides nothing, and starts nothing.
 *
 * ── WHY THE CREATION SURFACE NEEDS IT ────────────────────────────────────────
 *
 * The genesis ceremony is a ONE-SHOT. A surface that offers it without knowing whether it has
 * already been spent would present an action that is guaranteed to be refused — and, worse, would
 * leave the human unable to see the identity they already own. Disclosure of a one-way door requires
 * knowing which side of it the tenant is standing on.
 *
 * ── IT IS NOT A SECOND CANONICAL READER ──────────────────────────────────────
 *
 * `canonical-read/actor-resolution.ts` remains the canonical seam that resolves an agent AS AN
 * ACTOR — that is a different question, asked by a different subsystem, and it is byte-unchanged by
 * this phase. This function answers only the feature's own question: what durable identity does this
 * tenant possess, and is it still in service. It reads through the same control-plane handle and the
 * same drizzle table its sibling authorities write through.
 *
 * Server-only.
 */
import { desc, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { RETIRED_AGENT_LIFECYCLE_STATUS } from "./retirement-contracts";

export interface AgentIdentityReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/**
 * One durable agent identity as the product surface needs to understand it.
 *
 * `inService` is DERIVED, never stored: it is the absence of retirement, not a column. Storing a
 * boolean beside the timestamp would create two facts that can disagree.
 */
export interface DurableAgentIdentityRecord {
  readonly agentId: string;
  readonly name: string;
  readonly humanOwnerId: string | null;
  readonly humanOwnerType: string | null;
  readonly createdAt: string;
  readonly retiredAt: string | null;
  readonly inService: boolean;
}

/**
 * What this tenant's durable agent identity state actually is.
 *
 * `genesisSpent` is the SAME arithmetic `createDurableAgentIdentity` performs — a count of rows for
 * the tenant with no lifecycle and no soft-delete predicate. It is true for a retired identity
 * exactly as it is for a serving one, because retirement leaves the row in place. A surface reading
 * this can therefore never tell a human that the door has reopened.
 *
 * `unavailable` is a THIRD state, distinct from "no identity": a surface must not render "this
 * tenant has never created an agent" when the truth is that the authority could not be reached.
 */
export type DurableAgentIdentityState =
  | { readonly status: "unavailable" }
  | {
      readonly status: "known";
      readonly genesisSpent: boolean;
      readonly identities: readonly DurableAgentIdentityRecord[];
    };

function resolveDbOrNull(deps: AgentIdentityReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** Read this tenant's durable agent identity state. Tenant-scoped; no caller can widen the scope. */
export async function readDurableAgentIdentityState(
  tenant: TenantContext | null,
  deps: AgentIdentityReadDeps = {},
): Promise<DurableAgentIdentityState> {
  if (!tenant?.tenantId) return { status: "unavailable" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "unavailable" };

  try {
    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        humanOwnerId: agents.humanOwnerId,
        humanOwnerType: agents.humanOwnerType,
        createdAt: agents.createdAt,
        retiredAt: agents.retiredAt,
        lifecycle: agents.agentLifecycleStatus,
      })
      .from(agents)
      .where(eq(agents.tenantId, tenant.tenantId))
      .orderBy(desc(agents.createdAt));

    return {
      status: "known",
      /* The genesis predicate, restated: existence, not health. A retired row still spends it. */
      genesisSpent: rows.length > 0,
      identities: rows.map((row) => ({
        agentId: row.id,
        name: row.name,
        humanOwnerId: row.humanOwnerId,
        humanOwnerType: row.humanOwnerType,
        createdAt: row.createdAt.toISOString(),
        retiredAt: row.retiredAt ? row.retiredAt.toISOString() : null,
        inService:
          row.retiredAt === null && row.lifecycle !== RETIRED_AGENT_LIFECYCLE_STATUS,
      })),
    };
  } catch {
    return { status: "unavailable" };
  }
}
