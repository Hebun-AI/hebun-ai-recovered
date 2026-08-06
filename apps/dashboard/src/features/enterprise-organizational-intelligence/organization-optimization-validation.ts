/**
 * Enterprise Organizational Intelligence — organization optimization validation (Phase 4).
 *
 * Validates the STRUCTURAL integrity of an optimization context: the context is named;
 * every analysis and opportunity is scope-bound, basis-grounded (read-only learnings or
 * evidence), attributably provenanced, and non-empty; every opportunity derives from a
 * declared analysis (analysis precedes opportunity); every priority ranks a declared
 * opportunity exactly once (opportunity precedes prioritization); and no artifact is
 * duplicated. This is a plain, deterministic structural check — NOT optimization
 * analysis, NOT scoring, NOT ranking computation, NOT decision. It confirms shape and
 * traceability only; it never alters an artifact and computes no priority.
 */

import type { OptimizationContext } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import { optimizationBasisReachesSource } from "@/features/enterprise-organizational-intelligence/organization-optimization-rules";

export type OrganizationOptimizationValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, ids: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`optimization context declares duplicate ${label} ${id}`);
    seen.add(id);
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function validateOrganizationOptimizationContext(
  context: OptimizationContext,
): OrganizationOptimizationValidation {
  const issues: string[] = [];

  if (context.organizationId.length === 0) issues.push("optimization context has an empty organization id");
  if (context.purpose.length === 0) issues.push("optimization context has an empty purpose");
  if (context.scope.scopeId.length === 0) issues.push("optimization context has an empty scope id");

  const declaredDomains = new Set(context.scope.domains);
  const declaredAnalyses = new Set(context.analyses.map((analysis) => analysis.analysisId));
  const declaredOpportunities = new Set(context.opportunities.map((opportunity) => opportunity.opportunityId));

  for (const analysis of context.analyses) {
    const id = analysis.analysisId;
    if (analysis.statement.length === 0) issues.push(`analysis ${id} has an empty statement`);
    if (!declaredDomains.has(analysis.domainId)) issues.push(`analysis ${id} names an out-of-scope domain ${analysis.domainId}`);
    if (!optimizationBasisReachesSource(analysis.basis)) issues.push(`analysis ${id} has no basis`);
    if (analysis.provenance.attributedTo.length === 0) issues.push(`analysis ${id} has no attribution`);
    if (!isPositiveInteger(analysis.provenance.version)) issues.push(`analysis ${id} has an invalid provenance version`);
  }

  for (const opportunity of context.opportunities) {
    const id = opportunity.opportunityId;
    if (opportunity.statement.length === 0) issues.push(`opportunity ${id} has an empty statement`);
    if (!declaredDomains.has(opportunity.domainId)) {
      issues.push(`opportunity ${id} names an out-of-scope domain ${opportunity.domainId}`);
    }
    // Analysis precedes opportunity: an opportunity must derive from a declared analysis.
    if (!declaredAnalyses.has(opportunity.derivedFrom)) {
      issues.push(`opportunity ${id} derives from an undeclared analysis ${opportunity.derivedFrom}`);
    }
    if (!optimizationBasisReachesSource(opportunity.basis)) issues.push(`opportunity ${id} has no basis`);
    for (const uncertainty of opportunity.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`opportunity ${id} has an uncertainty with an empty statement`);
    }
  }

  const rankedOpportunities = new Set<string>();
  for (const priority of context.priorities) {
    const id = priority.priorityId;
    // Opportunity precedes prioritization: a priority must rank a declared opportunity.
    if (!declaredOpportunities.has(priority.opportunityId)) {
      issues.push(`priority ${id} ranks an undeclared opportunity ${priority.opportunityId}`);
    }
    if (rankedOpportunities.has(priority.opportunityId)) {
      issues.push(`priority ${id} ranks opportunity ${priority.opportunityId} more than once`);
    }
    rankedOpportunities.add(priority.opportunityId);
    if (!isPositiveInteger(priority.rank)) issues.push(`priority ${id} has an invalid rank`);
  }

  pushDuplicates("analysis", context.analyses.map((analysis) => analysis.analysisId), issues);
  pushDuplicates("opportunity", context.opportunities.map((opportunity) => opportunity.opportunityId), issues);
  pushDuplicates("priority", context.priorities.map((priority) => priority.priorityId), issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
