/*
 * AGENT-ID-0 — THE AUTHORITATIVE DURABLE AGENT IDENTITY WRITER.
 *
 * This module owns exactly one consequential transition:
 *
 *     NONEXISTENT AGENT IDENTITY  ->  DURABLE HUMAN-OWNED AGENT IDENTITY
 *
 * It is not CRUD. There is no update, no delete, no archive, no restore, no activation. Those verbs
 * are absent rather than guarded, which is a stronger claim: a caller cannot reach a capability that
 * was never written.
 *
 * WHAT THIS AUTHORITY IS NOT
 * --------------------------
 * `features/persistence/supabase-postgres-adapter.ts` contains generic agent persistence
 * primitives that predate this phase. They are a PASSIVE persistence substrate — the file says so
 * in its own first line — and they have zero agent write callers. They also cannot express what
 * this phase exists to express: the strings `human_owner`, `manager_actor` and `created_by` do not
 * occur in that file at all, so a row written through them is ownerless and unattributed.
 *
 * This module therefore does not extend, wrap, call, or import that adapter. The topology is the
 * one Knowledge already proves: generic primitives live in the persistence adapter, domain
 * authority lives in the feature and writes through the control-plane handle. Agents now match
 * Knowledge. That the generic primitives still exist is recorded debt, not a second authority.
 *
 * WHAT AN AGENT IDENTITY BUYS
 * ---------------------------
 * Nothing but its own existence. No credential, no session, no permission, no role, no membership,
 * no governance decision, no permit, no execution attempt, no provider binding. The seven
 * human-only CHECK constraints that guard every approve/authorize surface are untouched by this
 * file, and an agent that cannot authenticate cannot exercise any of them.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import { users } from "@/db/schema/user";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isWellFormedAgentName,
  type CreateDurableAgentIdentityResult,
} from "./contracts";

export interface AgentIdentityDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/*
 * `agents` carries NO unique index — not on name, not on anything but the primary key. An
 * application-level pre-check is therefore not uniqueness; under concurrency two callers would both
 * read zero and both insert. The lock is what makes the count trustworthy, exactly as the
 * first-human ceremony established: take it BEFORE the count, inside the transaction, or the answer
 * is already stale by the time it is believed.
 *
 * `share row exclusive` self-conflicts, so two ceremonies serialize against each other while
 * ordinary readers are unaffected.
 */
const AGENT_IDENTITY_LOCK_MODE = "share row exclusive";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Durable agent identity is server-only.");
  }
}

function resolveDbOrNull(deps: AgentIdentityDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * ESTABLISH this tenant's first durable agent identity, owned by the human in the resolved context.
 *
 * The tenant and the human owner both come from an already-resolved server-side context. There is
 * no parameter for a tenant id and no parameter for an owner id — a caller cannot name another
 * organization or another person's agent, because no field exists through which to name one.
 */
export async function createDurableAgentIdentity(
  tenant: TenantContext | null,
  input: { readonly name: unknown },
  deps: AgentIdentityDeps = {},
): Promise<CreateDurableAgentIdentityResult> {
  assertServerOnly();

  /* 1 · A REAL, SERVER-RESOLVED TENANT AND HUMAN. Fail closed before anything is read or written. */
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "no-authorized-tenant-context" };
  }

  /* 2 · THE NAME IS ACCEPTED AS GIVEN OR REFUSED. Never repaired. */
  if (!isWellFormedAgentName(input.name)) {
    return { status: "refused", reason: "malformed-agent-name" };
  }
  const name = input.name;

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "authority-unavailable" };

  return db.transaction(async (tx) => {
    /*
     * 3 · SERIALIZE, THEN COUNT. The order is the guarantee. See AGENT_IDENTITY_LOCK_MODE.
     */
    await tx.execute(sql.raw(`lock table agents in ${AGENT_IDENTITY_LOCK_MODE} mode`));

    /*
     * 4 · THE OWNER MUST BE A LIVE HUMAN. The `agents` ownership columns carry no foreign key by
     * design — the pair is polymorphic and a users-FK could not express an agent manager. That
     * design decision moves the burden here: without this read, `human_owner_id` would be a uuid
     * this authority merely hopes points at somebody.
     */
    const owner = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, tenant.userId), isNull(users.deletedAt)))
      .limit(1);
    if (owner.length === 0) {
      return { status: "refused" as const, reason: "human-owner-unresolved" as const };
    }

    /*
     * 5 · ONE-SHOT, TENANT-SCOPED. This authority owns the transition OUT OF nonexistence, so the
     * predicate is existence itself, not name collision. A name-uniqueness rule would need a unique
     * index this schema does not have, and an unbacked pre-check would be a claim the database
     * never made.
     *
     * Soft-deleted rows still count. A tenant that once had a durable agent identity is not a
     * tenant that never had one, and this ceremony must not be re-openable by a delete.
     */
    const [existing] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(agents)
      .where(eq(agents.tenantId, tenant.tenantId));
    if ((existing?.total ?? 0) > 0) {
      return { status: "refused" as const, reason: "agent-identity-already-exists" as const };
    }

    /*
     * 6 · WRITE THE IDENTITY. Six columns carry a value. Every other column on this table is left
     * to its schema default or to NULL, and that is the point of the phase: a missing fact stays
     * missing rather than being invented. No department, no role, no manager, no authority ceiling,
     * no lifecycle enum, no health, no risk, no posture, and none of the fifteen cognitive/runtime
     * profiles — because this agent has no manager, no cognition and no runtime, and writing a
     * plausible value would be the first lie in the record.
     *
     * `created_by_type` is 'human' and `created_by` is that same human. Unlike the first human, who
     * genuinely had no creator, this agent DID have one, and the record says who.
     */
    const [row] = await tx
      .insert(agents)
      .values({
        tenantId: tenant.tenantId,
        name,
        humanOwnerType: "human",
        humanOwnerId: tenant.userId,
        createdBy: tenant.userId,
        createdByType: "human",
      })
      .returning({ id: agents.id });

    return {
      status: "established" as const,
      identity: {
        agentId: row!.id,
        tenantId: tenant.tenantId,
        name,
        humanOwnerType: "human" as const,
        humanOwnerId: tenant.userId,
      },
    };
  });
}
