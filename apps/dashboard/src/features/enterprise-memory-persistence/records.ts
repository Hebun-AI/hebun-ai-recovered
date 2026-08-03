/**
 * Enterprise Memory Persistence — record construction.
 *
 * Deterministic builders that turn a persistence request into the canonical
 * MemoryRecord and its persisted wrapper. Shared by every repository so the
 * mapping is identical regardless of backing store. Every produced value is
 * deeply frozen — stored records are immutable.
 */

import type { MemoryLifecycleState, MemoryRecord } from "@/features/enterprise-memory";
import type {
  MemoryPersistenceMetadata,
  MemoryPersistenceRequest,
  MemorySupersessionReference,
  PersistedMemoryRecord,
} from "@/features/enterprise-memory-persistence/contracts";

/** Builds the canonical MemoryRecord for a persisted version. */
export function buildMemoryRecord(
  request: MemoryPersistenceRequest,
  lifecycleState: MemoryLifecycleState,
): MemoryRecord {
  return Object.freeze({
    identity: Object.freeze({ memoryId: request.memoryId, namespace: request.namespace }),
    content: request.content,
    source: request.source,
    authority: request.authority,
    provenance: request.provenance,
    confidence: request.confidence,
    classification: request.classification,
    lifecycle: Object.freeze({ state: lifecycleState, enteredAt: request.storedAt }),
    relationships: request.relationships,
  });
}

export interface PersistedRecordShape {
  readonly request: MemoryPersistenceRequest;
  readonly version: number;
  readonly lifecycleState: MemoryLifecycleState;
  readonly isCurrent: boolean;
  readonly supersededBy?: MemorySupersessionReference;
  readonly archivedAt?: string;
}

/** Builds the immutable persisted record wrapper. */
export function buildPersistedRecord(shape: PersistedRecordShape): PersistedMemoryRecord {
  const metadata: MemoryPersistenceMetadata = Object.freeze({
    storedAt: shape.request.storedAt,
    concurrencyToken: shape.request.concurrencyToken,
    isCurrent: shape.isCurrent,
    ...(shape.archivedAt !== undefined ? { archivedAt: shape.archivedAt } : {}),
  });

  return Object.freeze({
    writeIdentity: Object.freeze({
      memoryId: shape.request.memoryId,
      namespace: shape.request.namespace,
      version: shape.version,
    }),
    record: buildMemoryRecord(shape.request, shape.lifecycleState),
    admissionReference: shape.request.admissionReference,
    ...(shape.supersededBy !== undefined ? { supersededBy: shape.supersededBy } : {}),
    metadata,
  });
}
