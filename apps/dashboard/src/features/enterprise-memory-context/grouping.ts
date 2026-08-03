/**
 * Enterprise Memory Context — deterministic grouping.
 *
 * Partitions records into groups by an explicit key. Groups are emitted in
 * ascending key order; within a group, the incoming record order is preserved.
 * Grouping is exact partitioning — no clustering, no similarity, no inference.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { AssemblyGroupKey } from "@/features/enterprise-memory-context/contracts";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Extracts the exact group key value for a record. */
export function groupKeyOf(record: PersistedMemoryRecord, groupBy: AssemblyGroupKey): string {
  switch (groupBy) {
    case "none":
      return "all";
    case "category":
      return record.record.classification.category;
    case "sensitivity":
      return record.record.classification.sensitivity;
    case "lifecycle":
      return record.record.lifecycle.state;
    case "memory-id":
      return record.writeIdentity.memoryId;
  }
}

export interface RecordGroup {
  readonly key: string;
  readonly records: readonly PersistedMemoryRecord[];
}

/** Groups records by the key, returning groups in ascending key order. */
export function groupRecords(
  records: readonly PersistedMemoryRecord[],
  groupBy: AssemblyGroupKey,
): readonly RecordGroup[] {
  const buckets = new Map<string, PersistedMemoryRecord[]>();
  const order: string[] = [];
  for (const record of records) {
    const key = groupKeyOf(record, groupBy);
    const existing = buckets.get(key);
    if (existing === undefined) {
      buckets.set(key, [record]);
      order.push(key);
    } else {
      existing.push(record);
    }
  }
  return order
    .slice()
    .sort(compareStrings)
    .map((key) => {
      const grouped = buckets.get(key);
      if (grouped === undefined) throw new Error("groupRecords: missing bucket");
      return { key, records: grouped };
    });
}
