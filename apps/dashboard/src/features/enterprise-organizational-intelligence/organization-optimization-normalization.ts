/**
 * Enterprise Organizational Intelligence — organization optimization normalization (Phase 4).
 *
 * Deterministically canonicalizes an optimization context:
 *   - each artifact's basis (learnings + evidence) and each opportunity's uncertainties
 *     are de-duplicated and totally ordered; the artifact is otherwise carried UNCHANGED,
 *   - analyses and opportunities are de-duplicated by identity and totally ordered,
 *   - priorities are de-duplicated by identity and surfaced in their DECLARED rank order
 *     (rank, then opportunity, then priority id) — the rank is never computed here,
 *   - the whole context is emitted immutable and frozen.
 *
 * This is pure canonicalization — NO optimization analysis, NO scoring, NO ranking
 * computation, NO recommendation. Ordering and de-duplication only; the artifact values
 * are the very objects declared upstream. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning";
import type {
  OptimizationBasis,
  OptimizationContext,
  OptimizationEffectivenessAnalysis,
  OptimizationOpportunity,
  OptimizationPriority,
  OptimizationUncertainty,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a list of items by a canonical key. */
function canonicalize<T>(items: readonly T[], keyOf: (item: T) => string): readonly T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const item = byKey.get(key);
    if (item === undefined) throw new Error("canonicalize: missing item");
    return item;
  });
}

/** De-duplicates and totally orders a basis: learnings by id, evidence by canonical key. */
export function normalizeOptimizationBasis(basis: OptimizationBasis): OptimizationBasis {
  return {
    learnings: canonicalize(basis.learnings, (learningId) => JSON.stringify(learningId)),
    evidence: canonicalize(basis.evidence, evidenceKey),
  };
}

/** De-duplicates and totally orders an uncertainty list by statement. */
export function normalizeOptimizationUncertainties(
  uncertainties: readonly OptimizationUncertainty[],
): readonly OptimizationUncertainty[] {
  return canonicalize(uncertainties, (uncertainty) => JSON.stringify(uncertainty.statement));
}

/** Returns the analysis with its basis canonicalized; the rest carried unchanged. */
export function normalizeOptimizationAnalysis(
  analysis: OptimizationEffectivenessAnalysis,
): OptimizationEffectivenessAnalysis {
  return {
    analysisId: analysis.analysisId,
    domainId: analysis.domainId,
    statement: analysis.statement,
    basis: normalizeOptimizationBasis(analysis.basis),
    provenance: analysis.provenance,
  };
}

/** Returns the opportunity with basis and uncertainties canonicalized; rest unchanged. */
export function normalizeOptimizationOpportunity(opportunity: OptimizationOpportunity): OptimizationOpportunity {
  return {
    opportunityId: opportunity.opportunityId,
    domainId: opportunity.domainId,
    statement: opportunity.statement,
    derivedFrom: opportunity.derivedFrom,
    basis: normalizeOptimizationBasis(opportunity.basis),
    uncertainties: normalizeOptimizationUncertainties(opportunity.uncertainties),
  };
}

/** De-duplicates by identity and totally orders analyses; each is canonicalized. */
export function normalizeOptimizationAnalyses(
  analyses: readonly OptimizationEffectivenessAnalysis[],
): readonly OptimizationEffectivenessAnalysis[] {
  const byId = new Map<string, OptimizationEffectivenessAnalysis>();
  for (const analysis of analyses) {
    if (!byId.has(analysis.analysisId)) byId.set(analysis.analysisId, normalizeOptimizationAnalysis(analysis));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const analysis = byId.get(id);
    if (analysis === undefined) throw new Error("normalizeOptimizationAnalyses: missing analysis");
    return analysis;
  });
}

/** De-duplicates by identity and totally orders opportunities; each is canonicalized. */
export function normalizeOptimizationOpportunities(
  opportunities: readonly OptimizationOpportunity[],
): readonly OptimizationOpportunity[] {
  const byId = new Map<string, OptimizationOpportunity>();
  for (const opportunity of opportunities) {
    if (!byId.has(opportunity.opportunityId)) {
      byId.set(opportunity.opportunityId, normalizeOptimizationOpportunity(opportunity));
    }
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const opportunity = byId.get(id);
    if (opportunity === undefined) throw new Error("normalizeOptimizationOpportunities: missing opportunity");
    return opportunity;
  });
}

/**
 * De-duplicates priorities by identity and surfaces them in DECLARED rank order
 * (rank, then opportunity id, then priority id). The rank is carried, never computed.
 */
export function normalizeOptimizationPriorities(
  priorities: readonly OptimizationPriority[],
): readonly OptimizationPriority[] {
  const byId = new Map<string, OptimizationPriority>();
  for (const priority of priorities) {
    if (!byId.has(priority.priorityId)) byId.set(priority.priorityId, priority);
  }
  return [...byId.values()].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    const byOpportunity = compareStrings(left.opportunityId, right.opportunityId);
    if (byOpportunity !== 0) return byOpportunity;
    return compareStrings(left.priorityId, right.priorityId);
  });
}

/** Canonicalizes an optimization context: analyses, opportunities, priorities normalized. */
export function normalizeOptimizationContext(context: OptimizationContext): OptimizationContext {
  return {
    organizationId: context.organizationId,
    purpose: context.purpose,
    scope: context.scope,
    analyses: normalizeOptimizationAnalyses(context.analyses),
    opportunities: normalizeOptimizationOpportunities(context.opportunities),
    priorities: normalizeOptimizationPriorities(context.priorities),
  };
}

/** A canonical key for an optimization context: organization, scope, and member ids. */
export function canonicalOptimizationContextKey(context: OptimizationContext): string {
  const normalized = normalizeOptimizationContext(context);
  return JSON.stringify([
    normalized.organizationId,
    normalized.scope.scopeId,
    normalized.analyses.map((analysis) => analysis.analysisId),
    normalized.opportunities.map((opportunity) => opportunity.opportunityId),
    normalized.priorities.map((priority) => [priority.priorityId, priority.opportunityId, priority.rank]),
  ]);
}

/** Canonicalizes and freezes an optimization context. Deterministic: same in, same out. */
export function normalizeOrganizationOptimizationContext(context: OptimizationContext): OptimizationContext {
  return Object.freeze(normalizeOptimizationContext(context));
}
