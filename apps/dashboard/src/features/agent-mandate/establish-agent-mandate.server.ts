/*
 * agent-mandate/establish-agent-mandate.server.ts — THE ONE writer of an Agent Mandate (AMA-1).
 *
 * This module owns exactly one consequential transition, and it is the same transition whether it
 * is the first mandate or the fortieth:
 *
 *     NO EFFECTIVE MANDATE / MANDATE AT REVISION N  ->  MANDATE AT REVISION N+1
 *
 * ONE TRANSACTION, OR NOTHING:
 *
 *   BEGIN
 *     1. resolve the agent, tenant-scoped, and require it to be in service
 *     2. read the current effective revision for that agent
 *     3. verify the caller was looking at THAT revision  (stale-review precondition, K4)
 *     4. write the Governance decision + its session      (subject = agent_mandate revision)
 *     5. write the mandate revision, bound to that decision
 *     6. append the Governance audit event                (a decision happened)
 *     7. append the Agent Mandate audit event             (an agent's bound changed)
 *   COMMIT
 *
 * "Bounded but no decision", "decision but no bound", and "bounded but unaudited" are excluded by
 * the transaction, not by hoping. Every table involved lives in the same control-plane database.
 *
 * ── WHAT THIS WRITER MAY NOT DO, AND WHY NONE OF IT IS AVAILABLE HERE ────────
 *
 * It cannot authorize itself: `resolveGovernanceAuthority` is the ONE released resolver and it
 * reads `decision_records.bootstrap`, never a role, a permission row, a membership scope, or
 * anything the caller supplied. It cannot mutate the agent: it imports the agent identity READ seam
 * and no agent writer, so `agents` is unreachable for update from this module — `authority_ceiling`
 * in particular is never named here, and never will be, because writing a mandate into a column
 * `canonical-read/actor-resolution.ts` already summarizes would publish a CONSTRAINT as an
 * AUTHORITY. It mints no permit, reaches no provider, reads no credential, grants no permission,
 * and starts no execution — none of those modules is imported, and a firewall test walks the real
 * value-import closure rather than trusting this sentence.
 *
 * ── AND IT ENFORCES NOTHING ──────────────────────────────────────────────────
 *
 * This is the property AMA-1 must not blur. Writing a mandate changes what the ORGANIZATION HAS
 * RECORDED and changes nothing about what an agent may actually propose: no proposal path reads
 * `agent_mandates` at this phase, `AGENT_ORIGINABLE_ACTION_KINDS` is untouched, and every audit row
 * this transaction writes carries `enforced: false`.
 *
 *   MANDATE RECORDED != PROPOSAL-ENFORCED
 *   MANDATE RECORDED != HEBY-GROUNDED
 *   MANDATE RECORDED != PRODUCTION-ACCEPTED
 *
 * ── AN AGENT CANNOT REACH THIS AT ALL ────────────────────────────────────────
 *
 * Two independent reasons, and neither is a code convention. There is no agent authentication in
 * Hebun, so an agent has no session from which a `TenantContext` could be resolved; and
 * `agent_mandates.established_by_actor_type` carries a CHECK constraint admitting only `human`, so
 * a row naming an agent as its own establisher is rejected by PostgreSQL independently of every
 * line below.
 *
 * ── NO TABLE LOCK, AND THAT IS A DELIBERATE DIFFERENCE ───────────────────────
 *
 * The agent identity ceremony takes `lock table agents in share row exclusive mode` because, as its
 * own comment records, *"`agents` carries NO unique index … an application-level pre-check is
 * therefore not uniqueness."* Here `(tenant_id, agent_id, mandate_revision)` IS unique, so two
 * simultaneous establishments both computing N+1 produce one commit and one `unique_violation`,
 * which is reported as a refusal rather than an error. The index is the guarantee; a lock would add
 * contention and prove nothing extra.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agentMandates } from "@/db/schema/agent-mandate";
import { agents } from "@/db/schema/agent";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordAgentMandateEventWithin } from "@/features/governance-audit/agent-mandate-audit.server";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import {
  resolveGovernanceAuthority,
  type GovernanceAuthorityResolution,
} from "@/features/governance-decision/authority-read.server";
import { validateJustification } from "@/features/governance-decision/persistence.server";
import { RETIRED_AGENT_LIFECYCLE_STATUS } from "@/features/agent-identity/retirement-contracts";
import {
  AGENT_MANDATE_AUDIT_ESTABLISHED,
  AGENT_MANDATE_AUDIT_REVISED,
  AGENT_MANDATE_DECISION_TYPE,
  AGENT_MANDATE_SUBJECT_TYPE,
  FIRST_MANDATE_REVISION,
  MAX_MANDATE_PURPOSE_CHARACTERS,
  MIN_MANDATE_PURPOSE_CHARACTERS,
  canonicaliseMandateScope,
  type AgentMandateRefusal,
  type EstablishAgentMandateResult,
  type MandateScopeKind,
} from "./contracts";

export interface EstablishAgentMandateDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

/** Aborts the transaction when a governed rule refuses mid-flight. */
class MandateAbort extends Error {
  constructor(readonly refusal: AgentMandateRefusal) {
    super(refusal);
    this.name = "MandateAbort";
  }
}

function refused(reason: AgentMandateRefusal): EstablishAgentMandateResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: EstablishAgentMandateDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}

function boundedPurpose(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed.length < MIN_MANDATE_PURPOSE_CHARACTERS ||
    trimmed.length > MAX_MANDATE_PURPOSE_CHARACTERS
  ) {
    return null;
  }
  return trimmed;
}

/**
 * The agent this mandate would bound, resolved INSIDE the transaction and tenant-scoped.
 *
 * The composite foreign key on `agent_mandates` repeats this structurally — a mandate naming
 * another tenant's agent is a database error. This read exists so the caller gets an honest typed
 * refusal instead of a constraint violation, and so a retired agent is refused for a reason a
 * human can read.
 *
 * `deleted_at is null` is included because a soft-deleted agent row is not an agent in service,
 * and the identity read seam applies the same predicate.
 */
async function resolveInServiceAgent(
  tx: ControlPlaneDatabase,
  tenantId: string,
  agentId: string,
): Promise<void> {
  const rows = await tx
    .select({
      id: agents.id,
      lifecycle: agents.agentLifecycleStatus,
      retiredAt: agents.retiredAt,
    })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId), isNull(agents.deletedAt)))
    .limit(1);

  const row = rows[0];
  /* A wrong tenant, a wrong id, and a row that never existed all land here, indistinguishably. */
  if (!row) throw new MandateAbort("agent-unresolvable");
  if (row.retiredAt !== null || row.lifecycle === RETIRED_AGENT_LIFECYCLE_STATUS) {
    throw new MandateAbort("agent-retired");
  }
}

interface EffectiveRevision {
  readonly mandateId: string;
  readonly mandateRevision: number;
}

/**
 * The agent's current effective mandate, or `null` when it has never had one.
 *
 * EFFECTIVE IS `max(mandate_revision)`, and this is the only place that definition is applied on
 * the write path. Nothing is locked and nothing is updated: the unique index on
 * `(tenant_id, agent_id, mandate_revision)` is what makes the next ordinal safe to compute, and a
 * loser of that race is refused rather than silently retried at a higher ordinal — retrying would
 * write a revision on top of somebody else's without the human ever seeing it.
 */
async function readEffectiveRevisionWithin(
  tx: ControlPlaneDatabase,
  tenantId: string,
  agentId: string,
): Promise<EffectiveRevision | null> {
  const rows = await tx
    .select({ id: agentMandates.id, revision: agentMandates.mandateRevision })
    .from(agentMandates)
    .where(and(eq(agentMandates.tenantId, tenantId), eq(agentMandates.agentId, agentId)))
    .orderBy(desc(agentMandates.mandateRevision))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return { mandateId: row.id, mandateRevision: row.revision };
}

/**
 * Establish or revise the bounded purpose of ONE durable agent, under the tenant's Governance
 * authority.
 *
 * The caller names the agent, writes the purpose, chooses a scope from the released vocabulary, and
 * states which revision it was shown. It CANNOT supply the tenant, the acting human, the decision,
 * the session, the revision ordinal, the effective instant, or the predecessor — every one of those
 * is server-derived, and the type gives them no parameter to arrive in.
 *
 * `observedMandateRevision` is `null` when the caller believes no mandate exists yet. It is a
 * precondition and can only ever cause a refusal.
 */
export async function establishAgentMandate(
  tenant: TenantContext | null,
  input: {
    readonly agentId: string;
    readonly purpose: string;
    readonly proposalScope: readonly string[];
    readonly justification: string;
    /** The revision the human was shown, or `null` for "I believe there is no mandate yet". */
    readonly observedMandateRevision: number | null;
  },
  deps: EstablishAgentMandateDeps = {},
): Promise<EstablishAgentMandateResult> {
  if (typeof window !== "undefined") {
    throw new Error("Agent mandates are server-only.");
  }

  /* 1 · A REAL, SERVER-RESOLVED TENANT AND HUMAN. Fail closed before anything is read. */
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  const authenticated = tenant;

  /* 2 · EVERY GOVERNANCE DECISION NEEDS A REASON, AND THIS IS ONE. */
  const justification = validateJustification(input?.justification ?? "");
  if (!justification) return refused("justification-required");

  /* 3 · THE PURPOSE IS ACCEPTED AS GIVEN OR REFUSED. Trimmed of surrounding space, never repaired. */
  const purpose = boundedPurpose(input?.purpose);
  if (!purpose) return refused("mandate-purpose-required");

  /*
   * 4 · THE CEILING. Refused WHOLE if it names anything outside the released vocabulary — never
   * narrowed to the admissible members, which would record a mandate nobody authorized. An EMPTY
   * scope is admissible and means withdrawal: this agent may propose nothing.
   */
  const proposalScope = canonicaliseMandateScope(input?.proposalScope);
  if (!proposalScope) return refused("mandate-scope-invalid");

  const agentId = typeof input?.agentId === "string" ? input.agentId.trim() : "";
  if (!agentId) return refused("agent-unresolvable");

  const observedRevision =
    input?.observedMandateRevision === null || input?.observedMandateRevision === undefined
      ? null
      : input.observedMandateRevision;
  if (observedRevision !== null && !Number.isInteger(observedRevision)) {
    return refused("stale-mandate-revision");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /*
   * 5 · THE AUTHORITY, RESOLVED BEFORE THE TRANSACTION.
   *
   * The ONE released resolver. Only the human the bootstrap decision established — or a human
   * holding an unrevoked delegation — passes. A tenant owner without Governance authority is
   * refused exactly like a stranger, and no role band, permission row or membership scope is
   * consulted anywhere in this module.
   */
  let authority: GovernanceAuthorityResolution;
  try {
    authority = await resolveGovernanceAuthority(authenticated, deps);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  try {
    let outcome: EstablishAgentMandateResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /* 6 · THE SUBJECT AGENT — this tenant's, and in service. */
      await resolveInServiceAgent(tx, authenticated.tenantId, agentId);

      /* 7 · WHERE THE CHAIN CURRENTLY STANDS. */
      const effective = await readEffectiveRevisionWithin(tx, authenticated.tenantId, agentId);

      /*
       * 8 · THE HUMAN'S PRECONDITION (K4's lesson).
       *
       * The unique index stops two SIMULTANEOUS transactions; it cannot see the slower human case —
       * a mandate reviewed at revision 2 and submitted after somebody committed revision 3.
       * Comparing what the human was actually shown catches exactly that, in both directions:
       * believing there is no mandate when there is, and believing there is one when there is not.
       */
      const currentRevision = effective?.mandateRevision ?? null;
      if (observedRevision !== currentRevision) {
        throw new MandateAbort("stale-mandate-revision");
      }

      const mandateRevision = (currentRevision ?? 0) + FIRST_MANDATE_REVISION;
      const supersedesMandateId = effective?.mandateId ?? null;

      /*
       * 9 · THE CIRCULAR REFERENCE, AND THE AUTHORIZED SOLUTION.
       *
       * The decision must name the mandate revision as its subject and the revision must name the
       * decision as its provenance; both columns are NOT NULL. I1 hit this exact shape and the
       * Director authorized generating the artifact's UUID in the application so the decision can
       * bind to it before the row exists. R3A reused it; so does this. The row this id names is
       * written in the same transaction or not at all.
       */
      const mandateId = randomUUID();

      /*
       * 10 · THE GOVERNANCE DECISION, BOUND TO THE REVISION — never to the agent.
       *
       * A decision bound to the agent would silently mean "whatever mandate is current when someone
       * reads this", which is the defect K4 found when G2's subject was a Knowledge fact rather
       * than a version. Governance records the decision and owns nothing about the mandate itself.
       */
      const decision = await writeGovernanceDecisionWithin(
        tx,
        authenticated,
        authority,
        {
          decisionType: AGENT_MANDATE_DECISION_TYPE,
          subjectType: AGENT_MANDATE_SUBJECT_TYPE,
          subjectId: mandateId,
          justification,
          evidence: {
            agentId,
            mandateRevision,
            proposalScope: [...proposalScope],
            supersedesMandateId,
          },
        },
        now,
      );

      /*
       * 11 · THE MANDATE REVISION.
       *
       * Nothing that already exists is edited. The predecessor row is not touched, not stamped and
       * not superseded in place: a historical record a superseding write can edit was never a
       * record. Its supersession is expressed by this row naming it, and by this row holding the
       * higher ordinal.
       */
      let inserted: { readonly id: string }[];
      try {
        inserted = await tx
          .insert(agentMandates)
          .values({
            id: mandateId,
            tenantId: authenticated.tenantId,
            agentId,
            mandateRevision,
            purpose,
            /* Canonical form: de-duplicated, in the released vocabulary's own order. */
            proposalScope: [...proposalScope],
            effectiveFrom: now,
            governanceDecisionId: decision.decisionId,
            governanceSessionId: decision.sessionId,
            /*
             * THE ACCOUNTABLE HUMAN. The database CHECK refuses anything but `human` independently
             * of this line, which is what makes "an agent cannot establish or widen its own
             * mandate" a fact about PostgreSQL rather than about this file.
             */
            establishedByActorType: "human",
            establishedByActorId: authenticated.userId,
            supersedesMandateId,
            createdAt: now,
            createdBy: authenticated.userId,
            createdByType: "human",
            updatedAt: now,
            updatedBy: authenticated.userId,
            updatedByType: "human",
          })
          .returning({ id: agentMandates.id });
      } catch (error) {
        /*
         * A LOST RACE, REPORTED AS ONE. Another establishment committed this ordinal between the
         * read above and this insert. Nothing here retries at a higher ordinal: that would write a
         * revision on top of a mandate the human never saw.
         */
        if (isUniqueViolation(error)) throw new MandateAbort("concurrent-mandate-change");
        throw error;
      }

      const writtenId = inserted[0]?.id;
      if (!writtenId) throw new MandateAbort("persistence-unavailable");

      /* 12 · The Governance event: a decision was made. */
      await recordGovernanceEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action: "governance.decision.recorded",
          outcome: "committed",
          entityId: decision.decisionId,
          metadata: {
            governanceSessionId: decision.sessionId,
            decisionType: AGENT_MANDATE_DECISION_TYPE,
            subjectType: AGENT_MANDATE_SUBJECT_TYPE,
            subjectId: mandateId,
            bootstrap: false,
          },
        },
        now,
      );

      /*
       * 13 · The Agent Mandate event: an agent's bound changed. Different authority, different
       * entity type — two truthful events about two different owners, in one transaction, not one
       * event duplicated.
       */
      await recordAgentMandateEventWithin(
        tx,
        {
          tenantId: authenticated.tenantId,
          userId: authenticated.userId,
          requestId: authenticated.requestId,
          sessionContextId: authenticated.sessionContextId,
        },
        {
          action:
            mandateRevision === FIRST_MANDATE_REVISION
              ? AGENT_MANDATE_AUDIT_ESTABLISHED
              : AGENT_MANDATE_AUDIT_REVISED,
          outcome: "committed",
          entityId: mandateId,
          metadata: {
            agentId,
            mandateRevision,
            proposalScope: [...proposalScope] as readonly MandateScopeKind[],
            governanceDecisionId: decision.decisionId,
            governanceSessionId: decision.sessionId,
            supersedesMandateId,
            /* AMA-1 records; it does not enforce. Stated on every row. */
            enforced: false,
          },
        },
        now,
      );

      outcome = {
        status: "established",
        mandate: {
          mandateId,
          agentId,
          mandateRevision,
          purpose,
          proposalScope,
          governanceDecisionId: decision.decisionId,
          governanceSessionId: decision.sessionId,
          effectiveFrom: now.toISOString(),
          supersedesMandateId,
        },
      };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof MandateAbort) return refused(error.refusal);
    /*
     * A unique violation can also surface here when the driver surfaces it at COMMIT rather than at
     * the statement. Same fact, same refusal.
     */
    if (isUniqueViolation(error)) return refused("concurrent-mandate-change");
    return refused("persistence-unavailable");
  }
}
