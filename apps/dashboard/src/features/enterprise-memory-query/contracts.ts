/**
 * Enterprise Memory Query — query and filter contracts.
 *
 * A deterministic query surface over already-persisted memory. It composes plain
 * equality and bounded range filters. It is NOT semantic search, NOT similarity,
 * NOT ranking, NOT AI, and NOT reasoning. Every field is an exact predicate; the
 * result ordering is fixed. Contracts reuse the published persistence result and
 * record shapes; nothing new about a memory is modeled here.
 */

import type {
  MemoryId,
  MemoryLifecycleState,
  MemoryNamespace,
  MemorySensitivity,
  MemoryTimestamp,
} from "@/features/enterprise-memory";
import type { MemoryVersion, PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type { PersistenceResult } from "@/features/enterprise-persistence";

/**
 * A memory query. `namespace` is required; every other field is an optional
 * filter combined with AND semantics. Absent fields impose no constraint.
 *
 * Timestamp bounds are inclusive and compared as ISO-8601 strings (lexicographic
 * order equals chronological order for UTC timestamps). "created" refers to the
 * record's lifecycle entry time; "stored" refers to the persistence store time.
 */
export interface MemoryQuery {
  readonly namespace: MemoryNamespace;
  readonly memoryId?: MemoryId;
  readonly version?: MemoryVersion;
  readonly sensitivity?: MemorySensitivity;
  readonly category?: string;
  readonly lifecycleState?: MemoryLifecycleState;
  readonly currentOnly?: boolean;
  readonly historical?: boolean;
  readonly approvedOnly?: boolean;
  readonly archivedOnly?: boolean;
  readonly createdAfter?: MemoryTimestamp;
  readonly createdBefore?: MemoryTimestamp;
  readonly storedAfter?: MemoryTimestamp;
  readonly storedBefore?: MemoryTimestamp;
}

/** The result of executing a memory query: an ordered, immutable collection. */
export type MemoryQueryResult = PersistenceResult<readonly PersistedMemoryRecord[]>;
