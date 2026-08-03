/**
 * Enterprise Memory Query — deterministic filter predicates.
 *
 * Each supported filter maps to a plain boolean predicate over a persisted
 * record. There is no fuzzy matching, no similarity, no case normalization, and
 * no semantic interpretation — every predicate is exact equality or a bounded
 * inclusive range on ISO-8601 timestamps. Predicates combine with AND.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { MemoryQuery } from "@/features/enterprise-memory-query/contracts";

export type MemoryPredicate = (record: PersistedMemoryRecord) => boolean;

/**
 * Builds the ordered list of active predicates for a query. Order is fixed and
 * derived only from which fields are present; it does not affect the AND result
 * but keeps construction deterministic.
 */
export function buildPredicates(query: MemoryQuery): readonly MemoryPredicate[] {
  const predicates: MemoryPredicate[] = [];

  predicates.push((record) => record.writeIdentity.namespace === query.namespace);

  if (query.memoryId !== undefined) {
    predicates.push((record) => record.writeIdentity.memoryId === query.memoryId);
  }
  if (query.version !== undefined) {
    predicates.push((record) => record.writeIdentity.version === query.version);
  }
  if (query.sensitivity !== undefined) {
    predicates.push((record) => record.record.classification.sensitivity === query.sensitivity);
  }
  if (query.category !== undefined) {
    predicates.push((record) => record.record.classification.category === query.category);
  }
  if (query.lifecycleState !== undefined) {
    predicates.push((record) => record.record.lifecycle.state === query.lifecycleState);
  }
  if (query.approvedOnly === true) {
    predicates.push((record) => record.record.lifecycle.state === "approved");
  }
  if (query.archivedOnly === true) {
    predicates.push((record) => record.record.lifecycle.state === "archived");
  }
  if (query.currentOnly === true) {
    predicates.push((record) => record.metadata.isCurrent === true);
  }
  if (query.historical === true) {
    predicates.push((record) => record.metadata.isCurrent === false);
  }
  if (query.createdAfter !== undefined) {
    const bound = query.createdAfter;
    predicates.push((record) => record.record.lifecycle.enteredAt >= bound);
  }
  if (query.createdBefore !== undefined) {
    const bound = query.createdBefore;
    predicates.push((record) => record.record.lifecycle.enteredAt <= bound);
  }
  if (query.storedAfter !== undefined) {
    const bound = query.storedAfter;
    predicates.push((record) => record.metadata.storedAt >= bound);
  }
  if (query.storedBefore !== undefined) {
    const bound = query.storedBefore;
    predicates.push((record) => record.metadata.storedAt <= bound);
  }

  return predicates;
}

/** Combines predicates with AND. An empty set matches everything. */
export function matchesAll(record: PersistedMemoryRecord, predicates: readonly MemoryPredicate[]): boolean {
  return predicates.every((predicate) => predicate(record));
}
