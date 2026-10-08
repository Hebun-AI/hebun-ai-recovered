/*
 * AGENT-ID-0.1 — THE AUTHORITATIVE DURABLE AGENT RETIREMENT WRITER.
 *
 * This module owns exactly one consequential transition:
 *
 *     IN-SERVICE DURABLE AGENT IDENTITY  ->  RETIRED DURABLE AGENT IDENTITY
 *
 * It is the second — and last — transition this feature owns. It is still not CRUD: there is no
 * update, no rename, no reinstate, no suspend, no delete, no successor. Those verbs are absent
 * rather than guarded, which is the stronger claim.
 *
 * ── L-1b: A RETIREMENT IS A GOVERNANCE DECISION ──────────────────────────────
 *
 * Since L-1b the transition, one `agent-lifecycle` Governance decision (`revoke` → `agent-retired`,
 * subject = the agent) and one `governance.decision.recorded` audit event are written in ONE
 * transaction, exactly as registration writes its decision, row and event together. "Retired but
 * undecided", "decided but still serving" and "retired but unaudited" are unrepresentable: any
 * failure after the UPDATE aborts the transaction and the row is left in service. A justification is
 * required, because every Governance decision needs a reason a human can review.
 *
 * ── WHAT RETIREMENT MEANS HERE, EXACTLY ──────────────────────────────────────
 *
 * Four columns move, and only four:
 *
 *     agent_lifecycle_status  NULL   ->  'retired'
 *     retired_at              NULL   ->  the transaction's clock
 *     updated_by / _by_type   NULL   ->  the acting human, as a both-or-neither actor pair
 *     updated_at / version           ->  advanced, as every governed write advances them
 *
 * Everything else is left exactly as AGENT-ID-0 wrote it. In particular:
 *
 *   · `deleted_at` / `deleted_by` STAY NULL. Retirement is not a soft delete. A soft delete says the
 *     record should be treated as gone; retirement says the identity existed, served, and stopped.
 *   · `lifecycle_status` (the base record lifecycle) STAYS `active`. The RECORD is not archived —
 *     only the agent is out of service. Moving it would make a truthful history look discarded.
 *   · `replaced_by_agent_id` STAYS NULL. Succession is a separate authorization that has not been
 *     granted, and writing a successor pointer with no successor would be the first lie in the record.
 *   · `name`, `human_owner_*`, `created_by*` STAY. Retirement withdraws an identity from service; it
 *     does not un-name it, disown it, or erase who created it.
 *
 * ── RETIREMENT FREES THE NAME, NOT THE IDENTITY (AP-1) ───────────────────────
 *
 * This module writes no DELETE and leaves the row in place. Since AP-1 registration is a Governance
 * decision per identity, and name uniqueness covers IN-SERVICE identities only, so a retired name
 * may later be registered again — as a NEW identity with a new agentId and its own decision. The
 * retired row is never reused, reinstated or relinked; history is always told apart by agentId.
 *
 * ── WHO MAY RETIRE ───────────────────────────────────────────────────────────
 *
 * The identity's own human owner, and nobody else. Ownership is the fact AGENT-ID-0 actually wrote
 * (`human_owner_type` = 'human', `human_owner_id` = a live user), so ownership is the authority this
 * module reads. It does not consult a role, a band, a permission or a governance decision, because
 * inventing an authority source for a lifecycle act would be a wider claim than the repository can
 * support — and a narrower, truthful gate is the one this phase was asked for.
 *
 * An AGENT cannot reach this at all, and not because a check rejects it: the only parameter carrying
 * identity is a `TenantContext`, which is minted solely by the human session runtime. There is no
 * agent authentication in this repository, so there is no representation in which an agent arrives.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agents } from "@/db/schema/agent";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { AGENT_LIFECYCLE_SUBJECT_TYPE, AGENT_RETIREMENT_DECISION_TYPE } from "./contracts";
import {
  isDurableAgentIdentityId,
  RETIRED_AGENT_LIFECYCLE_STATUS,
  type RetireDurableAgentIdentityResult,
} from "./retirement-contracts";

export interface AgentRetirementDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /** Injected clock, so `retired_at` is deterministic in tests. Production never supplies it. */
  readonly now?: () => Date;
  /**
   * Test-only seam: runs INSIDE the transaction, after the row has been read and before it is
   * judged. It exists so the concurrency guarantee can be PROVEN rather than assumed.
   *
   * WHY IT HAD TO EXIST. Six `retireDurableAgentIdentity` calls fired through `Promise.all` do not
   * actually overlap: each transaction finishes before the next one reads, so the second caller sees
   * a committed retirement and is refused by the ordinary terminal-state guard. That produces a
   * green "exactly one winner" assertion which is true for the WRONG REASON — it never exercised a
   * race at all, and it was measured passing with both the row lock and the update predicate
   * removed. A barrier here holds several transactions at the moment after the read, which is the
   * only moment at which the interleaving this transition can suffer is possible.
   *
   * Production never supplies it, and no server action can: it is not a field on any action input.
   */
  readonly afterRead?: () => Promise<void>;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Durable agent retirement is server-only.");
  }
}

function resolveDbOrNull(deps: AgentRetirementDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * RETIRE this tenant's durable agent identity, on the authority of the human who owns it.
 *
 * The tenant and the acting human both come from an already-resolved server-side context. There is
 * no parameter for a tenant id, no parameter for an actor id, and no parameter for a retirement
 * timestamp — a caller cannot retire another organization's agent, cannot claim to be somebody else,
 * and cannot backdate the record, because no field exists through which to do any of it.
 */
export async function retireDurableAgentIdentity(
  tenant: TenantContext | null,
  input: { readonly agentId: unknown; readonly justification?: unknown },
  deps: AgentRetirementDeps = {},
): Promise<RetireDurableAgentIdentityResult> {
  assertServerOnly();

  /* 1 · A REAL, SERVER-RESOLVED TENANT AND HUMAN. Fail closed before anything is read or written. */
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "refused", reason: "no-authorized-tenant-context" };
  }

  /* 2 · THE IDENTIFIER IS ACCEPTED AS GIVEN OR REFUSED. Never coerced into a uuid comparison. */
  if (!isDurableAgentIdentityId(input.agentId)) {
    return { status: "refused", reason: "malformed-agent-id" };
  }
  const agentId = input.agentId;

  /* 2b · L-1b — A GOVERNANCE DECISION NEEDS A REASON. Checked before anything is read or locked. */
  const justification = validateJustification(
    typeof input.justification === "string" ? input.justification : "",
  );
  if (!justification) return { status: "refused", reason: "justification-required" };

  const db = resolveDbOrNull(deps);
  if (!db) return { status: "refused", reason: "authority-unavailable" };

  const now = deps.now?.() ?? new Date();

  return db.transaction(async (tx) => {
    /*
     * 3 · LOCK THE ROW, THEN JUDGE IT.
     *
     * A table lock would be wrong here: retirement has no cross-row invariant to protect, unlike the
     * genesis ceremony whose predicate is a count over the whole tenant. The race this transition
     * has is two concurrent retirements of the SAME identity, and a row lock is its exact shape.
     *
     * WHAT THIS LOCK ACTUALLY BUYS, MEASURED RATHER THAN ASSUMED. It is NOT the serializer. Removing
     * it alone leaves the concurrency proof green, because Postgres takes its own row lock at UPDATE
     * time and re-evaluates the `retired_at is null` predicate in step 6 after waiting — so a second
     * writer matches zero rows and is refused either way. What `for update` buys is an EARLY, CLEAN
     * refusal: the loser is turned away here, on a judged row, instead of discovering at write time
     * that it lost. The two together are defence in depth, and the bite proofs remove BOTH to make
     * the concurrency guarantee actually fail.
     *
     * The tenant predicate is part of the LOOKUP, not a check after it. A row belonging to another
     * organization is never selected, so it can never be judged, reported on, or distinguished from
     * a uuid that does not exist.
     */
    const [row] = await tx
      .select({
        id: agents.id,
        name: agents.name,
        humanOwnerType: agents.humanOwnerType,
        humanOwnerId: agents.humanOwnerId,
        retiredAt: agents.retiredAt,
        lifecycle: agents.agentLifecycleStatus,
      })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenant.tenantId)))
      .for("update")
      .limit(1);

    if (!row) {
      return { status: "refused" as const, reason: "agent-identity-not-found" as const };
    }

    /* The proof seam. Absent in production; see `AgentRetirementDeps.afterRead`. */
    if (deps.afterRead) await deps.afterRead();

    /*
     * 4 · THE ACTING HUMAN MUST BE THE OWNER. Both halves of the polymorphic pair are checked: an
     * owner recorded as anything but a human is not an owner this authority recognises, and matching
     * the id alone would let a non-human owner pair be satisfied by a coincident uuid.
     */
    if (row.humanOwnerType !== "human" || row.humanOwnerId !== tenant.userId) {
      return { status: "refused" as const, reason: "not-the-human-owner" as const };
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
     * Before APF-1 the owner alone could retire — and the owner could be any member who created it, so
     * a member could create and then retire the organization's only identity forever (the pre-AP-1
     * genesis count included retired rows). Ownership is NOT replaced: step 4 still applies, so retirement now
     * needs BOTH the human who owns the agent AND the organization's Governance authority. Nothing new
     * is granted to anybody.
     */
    const authority = await resolveGovernanceAuthority(tenant, { getDb: deps.getDb });
    if (!authority.bootstrapDecisionId) {
      return { status: "refused" as const, reason: "no-governance-authority" as const };
    }
    if (!authority.authorized) {
      return { status: "refused" as const, reason: "not-the-governance-authority" as const };
    }

    /* 5 · TERMINAL STATES ARE NOT RE-ENTERABLE. Either witness of retirement is sufficient. */
    if (row.retiredAt !== null || row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS) {
      return { status: "refused" as const, reason: "agent-identity-already-retired" as const };
    }

    /*
     * 6 · WITHDRAW FROM SERVICE. Four columns move.
     *
     * The `retired_at is null` predicate is NOT decoration over step 3's lock — it is the load-
     * bearing half. Postgres re-evaluates it after the row lock it takes for the UPDATE itself, so a
     * concurrent second retirement matches zero rows and is refused rather than silently stamping a
     * second retirement over the first. Step 3 makes that refusal early; this makes it correct.
     *
     * `updated_by` and `updated_by_type` are written TOGETHER. The repository's actor doctrine is
     * both-or-neither, and a `updated_by_type` with no id (or an id with no type) is false
     * provenance rather than partial attribution.
     */
    const updated = await tx
      .update(agents)
      .set({
        agentLifecycleStatus: RETIRED_AGENT_LIFECYCLE_STATUS,
        retiredAt: now,
        updatedAt: now,
        updatedBy: tenant.userId,
        updatedByType: "human",
        version: sql`${agents.version} + 1`,
      })
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.tenantId, tenant.tenantId),
          isNull(agents.retiredAt),
        ),
      )
      .returning({ id: agents.id });

    if (updated.length !== 1) {
      /* Unreachable while the row lock holds. Refusing beats reporting a transition that did not happen. */
      return { status: "refused" as const, reason: "agent-identity-already-retired" as const };
    }

    /*
     * 7 · L-1b — THE DECISION AND ITS AUDIT EVENT, IN THIS TRANSACTION. Written after the guarded
     * UPDATE so a refused or lost retirement records nothing; a throw from either aborts the UPDATE
     * too. The authority is the one resolved in step 4b.
     */
    const decision = await writeGovernanceDecisionWithin(
      tx as unknown as ControlPlaneDatabase,
      tenant,
      authority,
      {
        decisionType: AGENT_RETIREMENT_DECISION_TYPE,
        subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE,
        subjectId: row.id,
        justification,
        evidence: { agentId: row.id, name: row.name, retiredAt: now.toISOString() },
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
          decisionType: AGENT_RETIREMENT_DECISION_TYPE,
          subjectType: AGENT_LIFECYCLE_SUBJECT_TYPE,
          subjectId: row.id,
          bootstrap: false,
        },
      },
      now,
    );

    return {
      status: "retired" as const,
      retirement: {
        agentId: row.id,
        tenantId: tenant.tenantId,
        name: row.name,
        retiredAt: now.toISOString(),
        retiredByType: "human" as const,
        retiredById: tenant.userId,
        governanceDecisionId: decision.decisionId,
        governanceSessionId: decision.sessionId,
      },
    };
  });
}
