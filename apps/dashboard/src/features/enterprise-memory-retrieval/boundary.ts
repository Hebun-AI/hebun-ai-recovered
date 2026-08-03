/**
 * Enterprise Memory Retrieval — application retrieval boundary.
 *
 * The single path the application uses to load persisted memory. It runs every
 * read through the Memory UnitOfWork and delegates to the Memory Repository Port.
 * It performs no ranking, selection, filtering heuristics, or synthesis — it
 * loads exactly what the deterministic port returns. It never writes.
 */

import type { MemoryId, MemoryNamespace } from "@/features/enterprise-memory";
import type { MemoryRepository, MemoryVersion } from "@/features/enterprise-memory-persistence";
import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type {
  MemoryClassificationQuery,
  MemoryCollectionResult,
  MemoryLifecycleQuery,
  MemoryRetrievalResult,
} from "@/features/enterprise-memory-retrieval/contracts";

type MemoryUnitOfWork = UnitOfWork<MemoryRepository>;

/** Loads one specific version of a memory. */
export async function retrieveMemoryVersion(
  unitOfWork: MemoryUnitOfWork,
  memoryId: MemoryId,
  namespace: MemoryNamespace,
  version: MemoryVersion,
): Promise<MemoryRetrievalResult> {
  return (await unitOfWork.execute(async ({ resources }) => resources.loadMemoryById(memoryId, namespace, version))).value;
}

/** Loads the current version of a memory. */
export async function retrieveCurrentMemory(
  unitOfWork: MemoryUnitOfWork,
  memoryId: MemoryId,
  namespace: MemoryNamespace,
): Promise<MemoryRetrievalResult> {
  return (await unitOfWork.execute(async ({ resources }) => resources.loadCurrentMemoryVersion(memoryId, namespace))).value;
}

/** Loads every version of a memory in ascending version order. */
export async function retrieveMemoryHistory(
  unitOfWork: MemoryUnitOfWork,
  memoryId: MemoryId,
  namespace: MemoryNamespace,
): Promise<MemoryCollectionResult> {
  return (await unitOfWork.execute(async ({ resources }) => resources.loadMemoryHistory(memoryId, namespace))).value;
}

/** Loads current memories matching a classification, ordered by memory id. */
export async function retrieveMemoriesByClassification(
  unitOfWork: MemoryUnitOfWork,
  query: MemoryClassificationQuery,
): Promise<MemoryCollectionResult> {
  return (
    await unitOfWork.execute(async ({ resources }) =>
      resources.loadByClassification(query.namespace, query.sensitivity, query.category),
    )
  ).value;
}

/** Loads records matching a lifecycle state, ordered by memory id then version. */
export async function retrieveMemoriesByLifecycle(
  unitOfWork: MemoryUnitOfWork,
  query: MemoryLifecycleQuery,
): Promise<MemoryCollectionResult> {
  return (
    await unitOfWork.execute(async ({ resources }) =>
      resources.loadByLifecycle(query.namespace, query.lifecycleState),
    )
  ).value;
}
