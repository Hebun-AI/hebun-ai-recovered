/**
 * Enterprise Memory Persistence — deterministic in-memory repository.
 *
 * Process-local and isolated per composition: each call creates its own store,
 * so there is no global mutable registry. Stored records are immutable on read.
 * The store implements duplicate detection, version-conflict detection, and
 * append-and-supersede — it never mutates a prior version's content and never
 * deletes. It provides no durability and no rollback beyond what the surrounding
 * UnitOfWork provides; the in-memory UnitOfWork here mirrors the canonical one.
 */

import { createDomainEventCollection } from "@/features/enterprise-domain-events";
import type { EventPublisher } from "@/features/enterprise-event-bus";
import type { MemoryId, MemoryLifecycleState, MemoryNamespace } from "@/features/enterprise-memory";
import type { PersistenceResult } from "@/features/enterprise-persistence";
import type { UnitOfWork, UnitOfWorkContext, UnitOfWorkResult } from "@/features/enterprise-unit-of-work";
import type {
  MemoryPersistenceRequest,
  MemorySupersessionReference,
  MemoryVersion,
  PersistedMemoryRecord,
} from "@/features/enterprise-memory-persistence/contracts";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence/port";
import { buildPersistedRecord } from "@/features/enterprise-memory-persistence/records";

interface StoredEntry {
  readonly request: MemoryPersistenceRequest;
  readonly version: MemoryVersion;
  /**
   * Record-level lifecycle: "approved" while active or superseded, "archived"
   * when archived. Supersession is a persistence concept (isCurrent + supersededBy),
   * not a record lifecycle state — Superseded ≠ Archived, Superseded ≠ Deleted.
   */
  lifecycleState: MemoryLifecycleState;
  isCurrent: boolean;
  supersededBy?: MemorySupersessionReference;
  archivedAt?: string;
}

function keyOf(memoryId: MemoryId, namespace: MemoryNamespace): string {
  return `${namespace}\u0000${memoryId}`;
}

function view(entry: StoredEntry): PersistedMemoryRecord {
  return buildPersistedRecord({
    request: entry.request,
    version: entry.version,
    lifecycleState: entry.lifecycleState,
    isCurrent: entry.isCurrent,
    supersededBy: entry.supersededBy,
    archivedAt: entry.archivedAt,
  });
}

export function createInMemoryMemoryRepository(): MemoryRepository {
  const entries = new Map<string, StoredEntry[]>();

  function currentOf(list: readonly StoredEntry[]): StoredEntry | undefined {
    return list.find((entry) => entry.isCurrent);
  }

  const repository: MemoryRepository = {
    storeApprovedMemory(request): PersistenceResult<PersistedMemoryRecord> {
      const key = keyOf(request.memoryId, request.namespace);
      const existing = entries.get(key);
      if (existing !== undefined && existing.length > 0) {
        return { status: "Conflict", message: `memory ${request.memoryId} already has a persisted version` };
      }
      const entry: StoredEntry = { request, version: 1, lifecycleState: "approved", isCurrent: true };
      entries.set(key, [entry]);
      return { status: "Success", value: view(entry) };
    },

    loadMemoryById(memoryId, namespace, version): PersistenceResult<PersistedMemoryRecord> {
      const list = entries.get(keyOf(memoryId, namespace)) ?? [];
      const entry = list.find((candidate) => candidate.version === version);
      return entry
        ? { status: "Success", value: view(entry) }
        : { status: "NotFound", message: `memory ${memoryId} version ${version} was not found` };
    },

    loadCurrentMemoryVersion(memoryId, namespace): PersistenceResult<PersistedMemoryRecord> {
      const current = currentOf(entries.get(keyOf(memoryId, namespace)) ?? []);
      return current
        ? { status: "Success", value: view(current) }
        : { status: "NotFound", message: `memory ${memoryId} has no current version` };
    },

    supersedeMemory(request): PersistenceResult<PersistedMemoryRecord> {
      const key = keyOf(request.memoryId, request.namespace);
      const list = entries.get(key);
      const current = list ? currentOf(list) : undefined;
      if (list === undefined || current === undefined) {
        return { status: "NotFound", message: `memory ${request.memoryId} has no current version to supersede` };
      }
      if (current.version !== request.expectedCurrentVersion) {
        return {
          status: "Conflict",
          message: `expected current version ${request.expectedCurrentVersion}, found ${current.version}`,
        };
      }
      const nextVersion = current.version + 1;
      current.isCurrent = false;
      current.supersededBy = {
        supersededVersion: current.version,
        supersededByVersion: nextVersion,
        supersededAt: request.storedAt,
      };
      const entry: StoredEntry = { request, version: nextVersion, lifecycleState: "approved", isCurrent: true };
      list.push(entry);
      return { status: "Success", value: view(entry) };
    },

    archiveMemory(memoryId, namespace, archivedAt): PersistenceResult<PersistedMemoryRecord> {
      const current = currentOf(entries.get(keyOf(memoryId, namespace)) ?? []);
      if (current === undefined) {
        return { status: "NotFound", message: `memory ${memoryId} has no current version to archive` };
      }
      current.isCurrent = false;
      current.lifecycleState = "archived";
      current.archivedAt = archivedAt;
      return { status: "Success", value: view(current) };
    },
  };

  return Object.freeze(repository);
}

/**
 * A generic in-memory UnitOfWork over the MemoryRepository. Mirrors the canonical
 * in-memory UnitOfWork exactly: it manages the event collection and publishes on
 * success; it provides no storage rollback because the in-memory store is not
 * durable. Real transactional rollback is exercised only by the PostgreSQL path.
 */
export function createInMemoryMemoryUnitOfWork(
  repository: MemoryRepository,
  eventPublisher: EventPublisher,
): UnitOfWork<MemoryRepository> {
  return Object.freeze({
    async execute<Result>(
      work: (context: UnitOfWorkContext<MemoryRepository>) => Promise<Result>,
    ): Promise<UnitOfWorkResult<Result>> {
      const events = createDomainEventCollection();
      try {
        const value = await work({ resources: repository, events });
        const committedEvents = events.drain();
        await eventPublisher.publish(committedEvents);
        return Object.freeze({ value, committedEvents });
      } catch (error) {
        events.clear();
        throw error;
      }
    },
  });
}
