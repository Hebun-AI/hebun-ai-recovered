/**
 * Enterprise Organizational Intelligence — organization learning normalization (Phase 3).
 *
 * Deterministically canonicalizes a learning context:
 *   - each learning's basis evidence and uncertainties are de-duplicated and totally
 *     ordered; the learning is otherwise carried UNCHANGED,
 *   - learnings are de-duplicated by identity and totally ordered,
 *   - relationships are de-duplicated (symmetric contradiction endpoints canonicalized)
 *     and totally ordered,
 *   - the whole context is emitted immutable and frozen.
 *
 * This is pure canonicalization — NO learning identification, NO generation, NO
 * mutation of a learning's meaning. Ordering and de-duplication only; the learning
 * values are the very objects declared upstream. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning";
import type {
  OrganizationLearning,
  OrganizationLearningBasis,
  OrganizationLearningContext,
  OrganizationLearningRelationship,
  OrganizationLearningUncertainty,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import { learningRelationshipIsSymmetric } from "@/features/enterprise-organizational-intelligence/organization-learning-rules";

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

/** De-duplicates and totally orders a learning basis by canonical evidence key. */
export function normalizeLearningBasis(basis: OrganizationLearningBasis): OrganizationLearningBasis {
  return { evidence: canonicalize(basis.evidence, evidenceKey) };
}

/** De-duplicates and totally orders a learning's uncertainties by statement. */
export function normalizeLearningUncertainties(
  uncertainties: readonly OrganizationLearningUncertainty[],
): readonly OrganizationLearningUncertainty[] {
  return canonicalize(uncertainties, (uncertainty) => JSON.stringify(uncertainty.statement));
}

/** Returns the learning with its basis and uncertainties canonicalized; rest unchanged. */
export function normalizeLearning(learning: OrganizationLearning): OrganizationLearning {
  return {
    learningId: learning.learningId,
    subject: learning.subject,
    statement: learning.statement,
    lifecycle: learning.lifecycle,
    basis: normalizeLearningBasis(learning.basis),
    provenance: learning.provenance,
    uncertainties: normalizeLearningUncertainties(learning.uncertainties),
  };
}

/** A canonical key for one relationship; symmetric endpoints are order-independent. */
export function learningRelationshipKey(relationship: OrganizationLearningRelationship): string {
  const endpoints = learningRelationshipIsSymmetric(relationship.kind)
    ? [relationship.from, relationship.to].sort(compareStrings)
    : [relationship.from, relationship.to];
  return JSON.stringify([relationship.kind, endpoints]);
}

/** De-duplicates by identity and totally orders learnings; each is canonicalized. */
export function normalizeLearnings(learnings: readonly OrganizationLearning[]): readonly OrganizationLearning[] {
  const byId = new Map<string, OrganizationLearning>();
  for (const learning of learnings) {
    if (!byId.has(learning.learningId)) byId.set(learning.learningId, normalizeLearning(learning));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const learning = byId.get(id);
    if (learning === undefined) throw new Error("normalizeLearnings: missing learning");
    return learning;
  });
}

/** De-duplicates by canonical key and totally orders relationships. */
export function normalizeLearningRelationships(
  relationships: readonly OrganizationLearningRelationship[],
): readonly OrganizationLearningRelationship[] {
  return canonicalize(relationships, learningRelationshipKey);
}

/** Canonicalizes a learning context: learnings and relationships normalized, rest carried. */
export function normalizeLearningContext(context: OrganizationLearningContext): OrganizationLearningContext {
  return {
    organizationId: context.organizationId,
    purpose: context.purpose,
    scope: context.scope,
    learnings: normalizeLearnings(context.learnings),
    relationships: normalizeLearningRelationships(context.relationships),
  };
}

/** A canonical key for a learning context: organization, scope, learnings, relationships. */
export function canonicalLearningContextKey(context: OrganizationLearningContext): string {
  const normalized = normalizeLearningContext(context);
  return JSON.stringify([
    normalized.organizationId,
    normalized.scope.scopeId,
    normalized.learnings.map((learning) => learning.learningId),
    normalized.relationships.map(learningRelationshipKey),
  ]);
}

/** Canonicalizes and freezes a learning context. Deterministic: same input, same output. */
export function normalizeOrganizationLearningContext(
  context: OrganizationLearningContext,
): OrganizationLearningContext {
  return Object.freeze(normalizeLearningContext(context));
}
