/**
 * Enterprise Memory Context — deterministic ordering.
 *
 * Applies a fixed, total ordering to records. "preserve-selection" keeps the
 * order the Selection Engine produced; every other mode sorts by an explicit key
 * with a final identity tie-break, so ordering is always total and stable.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { AssemblyOrder } from "@/features/enterprise-memory-context/contracts";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function identityTieBreak(left: PersistedMemoryRecord, right: PersistedMemoryRecord): number {
  const byId = compareStrings(left.writeIdentity.memoryId, right.writeIdentity.memoryId);
  return byId !== 0 ? byId : left.writeIdentity.version - right.writeIdentity.version;
}

export function orderRecords(
  records: readonly PersistedMemoryRecord[],
  order: AssemblyOrder,
): readonly PersistedMemoryRecord[] {
  if (order === "preserve-selection") return records;

  const sorted = [...records];
  if (order === "memory-id-asc") {
    sorted.sort(identityTieBreak);
  } else if (order === "version-desc") {
    sorted.sort((left, right) => {
      const byVersion = right.writeIdentity.version - left.writeIdentity.version;
      return byVersion !== 0 ? byVersion : identityTieBreak(left, right);
    });
  } else {
    // "stored-newest": most recently stored first, identity tie-break.
    sorted.sort((left, right) => {
      const byStored = compareStrings(right.metadata.storedAt, left.metadata.storedAt);
      return byStored !== 0 ? byStored : identityTieBreak(left, right);
    });
  }
  return sorted;
}
