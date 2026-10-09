/*
 * L-2b — THE AUTHORITATIVE DURABLE AGENT SUSPENSION AND REACTIVATION WRITER.
 *
 * Two reversible transitions, and no others:
 *
 *     IN SERVICE  ->  SUSPENDED     (suspend    → `agent-lifecycle` decision `suspend`, `agent-suspended`)
 *     SUSPENDED   ->  IN SERVICE    (reactivate → `agent-lifecycle` decision `approve`, `agent-reactivated`)
 *
 * Same shape as retirement (retire-durable-agent-identity.server.ts), on purpose: the same tenant
 * context, the same owner + Governance gate, the same row lock, the same guarded UPDATE, and the
 * lifecycle change, its Governance decision and its audit event committed in ONE transaction. A
 * refusal or a throw after the UPDATE leaves the agent exactly as it was.
 *
 * ── WHAT MOVES ───────────────────────────────────────────────────────────────
 *
 *     suspend      agent_lifecycle_status  NULL|'active' -> 'suspended'   suspended_at  NULL -> now
 *     reactivate   agent_lifecycle_status  'suspended'   -> 'active'      suspended_at  set  -> NULL
 *     both         updated_by/_by_type (both-or-neither), updated_at, version + 1
 *
 * Reactivation writes 'active', not NULL: NULL means "no lifecycle was ever recorded", and after a
 * suspension one was. Both are in service under the L-1a allowlist. `retired_at`, `deleted_*`,
 * `replaced_by_agent_id`, `name` and ownership never move here.
 *
 * ── WHAT IT DOES NOT TOUCH ───────────────────────────────────────────────────
 *
 * No permit, standing envelope, mandate or placement is written. Suspension does not revoke them —
 * approval, spend and standing issuance refuse an agent that is not in service, so they are blocked
 * AT USE. Reactivation therefore must not happen while any of them is still usable, or it would
 * silently restore them: it is REFUSED while the agent holds a spendable permit or a standing
 * envelope that can still issue. A human ends those through their own authorities (permit
 * revocation, envelope withdrawal) or lets them expire, then reactivates. Nothing here revokes.
 *
 * Concurrency: every writer that mints agent-bound authority (approval, standing issuance) and the
 * spend read the agent row `FOR SHARE` in their own transaction. This writer holds it `FOR UPDATE`
 * before it counts, so each of them either committed before the count (and is counted) or waits
 * until this transaction ends (and then sees the state this transaction wrote).
 *
 * Server-only.
 */
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { countUsableAgentPermitsWithin } from "@/features/action-authorization/agent-usable-permits.server";
import { hasValidStandingEnvelopeWithin } from "@/features/standing-mutation-authority/agent-valid-envelope.server";
import {
  AGENT_LIFECYCLE_SUBJECT_TYPE,
  AGENT_REACTIVATION_DECISION_TYPE,
  AGENT_SUSPENSION_DECISION_TYPE,
} from "./contracts";
import { agentInServiceCondition, IN_SERVICE_AGENT_LIFECYCLE_STATUS } from "./in-service";
import { agentServiceStatus } from "./service-status";
import {
  isDurableAgentIdentityId,
  SUSPENDED_AGENT_LIFECYCLE_STATUS,
  type AgentServiceTransition,
  type AgentServiceTransitionRefusal,
  type AgentServiceTransitionResult,
} from "./suspension-contracts";

export interface AgentServiceTransitionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Injected clock, so `suspended_at` is deterministic in tests. Production never supplies it. */
  readonly now?: () => Date;
  /** Test-only barrier inside the transaction, after the locked read (see AgentRetirementDeps). */
  readonly afterRead?: () => Promise<void>;
}

type TransitionInput = { readonly agentId: unknown; readonly justification?: unknown };

const refused = (reason: AgentServiceTransitionRefusal) => ({ status: "refused" as const, reason });

function resolveDbOrNull(deps: AgentServiceTransitionDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** SUSPEND an in-service agent: it stops acting, keeps its identity, name and history. */
export function suspendDurableAgentIdentity(
  tenant: TenantContext | null,
  input: TransitionInput,
  deps: AgentServiceTransitionDeps = {},
): Promise<AgentServiceTransitionResult> {
  return transition("suspended", tenant, input, deps);
}

/** REACTIVATE a suspended agent. Never a retired one. Restores service, and no permission. */
export function reactivateDurableAgentIdentity(
  tenant: TenantContext | null,
  input: TransitionInput,
  deps: AgentServiceTransitionDeps = {},
): Promise<AgentServiceTransitionResult> {
  return transition("reactivated", tenant, input, deps);
}

async function transition(
  kind: AgentServiceTransition,
  tenant: TenantContext | null,
  input: TransitionInput,
  deps: AgentServiceTransitionDeps,
): Promise<AgentServiceTransitionResult> {
  if (typeof window !== "undefined") throw new Error("Durable agent suspension is server-only.");

  if (!tenant?.tenantId || !tenant.userId) return refused("no-authorized-tenant-context");
  if (!isDurableAgentIdentityId(input.agentId)) return refused("malformed-agent-id");
  const agentId = input.agentId;

  const justification = validateJustification(
    typeof input.justification === "string" ? input.justification : "",
  );
  if (!justification) return refused("justification-required");

  const db = resolveDbOrNull(deps);
  if (!db) return refused("authority-unavailable");

  const now = deps.now?.() ?? new Date();

  return db.transaction(async (tx) => {
    /*
     * LOCK THE ROW, THEN JUDGE IT. `for update` serializes concurrent transitions and conflicts with
     * the approval boundary's `for share` liveness read, so an approval and a suspension cannot
     * interleave. It does NOT serialize with permit spending, whose liveness read takes no lock
     * (WF-4's documented residual window), and it cannot recall a provider call already made after a
     * spend committed. The tenant predicate is part of the lookup: another organization's row is
     * never selected.
     */
    const [row] = await tx
      .select({
        id: agents.id,
        name: agents.name,
        humanOwnerType: agents.humanOwnerType,
        humanOwnerId: agents.humanOwnerId,
        retiredAt: agents.retiredAt,
        suspendedAt: agents.suspendedAt,
        lifecycle: agents.agentLifecycleStatus,
      })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenant.tenantId)))
      .for("update")
      .limit(1);

    if (!row) return refused("agent-identity-not-found");

    if (deps.afterRead) await deps.afterRead();

    /* The owner AND the organization's Governance authority — the same two gates retirement applies. */
    if (row.humanOwnerType !== "human" || row.humanOwnerId !== tenant.userId) {
      return refused("not-the-human-owner");
    }
    const authority = await resolveGovernanceAuthority(tenant, { getDb: deps.getDb });
    if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
    if (!authority.authorized) return refused("not-the-governance-authority");

    /* The L-2a derivation, so a transition judges exactly the status every surface shows. */
    const status = agentServiceStatus(row);
    if (status === "retired") return refused("agent-identity-retired");
    if (status === "indeterminate") return refused("agent-service-status-indeterminate");
    if (kind === "suspended" && status === "suspended") return refused("agent-already-suspended");
    if (kind === "reactivated" && status === "in-service") return refused("agent-not-suspended");

    /* Decision 1 — reactivation never silently restores execution authority granted before it. */
    if (kind === "reactivated") {
      const txDb = tx as unknown as ControlPlaneDatabase;
      if ((await countUsableAgentPermitsWithin(txDb, tenant.tenantId, row.id)) > 0) {
        return refused("agent-has-usable-permits");
      }
      if (await hasValidStandingEnvelopeWithin(txDb, tenant.tenantId, row.id)) {
        return refused("agent-has-valid-standing-envelope");
      }
    }

    /*
     * THE GUARDED UPDATE. The WHERE restates the precondition, so a concurrent transition that
     * committed while this one waited matches zero rows and is refused rather than written twice.
     */
    const updated = await tx
      .update(agents)
      .set({
        agentLifecycleStatus:
          kind === "suspended" ? SUSPENDED_AGENT_LIFECYCLE_STATUS : IN_SERVICE_AGENT_LIFECYCLE_STATUS,
        suspendedAt: kind === "suspended" ? now : null,
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${agents.version} + 1`,
      })
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.tenantId, tenant.tenantId),
          kind === "suspended"
            ? agentInServiceCondition()
            : and(
                isNull(agents.retiredAt),
                isNotNull(agents.suspendedAt),
                eq(agents.agentLifecycleStatus, SUSPENDED_AGENT_LIFECYCLE_STATUS),
              ),
        ),
      )
      .returning({ id: agents.id });

    if (updated.length !== 1) {
      /* Unreachable while the row lock holds. */
      return refused(kind === "suspended" ? "agent-already-suspended" : "agent-not-suspended");
    }

    const decisionType = kind === "suspended" ? AGENT_SUSPENSION_DECISION_TYPE : AGENT_REACTIVATION_DECISION_TYPE;
    const decision = await writeGovernanceDecisionWithin(
      tx as unknown as ControlPlaneDatabase,
      tenant,
      authority,
      {
        decisionType,
        subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE,
        subjectId: row.id,
        justification,
        evidence: { agentId: row.id, name: row.name, transition: kind, at: now.toISOString() },
      },
      now,
    );

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
          decisionType,
          subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE,
          subjectId: row.id,
          bootstrap: false,
        },
      },
      now,
    );

    return {
      status: kind,
      record: {
        agentId: row.id,
        tenantId: tenant.tenantId,
        name: row.name,
        transition: kind,
        at: now.toISOString(),
        byType: "human" as const,
        byId: tenant.userId,
        governanceDecisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
      },
    };
  });
}
