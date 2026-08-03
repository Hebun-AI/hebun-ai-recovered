/**
 * Enterprise Memory Selection — deterministic selection filters.
 *
 * Each policy field maps to a plain boolean predicate over a persisted record.
 * Exact equality and a fixed confidence ordering only — no fuzzy matching, no
 * similarity, no scoring, no semantic interpretation.
 */

import type { MemoryConfidenceLevel } from "@/features/enterprise-memory";
import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { SelectionPolicy } from "@/features/enterprise-memory-selection/contracts";

export type SelectionPredicate = (record: PersistedMemoryRecord) => boolean;

/** Fixed total order over the published confidence enum. Not a score. */
export const CONFIDENCE_ORDER: Readonly<Record<MemoryConfidenceLevel, number>> = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  verified: 3,
});

/** Builds the active selection predicates for a policy, combined with AND. */
export function buildSelectionPredicates(policy: SelectionPolicy): readonly SelectionPredicate[] {
  const predicates: SelectionPredicate[] = [];

  if (policy.requireCurrent === true) {
    predicates.push((record) => record.metadata.isCurrent === true);
  }
  if (policy.lifecycleState !== undefined) {
    predicates.push((record) => record.record.lifecycle.state === policy.lifecycleState);
  }
  if (policy.minConfidenceLevel !== undefined) {
    const minimum = CONFIDENCE_ORDER[policy.minConfidenceLevel];
    predicates.push((record) => CONFIDENCE_ORDER[record.record.confidence.level] >= minimum);
  }
  if (policy.sensitivity !== undefined) {
    predicates.push((record) => record.record.classification.sensitivity === policy.sensitivity);
  }
  if (policy.category !== undefined) {
    predicates.push((record) => record.record.classification.category === policy.category);
  }

  return predicates;
}

export function selectionMatches(record: PersistedMemoryRecord, predicates: readonly SelectionPredicate[]): boolean {
  return predicates.every((predicate) => predicate(record));
}
