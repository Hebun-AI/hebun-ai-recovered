/**
 * Enterprise Memory Persistence — repository port.
 *
 * A business-oriented port. It exposes memory persistence intents only — it never
 * exposes SQL, PostgreSQL, Drizzle, tables, queries, JSON columns, ORM types, or
 * connection clients. In-memory and PostgreSQL implementations satisfy exactly
 * this port. The port stores and loads deterministically by identity, version,
 * classification, and lifecycle. Loading is not ranking, selecting, or
 * synthesizing — it performs no similarity, scoring, or semantic retrieval.
 */

import type {
  MemoryId,
  MemoryLifecycleState,
  MemoryNamespace,
  MemorySensitivity,
} from "@/features/enterprise-memory";
import type { RepositoryResult } from "@/features/enterprise-persistence";
import type {
  MemoryPersistenceRequest,
  MemorySupersessionRequest,
  MemoryVersion,
  PersistedMemoryRecord,
} from "@/features/enterprise-memory-persistence/contracts";

export interface MemoryRepository {
  /** Stores a first-version approved memory. A duplicate current version conflicts. */
  storeApprovedMemory(request: MemoryPersistenceRequest): RepositoryResult<PersistedMemoryRecord>;

  /** Loads one specific version of a memory. */
  loadMemoryById(
    memoryId: MemoryId,
    namespace: MemoryNamespace,
    version: MemoryVersion,
  ): RepositoryResult<PersistedMemoryRecord>;

  /** Loads the current (non-superseded, non-archived) version of a memory. */
  loadCurrentMemoryVersion(
    memoryId: MemoryId,
    namespace: MemoryNamespace,
  ): RepositoryResult<PersistedMemoryRecord>;

  /** Appends a new version and supersedes the prior current version. */
  supersedeMemory(request: MemorySupersessionRequest): RepositoryResult<PersistedMemoryRecord>;

  /** Archives the current version. Archived is retained, never deleted. */
  archiveMemory(
    memoryId: MemoryId,
    namespace: MemoryNamespace,
    archivedAt: string,
  ): RepositoryResult<PersistedMemoryRecord>;

  /** Loads every version of a memory in ascending version order. Deterministic. */
  loadMemoryHistory(
    memoryId: MemoryId,
    namespace: MemoryNamespace,
  ): RepositoryResult<readonly PersistedMemoryRecord[]>;

  /**
   * Loads current versions whose classification matches, ordered by memory id.
   * A plain equality match — no ranking, no similarity, no scoring.
   */
  loadByClassification(
    namespace: MemoryNamespace,
    sensitivity: MemorySensitivity,
    category?: string,
  ): RepositoryResult<readonly PersistedMemoryRecord[]>;

  /**
   * Loads records whose record lifecycle state matches, ordered by memory id then
   * version. A plain equality match — deterministic, no filtering heuristics.
   */
  loadByLifecycle(
    namespace: MemoryNamespace,
    lifecycleState: MemoryLifecycleState,
  ): RepositoryResult<readonly PersistedMemoryRecord[]>;
}
