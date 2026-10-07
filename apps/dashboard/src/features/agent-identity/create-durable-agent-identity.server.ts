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
 * no permit, no execution attempt, no provider binding. Since AP-1 the existence itself is recorded
 * as a Governance decision (`agent-registration`) ABOUT the agent — a decision grants the agent
 * nothing; it records that the organization chose to register it. The seven
 * human-only CHECK constraints that guard every approve/authorize surface are untouched by this
 * file, and an agent that cannot authenticate cannot exercise any of them.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import { users } from "@/db/schema/user";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import {
  AGENT_REGISTRATION_DECISION_TYPE,
  AGENT_REGISTRATION_SUBJECT_TYPE,
  isWellFormedAgentName,
  type AgentIdentityRefusal,
  type CreateDurableAgentIdentityResult,
} from "./contracts";

export interface AgentIdentityDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/*
 * AP-1 — NO TABLE LOCK. The one-per-tenant count it serialized is gone; name uniqueness is
 * `agents_tenant_name_in_service_uq`, and two simultaneous creations of one canonical name commit
 * one row and raise one `unique_violation`, which this writer reports as `agent-name-in-use`.
 */
const AGENT_NAME_IN_SERVICE_INDEX = "agents_tenant_name_in_service_uq";

class RegistrationAbort extends Error {
  constructor(readonly refusal: AgentIdentityRefusal) {
    super(refusal);
    this.name = "RegistrationAbort";
  }
}

/** The driver error, through drizzle's `cause` wrapper inside a transaction. */
function isNameInUse(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 4; depth += 1) {
    if (typeof current !== "object") return false;
    const { code, constraint } = current as { code?: unknown; constraint?: unknown };
    if (code === "23505" && constraint === AGENT_NAME_IN_SERVICE_INDEX) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

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
   * REGISTER one durable agent identity for this tenant, owned by the human in the resolved context,
   * on a Governance decision in the `agent-registration` domain (AP-1).
   *
   * The tenant and the human owner both come from an already-resolved server-side context. There is
   * no parameter for a tenant id and no parameter for an owner id — a caller cannot name another
   * organization or another person's agent, because no field exists through which to name one.
   */
  export async function createDurableAgentIdentity(
    tenant: TenantContext | null,
    input: { readonly name: unknown; readonly justification?: unknown },
    deps: AgentIdentityDeps & { readonly now?: () => Date } = {},
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

    /* 3 · EVERY GOVERNANCE DECISION NEEDS A REASON (AP-1). */
    const justification = validateJustification(
      typeof input.justification === "string" ? input.justification : "",
    );
    if (!justification) return { status: "refused", reason: "justification-required" };

    const db = resolveDbOrNull(deps);
    if (!db) return { status: "refused", reason: "authority-unavailable" };
    const now = (deps.now ?? (() => new Date()))();

    try {
    return await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

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
       * 4b · THE ORGANIZATION'S GOVERNANCE AUTHORITY (APF-1).
       *
       * The ONE released resolver: the bootstrap human, or a human holding an unrevoked delegation. A
       * tenant member without it is refused exactly like a stranger — no role band, permission row or
       * membership scope is consulted, the same rule the mandate writer applies. An unresolvable
       * authority refuses: `resolveGovernanceAuthority` reports an outage as NO authority.
       *
       * AFTER the released checks, so every refusal they gave keeps its reason; this is an ADDITIONAL
       * gate. Read on the authority's own connection, not this transaction's.
       *
       * Before APF-1 any authenticated member could create the tenant's one durable agent — and, since
       * the genesis count includes retired rows, a member could spend the organization's only identity
       * forever.
       */
      const authority = await resolveGovernanceAuthority(tenant, { getDb: deps.getDb });
      if (!authority.bootstrapDecisionId) {
        return { status: "refused" as const, reason: "no-governance-authority" as const };
      }
      if (!authority.authorized) {
        return { status: "refused" as const, reason: "not-the-governance-authority" as const };
      }

      /*
       * 5 · THE DECISION, BOUND TO THE IDENTITY IT BRINGS INTO EXISTENCE.
       *
       * The id is minted first so the decision can name a row that is written in this same
       * transaction or not at all (the I1 pattern AMA-1 reuses). A name collision raised by the
       * insert below rolls the decision back with it: no decision ever names an agent that does not
       * exist.
       */
      const agentId = randomUUID();
      const decision = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: AGENT_REGISTRATION_DECISION_TYPE,
          subjectType: AGENT_REGISTRATION_SUBJECT_TYPE,
          subjectId: agentId,
          justification,
          evidence: { agentId, name },
        },
        now,
      );

      /*
       * 6 · WRITE THE IDENTITY. Six columns carry a value. Every other column on this table is left
       * to its schema default or to NULL, and that is the point of the phase: a missing fact stays
       * missing rather than being invented. No department, no role, no manager, no authority ceiling,
       * no lifecycle enum, no health, no risk, no posture, and none of the fifteen cognitive/runtime
       * profiles — because this agent has no manager, no cognition and no runtime, and writing a
       * plausible value would be the first lie in the record.
       *
       * `created_by_type` is 'human' and `created_by` is that same human. Unlike the first human, who
       * genuinely had no creator, this agent DID have one, and the record says who. The id is the one
       * the decision already names; the row carries no pointer back, the decision's subject is it.
       */
      let row: { readonly id: string } | undefined;
      try {
        [row] = await tx
          .insert(agents)
          .values({
            id: agentId,
            tenantId: tenant.tenantId,
            name,
            humanOwnerType: "human",
            humanOwnerId: tenant.userId,
            createdBy: tenant.userId,
            createdByType: "human",
          })
          .returning({ id: agents.id });
      } catch (error) {
        if (isNameInUse(error)) throw new RegistrationAbort("agent-name-in-use");
        throw error;
      }

      /* 7 · The Governance event: a decision was made, and what it registered. */
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: AGENT_REGISTRATION_DECISION_TYPE,
            subjectType: AGENT_REGISTRATION_SUBJECT_TYPE,
            subjectId: agentId,
            bootstrap: false,
          },
        },
        now,
      );

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
  } catch (error) {
    /* A lost name race or a named refusal raised inside the transaction: everything rolled back. */
    if (error instanceof RegistrationAbort) return { status: "refused", reason: error.refusal };
    if (isNameInUse(error)) return { status: "refused", reason: "agent-name-in-use" };
    throw error;
  }
}
