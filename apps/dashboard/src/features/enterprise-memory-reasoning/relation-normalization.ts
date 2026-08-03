/**
 * Enterprise Memory Reasoning — relation normalization (Phase 2).
 *
 * Deterministically normalizes explicit relations into a canonical form:
 *   - symmetric relations get a canonical endpoint order (order carries no
 *     meaning, so the same pair always normalizes identically),
 *   - duplicate relations (same type and same canonical endpoints) collapse to
 *     one,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — no traversal, no graph execution, no inference.
 * Endpoint keys use JSON encoding so they are unambiguous and text-safe.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import { isSymmetric } from "@/features/enterprise-memory-reasoning/relation-rules";

/** An unambiguous, text-safe key for one evidence reference. */
export function evidenceKey(reference: EvidenceReference): string {
  return JSON.stringify([reference.namespace, reference.memoryId, reference.version]);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * A canonical key for a relation. For symmetric types the endpoints are sorted so
 * (A,B) and (B,A) share a key; for directed types order is preserved.
 */
export function canonicalRelationKey(relation: ReasoningRelation): string {
  const fromKey = evidenceKey(relation.from);
  const toKey = evidenceKey(relation.to);
  const endpoints = isSymmetric(relation.type) && compareStrings(fromKey, toKey) > 0
    ? [toKey, fromKey]
    : [fromKey, toKey];
  return JSON.stringify([relation.type, endpoints[0], endpoints[1]]);
}

/** Returns the relation with symmetric endpoints in canonical order. */
export function normalizeRelation(relation: ReasoningRelation): ReasoningRelation {
  if (!isSymmetric(relation.type)) return relation;
  if (compareStrings(evidenceKey(relation.from), evidenceKey(relation.to)) <= 0) return relation;
  return { ...relation, from: relation.to, to: relation.from };
}

/**
 * Normalizes a set of relations: canonical endpoint order, duplicates removed by
 * canonical key, emitted in ascending canonical-key order. Deterministic.
 */
export function normalizeRelations(relations: readonly ReasoningRelation[]): readonly ReasoningRelation[] {
  const byKey = new Map<string, ReasoningRelation>();
  for (const relation of relations) {
    const normalized = normalizeRelation(relation);
    const key = canonicalRelationKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const relation = byKey.get(key);
      if (relation === undefined) throw new Error("normalizeRelations: missing relation");
      return relation;
    }),
  );
}
