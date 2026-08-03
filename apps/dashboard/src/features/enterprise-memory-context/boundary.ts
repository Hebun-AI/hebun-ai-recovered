/**
 * Enterprise Memory Context — application assembly boundary.
 *
 * The single entry point the application uses to produce an assembled context. It
 * runs the Memory Selection Engine, then deterministically assembles the selected
 * context. It never accesses SQL, PostgreSQL, the repository, retrieval, or
 * persistence directly — every record originates from a selection result.
 */

import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence";
import type { MemoryQuery } from "@/features/enterprise-memory-query";
import { selectMemory } from "@/features/enterprise-memory-selection";
import type { SelectionPolicy } from "@/features/enterprise-memory-selection";
import type { AssemblyPolicy, AssemblyResult } from "@/features/enterprise-memory-context/contracts";
import { assembleContext } from "@/features/enterprise-memory-context/engine";

/**
 * Selects memory, then deterministically assembles it into a context. A failed
 * selection propagates unchanged; assembly never runs on a failure.
 */
export async function assembleMemoryContext(
  unitOfWork: UnitOfWork<MemoryRepository>,
  query: MemoryQuery,
  selectionPolicy: SelectionPolicy,
  assemblyPolicy: AssemblyPolicy,
): Promise<AssemblyResult> {
  const selected = await selectMemory(unitOfWork, query, selectionPolicy);
  if (selected.status !== "Success") return selected;
  return assembleContext(selected.value, assemblyPolicy);
}
