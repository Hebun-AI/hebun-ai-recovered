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
import { and, desc, eq } from "drizzle-orm";
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

/* ═══════════════════════════════════════════════════════════════════════════
 * RUNTIME LIVENESS — ONE AGENT, NO TENANT CONTEXT, NO WIDENING.
 *
 * ── WHY A SECOND READER IN THE SAME AUTHORITY, AND NOT A SECOND AUTHORITY ───
 *
 * `readDurableAgentIdentityState` answers a question a PERSON asked inside one organization, so it
 * takes the `TenantContext` only an authenticated session mints. A machine execution path has no
 * such context and must never manufacture one — so it cannot use that reader, and inventing a
 * second place that knows about agents would be worse than either problem.
 *
 * This is therefore the same authority, reading the same table, applying the SAME `inService`
 * predicate, exposed in the shape a runtime can honestly call: two authoritative ids it already
 * holds, and no filter it can widen. It is the shape TRH-25 established when the observation
 * register needed a runtime read beside its product readers.
 *
 * ── WHY BOTH IDS, AND WHY THE TENANT IS PART OF THE PREDICATE ───────────────
 *
 * The caller supplies a tenant it READ off a permit and an agent it READ off that permit's request
 * — never values it chose. Matching on both means an agent id that belongs to another organization
 * resolves to `unknown-agent` rather than to that other tenant's row, so a mismatched pair fails
 * closed instead of crossing a boundary.
 *
 * ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 *
 * It reads. It never writes, never retires, never creates and never decides whether an act may
 * happen — lifecycle stays with the ceremonies that own it, and eligibility stays with the caller.
 * ═════════════════════════════════════════════════════════════════════════ */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DurableAgentRuntimeLiveness =
  /** The agent exists in that tenant and is in service. */
  | "in-service"
  /** It exists in that tenant and has been retired or is otherwise out of service. */
  | "not-in-service"
  /** No such agent in that tenant — including an id belonging to a different organization. */
  | "unknown-agent"
  /** The control plane could not be reached. NEVER collapsed into any answer above. */
  | "unavailable";

/**
 * Is this durable agent, in this tenant, in service RIGHT NOW?
 *
 * FAIL-CLOSED BY CONSTRUCTION: every non-`in-service` answer is a refusal for any caller that needs
 * permission, and `unavailable` is reported as itself so an outage is never recorded as a retirement.
 */
export async function readDurableAgentRuntimeLiveness(
  tenantId: string,
  agentId: string,
  deps: AgentIdentityReadDeps = {},
): Promise<DurableAgentRuntimeLiveness> {
  const tenant = (tenantId ?? "").trim();
  const agent = (agentId ?? "").trim();
  /* A malformed id is not a database question, and not an outage either. */
  if (!UUID_RE.test(tenant) || !UUID_RE.test(agent)) return "unknown-agent";

  const db = resolveDbOrNull(deps);
  if (!db) return "unavailable";

  try {
    const rows = await db
      .select({ retiredAt: agents.retiredAt, lifecycle: agents.agentLifecycleStatus })
      .from(agents)
      .where(and(eq(agents.tenantId, tenant), eq(agents.id, agent)))
      .limit(1);

    const row = rows[0];
    if (!row) return "unknown-agent";
    /* THE SAME PREDICATE the product reader applies, not a second definition of "in service". */
    return row.retiredAt === null && row.lifecycle !== RETIRED_AGENT_LIFECYCLE_STATUS
      ? "in-service"
      : "not-in-service";
  } catch {
    return "unavailable";
  }
}
