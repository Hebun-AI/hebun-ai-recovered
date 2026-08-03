/**
 * Enterprise Memory Query — deterministic query builder.
 *
 * Turns a query into a fixed execution plan: a predicate set and a total
 * comparator. There is no dynamic plugin model, no runtime registration, and no
 * reflection — the plan is a pure function of the query fields.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { MemoryQuery } from "@/features/enterprise-memory-query/contracts";
import { buildPredicates } from "@/features/enterprise-memory-query/filters";
import type { MemoryPredicate } from "@/features/enterprise-memory-query/filters";

export interface QueryPlan {
  readonly predicates: readonly MemoryPredicate[];
  readonly compare: (left: PersistedMemoryRecord, right: PersistedMemoryRecord) => number;
}

/** Deterministic, locale-independent string ordering. */
function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Fixed total order: memory id ascending, then version ascending. */
function compareRecords(left: PersistedMemoryRecord, right: PersistedMemoryRecord): number {
  const byId = compareStrings(left.writeIdentity.memoryId, right.writeIdentity.memoryId);
  return byId !== 0 ? byId : left.writeIdentity.version - right.writeIdentity.version;
}

export function buildQueryPlan(query: MemoryQuery): QueryPlan {
  return { predicates: buildPredicates(query), compare: compareRecords };
}
