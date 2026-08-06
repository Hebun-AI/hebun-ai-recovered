/**
 * Enterprise Organizational Intelligence — organization evolution validation (Phase 6).
 *
 * Validates the STRUCTURAL integrity of an evolution context: the context is named;
 * every constraint carries a statement; every readiness assessment and pathway is
 * scope-bound, basis-grounded (read-only upstream inputs), attributably provenanced,
 * uncertainty-preserving, and non-empty; every pathway derives from a declared readiness
 * assessment (readiness precedes pathway), respects only declared constraints, and
 * preserves constitutional continuity (a pathway that does not preserve continuity is
 * rejected); and no artifact is duplicated. This is a plain, deterministic structural
 * check — NOT evolution assessment, NOT prediction, NOT simulation, NOT decision, NOT
 * roadmap amendment. It confirms shape, traceability, and continuity only; it never
 * alters an artifact and describes no pathway.
 */

import type { EvolutionContext } from "@/features/enterprise-organizational-intelligence/organization-evolution-types";
import {
  evolutionBasisReachesSource,
  evolutionPathwayPreservesContinuity,
} from "@/features/enterprise-organizational-intelligence/organization-evolution-rules";

export type OrganizationEvolutionValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, ids: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`evolution context declares duplicate ${label} ${id}`);
    seen.add(id);
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function validateOrganizationEvolutionContext(context: EvolutionContext): OrganizationEvolutionValidation {
  const issues: string[] = [];

  if (context.organizationId.length === 0) issues.push("evolution context has an empty organization id");
  if (context.purpose.length === 0) issues.push("evolution context has an empty purpose");
  if (context.scope.scopeId.length === 0) issues.push("evolution context has an empty scope id");

  const declaredDomains = new Set(context.scope.domains);
  const declaredConstraints = new Set(context.constraints.map((constraint) => constraint.constraintId));
  const declaredReadiness = new Set(context.readiness.map((readiness) => readiness.readinessId));

  for (const constraint of context.constraints) {
    if (constraint.statement.length === 0) issues.push(`constraint ${constraint.constraintId} has an empty statement`);
  }

  for (const readiness of context.readiness) {
    const id = readiness.readinessId;
    if (readiness.statement.length === 0) issues.push(`readiness ${id} has an empty statement`);
    if (!declaredDomains.has(readiness.domainId)) issues.push(`readiness ${id} names an out-of-scope domain ${readiness.domainId}`);
    if (!evolutionBasisReachesSource(readiness.basis)) issues.push(`readiness ${id} has no basis`);
    if (readiness.provenance.attributedTo.length === 0) issues.push(`readiness ${id} has no attribution`);
    if (!isPositiveInteger(readiness.provenance.version)) issues.push(`readiness ${id} has an invalid provenance version`);
    for (const uncertainty of readiness.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`readiness ${id} has an uncertainty with an empty statement`);
    }
  }

  for (const pathway of context.pathways) {
    const id = pathway.pathwayId;
    if (pathway.statement.length === 0) issues.push(`pathway ${id} has an empty statement`);
    if (!declaredDomains.has(pathway.domainId)) issues.push(`pathway ${id} names an out-of-scope domain ${pathway.domainId}`);
    // Readiness precedes pathway: a pathway must derive from a declared readiness assessment.
    if (!declaredReadiness.has(pathway.derivedFrom)) {
      issues.push(`pathway ${id} derives from an undeclared readiness ${pathway.derivedFrom}`);
    }
    for (const constraintId of pathway.respects) {
      if (!declaredConstraints.has(constraintId)) {
        issues.push(`pathway ${id} respects an undeclared constraint ${constraintId}`);
      }
    }
    // Continuity required: a described pathway must preserve constitutional continuity.
    if (!evolutionPathwayPreservesContinuity(pathway)) issues.push(`pathway ${id} does not preserve continuity`);
    if (pathway.continuity.statement.length === 0) issues.push(`pathway ${id} has an empty continuity statement`);
    if (pathway.sustainability.statement.length === 0) issues.push(`pathway ${id} has an empty sustainability statement`);
    if (!evolutionBasisReachesSource(pathway.basis)) issues.push(`pathway ${id} has no basis`);
    if (pathway.provenance.attributedTo.length === 0) issues.push(`pathway ${id} has no attribution`);
    if (!isPositiveInteger(pathway.provenance.version)) issues.push(`pathway ${id} has an invalid provenance version`);
    for (const uncertainty of pathway.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`pathway ${id} has an uncertainty with an empty statement`);
    }
  }

  pushDuplicates("constraint", context.constraints.map((constraint) => constraint.constraintId), issues);
  pushDuplicates("readiness", context.readiness.map((readiness) => readiness.readinessId), issues);
  pushDuplicates("pathway", context.pathways.map((pathway) => pathway.pathwayId), issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
