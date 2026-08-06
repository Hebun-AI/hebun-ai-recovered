/**
 * Enterprise Organizational Intelligence — organization evolution normalization (Phase 6).
 *
 * Deterministically canonicalizes an evolution context:
 *   - each artifact's basis (learnings + opportunities + assessments + evidence),
 *     uncertainties, and a pathway's respected-constraint set are de-duplicated and
 *     totally ordered; the artifact is otherwise carried UNCHANGED,
 *   - constraints, readiness assessments, and pathways are de-duplicated by identity and
 *     totally ordered,
 *   - the whole context is emitted immutable and frozen.
 *
 * This is pure canonicalization — NO evolution assessment, NO prediction, NO forecasting,
 * NO simulation, NO pathway generation. Ordering and de-duplication only; the artifact
 * values are the very objects declared upstream. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning";
import type {
  EvolutionBasis,
  EvolutionConstraint,
  EvolutionConstraintId,
  EvolutionContext,
  EvolutionPathway,
  EvolutionReadiness,
  EvolutionUncertainty,
} from "@/features/enterprise-organizational-intelligence/organization-evolution-types";

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

/** De-duplicates and totally orders a basis: id sets by id, evidence by canonical key. */
export function normalizeEvolutionBasis(basis: EvolutionBasis): EvolutionBasis {
  return {
    learnings: canonicalize(basis.learnings, (id) => JSON.stringify(id)),
    opportunities: canonicalize(basis.opportunities, (id) => JSON.stringify(id)),
    assessments: canonicalize(basis.assessments, (id) => JSON.stringify(id)),
    evidence: canonicalize(basis.evidence, evidenceKey),
  };
}

/** De-duplicates and totally orders an uncertainty list by statement. */
export function normalizeEvolutionUncertainties(
  uncertainties: readonly EvolutionUncertainty[],
): readonly EvolutionUncertainty[] {
  return canonicalize(uncertainties, (uncertainty) => JSON.stringify(uncertainty.statement));
}

/** De-duplicates and totally orders a pathway's respected-constraint set. */
export function normalizeEvolutionRespects(
  respects: readonly EvolutionConstraintId[],
): readonly EvolutionConstraintId[] {
  return canonicalize(respects, (id) => JSON.stringify(id));
}

/** Returns the readiness with its basis and uncertainties canonicalized; rest unchanged. */
export function normalizeEvolutionReadiness(readiness: EvolutionReadiness): EvolutionReadiness {
  return {
    readinessId: readiness.readinessId,
    domainId: readiness.domainId,
    statement: readiness.statement,
    basis: normalizeEvolutionBasis(readiness.basis),
    provenance: readiness.provenance,
    uncertainties: normalizeEvolutionUncertainties(readiness.uncertainties),
  };
}

/** Returns the pathway with basis, respects, and uncertainties canonicalized; rest unchanged. */
export function normalizeEvolutionPathway(pathway: EvolutionPathway): EvolutionPathway {
  return {
    pathwayId: pathway.pathwayId,
    domainId: pathway.domainId,
    statement: pathway.statement,
    derivedFrom: pathway.derivedFrom,
    respects: normalizeEvolutionRespects(pathway.respects),
    continuity: pathway.continuity,
    sustainability: pathway.sustainability,
    basis: normalizeEvolutionBasis(pathway.basis),
    provenance: pathway.provenance,
    uncertainties: normalizeEvolutionUncertainties(pathway.uncertainties),
  };
}

/** De-duplicates by identity and totally orders constraints (carried unchanged). */
export function normalizeEvolutionConstraints(
  constraints: readonly EvolutionConstraint[],
): readonly EvolutionConstraint[] {
  return canonicalize(constraints, (constraint) => JSON.stringify(constraint.constraintId));
}

/** De-duplicates by identity and totally orders readiness assessments; each is canonicalized. */
export function normalizeEvolutionReadinessSet(
  readiness: readonly EvolutionReadiness[],
): readonly EvolutionReadiness[] {
  const byId = new Map<string, EvolutionReadiness>();
  for (const item of readiness) {
    if (!byId.has(item.readinessId)) byId.set(item.readinessId, normalizeEvolutionReadiness(item));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const item = byId.get(id);
    if (item === undefined) throw new Error("normalizeEvolutionReadinessSet: missing readiness");
    return item;
  });
}

/** De-duplicates by identity and totally orders pathways; each is canonicalized. */
export function normalizeEvolutionPathways(pathways: readonly EvolutionPathway[]): readonly EvolutionPathway[] {
  const byId = new Map<string, EvolutionPathway>();
  for (const pathway of pathways) {
    if (!byId.has(pathway.pathwayId)) byId.set(pathway.pathwayId, normalizeEvolutionPathway(pathway));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const pathway = byId.get(id);
    if (pathway === undefined) throw new Error("normalizeEvolutionPathways: missing pathway");
    return pathway;
  });
}

/** Canonicalizes an evolution context: constraints, readiness, and pathways normalized. */
export function normalizeEvolutionContext(context: EvolutionContext): EvolutionContext {
  return {
    organizationId: context.organizationId,
    purpose: context.purpose,
    scope: context.scope,
    constraints: normalizeEvolutionConstraints(context.constraints),
    readiness: normalizeEvolutionReadinessSet(context.readiness),
    pathways: normalizeEvolutionPathways(context.pathways),
  };
}

/** A canonical key for an evolution context: organization, scope, and member ids. */
export function canonicalEvolutionContextKey(context: EvolutionContext): string {
  const normalized = normalizeEvolutionContext(context);
  return JSON.stringify([
    normalized.organizationId,
    normalized.scope.scopeId,
    normalized.constraints.map((constraint) => constraint.constraintId),
    normalized.readiness.map((readiness) => readiness.readinessId),
    normalized.pathways.map((pathway) => pathway.pathwayId),
  ]);
}

/** Canonicalizes and freezes an evolution context. Deterministic: same in, same out. */
export function normalizeOrganizationEvolutionContext(context: EvolutionContext): EvolutionContext {
  return Object.freeze(normalizeEvolutionContext(context));
}
