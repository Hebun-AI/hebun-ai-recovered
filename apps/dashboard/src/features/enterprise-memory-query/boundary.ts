/**
 * Enterprise Memory Query — application query boundary.
 *
 * The single entry point the application uses to run a memory query. It delegates
 * to the deterministic query engine and adds no behavior of its own — no writes,
 * no side effects, no reasoning.
 */

import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence";
import type { MemoryQuery, MemoryQueryResult } from "@/features/enterprise-memory-query/contracts";
import { executeMemoryQuery } from "@/features/enterprise-memory-query/engine";

/** Runs a deterministic memory query through the Memory UnitOfWork. */
export function queryMemory(
  unitOfWork: UnitOfWork<MemoryRepository>,
  query: MemoryQuery,
): Promise<MemoryQueryResult> {
  return executeMemoryQuery(unitOfWork, query);
}
