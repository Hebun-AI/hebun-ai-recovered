/**
 * Enterprise Memory Query — deterministic query execution pipeline.
 *
 * Pipeline: validate → load base collection via the Memory Retrieval boundary →
 * filter with the plan predicates → order with the plan comparator → freeze. The
 * engine never touches SQL, never opens a connection, and never reasons — it
 * composes deterministic predicates over records the retrieval boundary returns.
 * Identical input always yields an identical, immutable result.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { PersistenceResult } from "@/features/enterprise-persistence";
import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence";
import { retrieveMemoriesByLifecycle, retrieveMemoryHistory } from "@/features/enterprise-memory-retrieval";
import { buildQueryPlan } from "@/features/enterprise-memory-query/builder";
import type { MemoryQuery, MemoryQueryResult } from "@/features/enterprise-memory-query/contracts";
import { matchesAll } from "@/features/enterprise-memory-query/filters";
import { validateQuery } from "@/features/enterprise-memory-query/validation";

type MemoryUnitOfWork = UnitOfWork<MemoryRepository>;
type CollectionResult = PersistenceResult<readonly PersistedMemoryRecord[]>;

/**
 * Loads the broadest correct base for a query. When a specific memory is named,
 * its full history is the base; otherwise the base is every persisted record in
 * the namespace (approved and archived), so any post-filter is a safe subset.
 */
async function loadBase(unitOfWork: MemoryUnitOfWork, query: MemoryQuery): Promise<CollectionResult> {
  if (query.memoryId !== undefined) {
    return retrieveMemoryHistory(unitOfWork, query.memoryId, query.namespace);
  }
  const approved = await retrieveMemoriesByLifecycle(unitOfWork, { namespace: query.namespace, lifecycleState: "approved" });
  if (approved.status !== "Success") return approved;
  const archived = await retrieveMemoriesByLifecycle(unitOfWork, { namespace: query.namespace, lifecycleState: "archived" });
  if (archived.status !== "Success") return archived;
  return { status: "Success", value: [...approved.value, ...archived.value] };
}

export async function executeMemoryQuery(unitOfWork: MemoryUnitOfWork, query: MemoryQuery): Promise<MemoryQueryResult> {
  const validation = validateQuery(query);
  if (!validation.ok) {
    return { status: "ValidationFailure", issues: validation.issues };
  }

  const base = await loadBase(unitOfWork, query);
  if (base.status !== "Success") return base;

  const plan = buildQueryPlan(query);
  const filtered = base.value.filter((record) => matchesAll(record, plan.predicates));
  const ordered = [...filtered].sort(plan.compare);
  return { status: "Success", value: Object.freeze(ordered) };
}
