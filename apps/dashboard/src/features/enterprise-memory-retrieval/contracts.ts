/**
 * Enterprise Memory Retrieval — retrieval contracts.
 *
 * The retrieval boundary loads already-persisted memory deterministically. It is
 * NOT semantic search, NOT similarity, NOT ranking, NOT selection, NOT synthesis,
 * and NOT AI. Every query is a plain equality lookup with an explicit, fixed
 * ordering. Results reuse the published persistence contracts; nothing new about
 * a memory is modeled here.
 */

import type {
  MemoryLifecycleState,
  MemoryNamespace,
  MemorySensitivity,
} from "@/features/enterprise-memory";
import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { PersistenceResult } from "@/features/enterprise-persistence";

/** A plain equality query over current memories' classification. */
export interface MemoryClassificationQuery {
  readonly namespace: MemoryNamespace;
  readonly sensitivity: MemorySensitivity;
  readonly category?: string;
}

/** A plain equality query over records' lifecycle state. */
export interface MemoryLifecycleQuery {
  readonly namespace: MemoryNamespace;
  readonly lifecycleState: MemoryLifecycleState;
}

/** The result of retrieving a single memory record. */
export type MemoryRetrievalResult = PersistenceResult<PersistedMemoryRecord>;

/** The result of retrieving an ordered collection of memory records. */
export type MemoryCollectionResult = PersistenceResult<readonly PersistedMemoryRecord[]>;
