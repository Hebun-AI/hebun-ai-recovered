/*
 * agent-improvement-hypothesis/decide-improvement-hypothesis.server.ts — submitting a hypothesis to
 * Governance, and nothing more (SIA-3).
 *
 * ── THIS IS NOT A SECOND GOVERNANCE MACHINE ──────────────────────────────────
 *
 * It resolves authority through `resolveGovernanceAuthority` — the ONE released resolver — and
 * writes the decision through `writeGovernanceDecisionWithin` — the ONE released writer. It defines
 * no authority of its own, consults no role, no permission and no membership scope, and cannot
 * decide anything: only the human the bootstrap decision established (or a human holding an
 * unrevoked delegation) passes the check below.
 *
 * This is the shape every other subsystem already uses to submit its own subject —
 * `decide-action-request`, `decide-enrollment`, `authorize-membership`, `ratify-version`,
 * `provision-member-role`. SIA-3 joins that seam rather than inventing a parallel one.
 *
 *   SIA-3 OWNS   the hypothesis, before and after a decision
 *   GOVERNANCE OWNS   the decision itself
 *
 * ── AND IT WRITES NOTHING TO THE HYPOTHESIS ──────────────────────────────────
 *
 * No status is stamped back, no `decided_at`, no `approved_at`. The hypothesis row is untouched by
 * a decision about it, because `HYPOTHESIS STATUS ≠ GOVERNANCE DECISION` and a copy of a decision
 * is a copy that can disagree with it. The read model derives the decision by looking in the
 * ledger.
 *
 * That also means this module cannot corrupt a historical record: it holds no update statement
 * against `agent_improvement_hypotheses` at all.
 *
 * ── APPROVAL IS NOT APPLICATION ──────────────────────────────────────────────
 *
 * An accepted hypothesis becomes exactly one thing: a decision record saying a human judged it
 * worth pursuing. No agent is changed, nothing is scheduled, no permit is minted and no execution
 * is reachable from here. There is no code path in this repository that applies a hypothesis.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { agentImprovementHypotheses } from "@/db/schema/agent-improvement-hypothesis";
import { decisionRecords } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordGovernanceEventWithin } from "@/features/governance-audit/governance-decision-audit.server";
import {
  resolveGovernanceDbOrNull,
  validateJustification,
  type GovernanceDeps,
} from "@/features/governance-decision/persistence.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE,
  IMPROVEMENT_HYPOTHESIS_REJECT_TYPE,
  IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
} from "./contracts";

export type HypothesisDecision = "approve" | "reject";

export type HypothesisDecisionRefusal =
  | "unauthenticated"
  | "persistence-unavailable"
  | "invalid-decision"
  | "justification-required"
  /** The tenant has no bootstrap decision, so no Governance authority exists yet. */
  | "no-governance-authority"
  /** Authenticated, but not a Governance authority for this tenant. */
  | "not-the-governance-authority"
  /** No such hypothesis IN THIS TENANT. Another tenant's hypothesis resolves here. */
  | "hypothesis-unresolvable"
  /** A decision about this hypothesis already exists. There is no re-deciding and no reversal. */
  | "already-decided";

export type HypothesisDecisionResult =
  | {
      readonly status: "decided";
      readonly decisionId: string;
      readonly sessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: HypothesisDecisionRefusal };

function refused(reason: HypothesisDecisionRefusal): HypothesisDecisionResult {
  return { status: "refused", reason };
}

/**
 * Accept or decline ONE improvement hypothesis, under an established Governance authority.
 *
 * The caller supplies which hypothesis, which way, and a human-authored justification. It cannot
 * supply the tenant, the actor, the authority source, the outcome, the decision id, the session id
 * or the time — every one of those is derived by the released writer.
 */
export async function decideImprovementHypothesis(
  tenant: TenantContext | null,
  input: {
    readonly hypothesisId: string;
    readonly decision: HypothesisDecision;
    readonly justification: string;
  },
  deps: GovernanceDeps = {},
): Promise<HypothesisDecisionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Improvement hypothesis decisions are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const approving = input?.decision === "approve";
  if (!approving && input?.decision !== "reject") return refused("invalid-decision");

  /*
   * A JUSTIFICATION IS REQUIRED IN BOTH DIRECTIONS. Declining a hypothesis is as much a governance
   * act as accepting one, and a ledger that recorded why only for acceptances would be a ledger
   * that made refusals look arbitrary.
   */
  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  /* AUTHORITY FIRST, and from one place only. SIA-3 adds no second answer to this question. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  const hypothesisId = typeof input?.hypothesisId === "string" ? input.hypothesisId.trim() : "";
  if (!hypothesisId) return refused("hypothesis-unresolvable");

  try {
    /*
     * Resolved by id AND tenant together, so a hypothesis belonging to another organization is
     * indistinguishable from one that never existed. The composite tenant foreign key on the row
     * repeats this structurally; this read produces the honest refusal.
     */
    const rows = await db
      .select({ id: agentImprovementHypotheses.id })
      .from(agentImprovementHypotheses)
      .where(
        and(
          eq(agentImprovementHypotheses.id, hypothesisId),
          eq(agentImprovementHypotheses.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);
    const hypothesis = rows[0];
    if (!hypothesis) return refused("hypothesis-unresolvable");

    /*
     * ── ONE DECISION PER HYPOTHESIS ───────────────────────────────────────────
     *
     * Checked against the LEDGER, because the ledger is where the answer lives. There is no
     * reversal here: superseding a decision is itself a Governance decision, and that runtime does
     * not exist. A hypothesis whose decision should change is replaced by a NEW hypothesis naming
     * it as predecessor — which is exactly what `supersedes_hypothesis_id` is for.
     */
    const existing = await db
      .select({ id: decisionRecords.id })
      .from(decisionRecords)
      .where(
        and(
          eq(decisionRecords.tenantId, tenant.tenantId),
          eq(decisionRecords.subjectType, IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE),
          eq(decisionRecords.subjectId, hypothesis.id),
        ),
      )
      .limit(1);
    if (existing.length > 0) return refused("already-decided");

    let recorded: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: approving
            ? IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE
            : IMPROVEMENT_HYPOTHESIS_REJECT_TYPE,
          subjectType: IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
          subjectId: hypothesis.id,
          justification,
          /*
           * Evidence carries the SHAPE of what was decided and one sentence about what it is not.
           * A ledger row is read years later by somebody with no context, and "approved" on its own
           * would read as though a change had been made.
           */
          evidence: {
            authorityVia: authority.via,
            authorityDelegationDecisionId: authority.delegationDecisionId,
            improvementHypothesisId: hypothesis.id,
            decisionAuthorizesInvestigationOnly: true,
            noChangeWasApplied: true,
          },
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
          entityId: decisionId,
          metadata: {
            governanceSessionId: sessionId,
            decisionType: approving
              ? IMPROVEMENT_HYPOTHESIS_APPROVE_TYPE
              : IMPROVEMENT_HYPOTHESIS_REJECT_TYPE,
            subjectType: IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
            subjectId: hypothesis.id,
            bootstrap: false,
          },
        },
        now,
      );

      recorded = { decisionId, sessionId };
    });

    if (!recorded) return refused("persistence-unavailable");
    const outcome = recorded as { decisionId: string; sessionId: string };
    return {
      status: "decided",
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      decidedAt: now.toISOString(),
    };
  } catch {
    return refused("persistence-unavailable");
  }
}
