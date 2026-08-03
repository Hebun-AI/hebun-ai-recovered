/**
 * Enterprise Memory Selection — deterministic prioritization.
 *
 * Turns an ordered list of preference criteria into a single total comparator.
 * Each criterion is a fixed, explicit rule; there is no probability, no learned
 * weight, and no similarity. A final identity tie-break (memory id, then version)
 * guarantees a total order, so ordering is fully deterministic and stable.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import { CONFIDENCE_ORDER } from "@/features/enterprise-memory-selection/filters";
import type { SelectionPriority } from "@/features/enterprise-memory-selection/contracts";

export type RecordComparator = (left: PersistedMemoryRecord, right: PersistedMemoryRecord) => number;

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

const CRITERION: Readonly<Record<SelectionPriority, RecordComparator>> = Object.freeze({
  "current-first": (left, right) => Number(right.metadata.isCurrent) - Number(left.metadata.isCurrent),
  "confidence-desc": (left, right) =>
    CONFIDENCE_ORDER[right.record.confidence.level] - CONFIDENCE_ORDER[left.record.confidence.level],
  "newest-stored-first": (left, right) => compareStrings(right.metadata.storedAt, left.metadata.storedAt),
  "oldest-stored-first": (left, right) => compareStrings(left.metadata.storedAt, right.metadata.storedAt),
  "version-desc": (left, right) => right.writeIdentity.version - left.writeIdentity.version,
  "version-asc": (left, right) => left.writeIdentity.version - right.writeIdentity.version,
});

/** The final identity tie-break: a total order independent of any policy. */
function identityTieBreak(left: PersistedMemoryRecord, right: PersistedMemoryRecord): number {
  const byId = compareStrings(left.writeIdentity.memoryId, right.writeIdentity.memoryId);
  return byId !== 0 ? byId : left.writeIdentity.version - right.writeIdentity.version;
}

/** Composes the priority criteria into one total, deterministic comparator. */
export function buildComparator(prioritize: readonly SelectionPriority[] = []): RecordComparator {
  return (left, right) => {
    for (const priority of prioritize) {
      const result = CRITERION[priority](left, right);
      if (result !== 0) return result;
    }
    return identityTieBreak(left, right);
  };
}
