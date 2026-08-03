/**
 * Enterprise Memory Selection — application selection boundary.
 *
 * The single entry point the application uses to produce a selected memory
 * context. It runs the Memory Query Engine, then applies deterministic selection
 * to the query results. It never accesses PostgreSQL, never executes SQL, and
 * never bypasses the Query Engine — every candidate comes from a query result.
 */

import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence";
import { queryMemory } from "@/features/enterprise-memory-query";
import type { MemoryQuery } from "@/features/enterprise-memory-query";
import type { SelectionPolicy, SelectionResult } from "@/features/enterprise-memory-selection/contracts";
import { selectFromRecords } from "@/features/enterprise-memory-selection/engine";

/**
 * Queries memory, then deterministically selects a bounded context from the
 * results. A failed query propagates unchanged; selection never runs on a failure.
 */
export async function selectMemory(
  unitOfWork: UnitOfWork<MemoryRepository>,
  query: MemoryQuery,
  policy: SelectionPolicy,
): Promise<SelectionResult> {
  const queried = await queryMemory(unitOfWork, query);
  if (queried.status !== "Success") return queried;
  return selectFromRecords(queried.value, policy);
}
