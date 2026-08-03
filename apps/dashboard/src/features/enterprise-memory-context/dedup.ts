/**
 * Enterprise Memory Context — deterministic deduplication.
 *
 * Removes duplicate records by an explicit, total rule. There is no similarity or
 * fuzzy matching — deduplication is exact identity or a deterministic per-memory
 * choice. Input order is preserved for the records that survive.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { AssemblyDedup } from "@/features/enterprise-memory-context/contracts";

function identityKey(record: PersistedMemoryRecord): string {
  return `${record.writeIdentity.namespace}\u0000${record.writeIdentity.memoryId}\u0000${record.writeIdentity.version}`;
}

function memoryKey(record: PersistedMemoryRecord): string {
  return `${record.writeIdentity.namespace}\u0000${record.writeIdentity.memoryId}`;
}

export function deduplicate(
  records: readonly PersistedMemoryRecord[],
  strategy: AssemblyDedup,
): readonly PersistedMemoryRecord[] {
  if (strategy === "none") return records;

  if (strategy === "by-identity") {
    const seen = new Set<string>();
    const result: PersistedMemoryRecord[] = [];
    for (const record of records) {
      const key = identityKey(record);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(record);
    }
    return result;
  }

  // Per-memory strategies: keep exactly one record per logical memory.
  const chosen = new Map<string, PersistedMemoryRecord>();
  for (const record of records) {
    const key = memoryKey(record);
    const current = chosen.get(key);
    if (current === undefined) {
      chosen.set(key, record);
      continue;
    }
    if (strategy === "by-memory-latest" && record.writeIdentity.version > current.writeIdentity.version) {
      chosen.set(key, record);
    }
    // "by-memory-first" keeps the earliest occurrence, so no replacement.
  }
  // Preserve first-seen order of the kept memories deterministically.
  const order: string[] = [];
  const emitted = new Set<string>();
  for (const record of records) {
    const key = memoryKey(record);
    if (emitted.has(key)) continue;
    emitted.add(key);
    order.push(key);
  }
  return order.map((key) => {
    const record = chosen.get(key);
    if (record === undefined) throw new Error("deduplicate: missing chosen record");
    return record;
  });
}
