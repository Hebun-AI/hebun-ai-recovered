/*
 * agent-improvement-hypothesis/read-improvement-hypotheses.server.ts — the SIA-3 read model.
 *
 * ── THE GOVERNANCE DECISION IS READ, NEVER STORED ────────────────────────────
 *
 *   HYPOTHESIS STATUS ≠ GOVERNANCE DECISION
 *
 * `agent_improvement_hypotheses` carries no status column, so this read answers "has Governance
 * decided about this?" by looking in `decision_records` — the authoritative ledger — for a decision
 * whose subject is this row. There is nothing here to fall out of step with that ledger, because
 * there is no second copy.
 *
 * A hypothesis with no decision is UNDECIDED. Undecided is not rejected: nobody has been asked, or
 * nobody has answered yet, and the surface says exactly that.
 *
 * ── AND WHAT IT WILL NOT DO ──────────────────────────────────────────────────
 *
 * It computes no score, ranks nothing, and divides no pair of counts. The evidence numbers are
 * carried across exactly as they were stored, WITH the instant they were read, so a reader is never
 * shown a snapshot dressed as a current figure.
 *
 * Server-only. Reads only; this module imports no writer.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { agentImprovementHypotheses } from "@/db/schema/agent-improvement-hypothesis";
import { agents } from "@/db/schema/agent";
import { decisionRecords } from "@/db/schema/governance";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME,
  IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE,
  type EvidenceFindingKey,
} from "./contracts";

/**
 * The bound. Stated, so the surface can say the number rather than invent one.
 *
 * SIA-1 learned this the expensive way in R6B: a bounded list whose bound is not reported reads as
 * a complete one. This list is ordered newest-first, so the bound drops the OLDEST rows — and the
 * surface says so.
 */
export const HYPOTHESIS_READ_LIMIT = 50;

/**
 * What Governance has said about one hypothesis.
 *
 * `undecided` is a THIRD state, distinct from accepted and declined. It is the absence of a
 * decision, never a decision to do nothing.
 */
export type HypothesisDecisionView =
  | { readonly status: "undecided" }
  | {
      readonly status: "decided";
      readonly decisionId: string;
      /** The authoritative ledger outcome, verbatim. Never re-worded into a status of our own. */
      readonly outcome: string;
      /** True only for the accepted outcome. Accepted means PURSUE — never APPLIED. */
      readonly accepted: boolean;
      readonly decidedAt: string | null;
      readonly justification: string;
    };

export interface ImprovementHypothesisView {
  readonly hypothesisId: string;
  /** The subject agent's name, from the identity row. The raw id stays server-side. */
  readonly agentName: string;
  readonly inService: boolean;
  readonly improvementTarget: string;
  readonly evidenceFindingKey: EvidenceFindingKey;
  readonly evidenceSource: string;
  /** The snapshot, carried as a pair and never divided. */
  readonly evidenceObservedValue: number;
  readonly evidenceObservedTotal: number;
  readonly evidenceObservedAt: string;
  readonly candidateChange: string;
  readonly expectedEffect: string;
  readonly limitations: string;
  readonly filedAt: string;
  /** Lineage. Naming a predecessor withdrew nothing, and being named withdraws nothing. */
  readonly supersedesHypothesisId: string | null;
  readonly supersededByCount: number;
  readonly decision: HypothesisDecisionView;
}

export type ImprovementHypothesisRead =
  | {
      readonly status: "read";
      readonly hypotheses: readonly ImprovementHypothesisView[];
      /** True when the bound was filled, so older rows exist and are not shown. */
      readonly truncated: boolean;
      readonly limit: number;
    }
  | { readonly status: "unavailable"; readonly reason: string };

export interface HypothesisReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly limit?: number;
}

function resolveDb(deps: HypothesisReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * Read this organization's improvement hypotheses, newest first.
 *
 * Tenant-scoped in every clause. The join to `agents` carries the tenant predicate a second time so
 * the name can only ever come from an agent this tenant owns — the composite foreign key already
 * guarantees it, and repeating it here means a defect in one is not a leak.
 */
export async function readImprovementHypotheses(
  tenant: TenantContext | null,
  deps: HypothesisReadDeps = {},
): Promise<ImprovementHypothesisRead> {
  if (typeof window !== "undefined") {
    throw new Error("Improvement hypothesis reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  const db = resolveDb(deps);
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const limit = deps.limit ?? HYPOTHESIS_READ_LIMIT;

  try {
    const rows = await db
      .select({
        id: agentImprovementHypotheses.id,
        agentName: agents.name,
        retiredAt: agents.retiredAt,
        improvementTarget: agentImprovementHypotheses.improvementTarget,
        evidenceFindingKey: agentImprovementHypotheses.evidenceFindingKey,
        evidenceSource: agentImprovementHypotheses.evidenceSource,
        evidenceObservedValue: agentImprovementHypotheses.evidenceObservedValue,
        evidenceObservedTotal: agentImprovementHypotheses.evidenceObservedTotal,
        evidenceObservedAt: agentImprovementHypotheses.evidenceObservedAt,
        candidateChange: agentImprovementHypotheses.candidateChange,
        expectedEffect: agentImprovementHypotheses.expectedEffect,
        limitations: agentImprovementHypotheses.limitations,
        createdAt: agentImprovementHypotheses.createdAt,
        supersedesHypothesisId: agentImprovementHypotheses.supersedesHypothesisId,
        /*
         * HOW MANY LATER HYPOTHESES NAME THIS ONE. Counted rather than stored, because a stored
         * counter on a historical row would mean a superseding write EDITS its predecessor — and a
         * record a later write can edit was never a record.
         */
        supersededByCount: sql<number>`(
          select count(*) from ${agentImprovementHypotheses} as successor
          where successor.supersedes_hypothesis_id = ${agentImprovementHypotheses.id}
            and successor.tenant_id = ${agentImprovementHypotheses.tenantId}
        )`,
        /*
         * THE DECISION, FROM THE AUTHORITATIVE LEDGER. A correlated read of the newest decision
         * whose subject is this hypothesis, scoped to the same tenant. Nothing is copied into this
         * table, so nothing here can contradict Governance.
         */
        decisionId: sql<string | null>`(
          select d.id from ${decisionRecords} as d
          where d.subject_type = ${IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE}
            and d.subject_id = ${agentImprovementHypotheses.id}
            and d.tenant_id = ${agentImprovementHypotheses.tenantId}
          order by d.decided_at desc nulls last
          limit 1
        )`,
        decisionOutcome: sql<string | null>`(
          select d.outcome from ${decisionRecords} as d
          where d.subject_type = ${IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE}
            and d.subject_id = ${agentImprovementHypotheses.id}
            and d.tenant_id = ${agentImprovementHypotheses.tenantId}
          order by d.decided_at desc nulls last
          limit 1
        )`,
        decisionDecidedAt: sql<Date | null>`(
          select d.decided_at from ${decisionRecords} as d
          where d.subject_type = ${IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE}
            and d.subject_id = ${agentImprovementHypotheses.id}
            and d.tenant_id = ${agentImprovementHypotheses.tenantId}
          order by d.decided_at desc nulls last
          limit 1
        )`,
        decisionJustification: sql<string | null>`(
          select d.justification from ${decisionRecords} as d
          where d.subject_type = ${IMPROVEMENT_HYPOTHESIS_SUBJECT_TYPE}
            and d.subject_id = ${agentImprovementHypotheses.id}
            and d.tenant_id = ${agentImprovementHypotheses.tenantId}
          order by d.decided_at desc nulls last
          limit 1
        )`,
      })
      .from(agentImprovementHypotheses)
      .innerJoin(
        agents,
        and(
          eq(agents.id, agentImprovementHypotheses.agentId),
          eq(agents.tenantId, agentImprovementHypotheses.tenantId),
        ),
      )
      .where(eq(agentImprovementHypotheses.tenantId, tenant.tenantId))
      .orderBy(desc(agentImprovementHypotheses.createdAt))
      .limit(limit);

    const hypotheses = rows.map((row): ImprovementHypothesisView => {
      const decision: HypothesisDecisionView = row.decisionId
        ? {
            status: "decided",
            decisionId: row.decisionId,
            outcome: String(row.decisionOutcome ?? ""),
            /*
             * ACCEPTED MEANS PURSUE. It is computed by comparing against the one accepted outcome
             * constant, so a future third outcome reads as "not accepted" rather than being
             * silently treated as one.
             */
            accepted: row.decisionOutcome === IMPROVEMENT_HYPOTHESIS_ACCEPTED_OUTCOME,
            decidedAt: row.decisionDecidedAt ? new Date(row.decisionDecidedAt).toISOString() : null,
            justification: String(row.decisionJustification ?? ""),
          }
        : { status: "undecided" };

      return {
        hypothesisId: row.id,
        agentName: row.agentName ?? "",
        inService: row.retiredAt === null,
        improvementTarget: row.improvementTarget,
        evidenceFindingKey: row.evidenceFindingKey as EvidenceFindingKey,
        evidenceSource: row.evidenceSource,
        evidenceObservedValue: Number(row.evidenceObservedValue),
        evidenceObservedTotal: Number(row.evidenceObservedTotal),
        evidenceObservedAt: new Date(row.evidenceObservedAt).toISOString(),
        candidateChange: row.candidateChange,
        expectedEffect: row.expectedEffect,
        limitations: row.limitations,
        filedAt: new Date(row.createdAt).toISOString(),
        supersedesHypothesisId: row.supersedesHypothesisId,
        supersededByCount: Number(row.supersededByCount ?? 0),
        decision,
      };
    });

    return { status: "read", hypotheses, truncated: rows.length >= limit, limit };
  } catch {
    return { status: "unavailable", reason: "read-failed" };
  }
}
