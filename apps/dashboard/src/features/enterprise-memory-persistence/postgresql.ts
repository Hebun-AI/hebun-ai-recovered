/**
 * Enterprise Memory Persistence — PostgreSQL repository.
 *
 * Satisfies the MemoryRepository port against PostgreSQL using parameterized SQL
 * only. It runs on the transaction-scoped executor supplied by the existing
 * UnitOfWork — it opens no connection, owns no pool, and manages no transaction.
 * No storage type leaks upward: every method returns the neutral port shapes.
 * Prior versions are never overwritten; supersede and archive append or flag.
 */

import type { PostgresQueryExecutor } from "@/features/enterprise-persistence/postgresql";
import type { MemoryLifecycleState } from "@/features/enterprise-memory";
import type { PersistenceResult } from "@/features/enterprise-persistence";
import type {
  MemoryPersistenceRequest,
  MemorySupersessionReference,
  PersistedMemoryRecord,
} from "@/features/enterprise-memory-persistence/contracts";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence/port";
import { buildPersistedRecord } from "@/features/enterprise-memory-persistence/records";

interface MemoryRow {
  readonly memory_id: string;
  readonly namespace: string;
  readonly version: number;
  readonly lifecycle_state: MemoryLifecycleState;
  readonly content: MemoryPersistenceRequest["content"];
  readonly classification: MemoryPersistenceRequest["classification"];
  readonly provenance: MemoryPersistenceRequest["provenance"];
  readonly authority: MemoryPersistenceRequest["authority"];
  readonly confidence: MemoryPersistenceRequest["confidence"];
  readonly source: MemoryPersistenceRequest["source"];
  readonly relationships: MemoryPersistenceRequest["relationships"];
  readonly admission_reference: MemoryPersistenceRequest["admissionReference"];
  readonly superseded_by: MemorySupersessionReference | null;
  readonly is_current: boolean;
  readonly stored_at: string;
  readonly archived_at: string | null;
  readonly concurrency_token: string;
}

const SELECT_COLUMNS =
  "memory_id, namespace, version, lifecycle_state, content, classification, provenance, authority, " +
  "confidence, source, relationships, admission_reference, superseded_by, is_current, stored_at, " +
  "archived_at, concurrency_token";

function mapRow(row: MemoryRow): PersistedMemoryRecord {
  const request: MemoryPersistenceRequest = {
    memoryId: row.memory_id,
    namespace: row.namespace,
    content: row.content,
    classification: row.classification,
    provenance: row.provenance,
    authority: row.authority,
    confidence: row.confidence,
    source: row.source,
    relationships: row.relationships,
    admissionReference: row.admission_reference,
    storedAt: row.stored_at,
    concurrencyToken: row.concurrency_token,
  };
  return buildPersistedRecord({
    request,
    version: row.version,
    lifecycleState: row.lifecycle_state,
    isCurrent: row.is_current,
    supersededBy: row.superseded_by ?? undefined,
    archivedAt: row.archived_at ?? undefined,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "23505";
}

function classifyFailure(error: unknown): PersistenceResult<never> {
  if (isUniqueViolation(error)) {
    return { status: "Conflict", message: "a conflicting memory version already exists" };
  }
  if (!(error instanceof Error)) {
    return { status: "PermanentFailure", message: "unknown memory persistence failure" };
  }
  const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
  if (code?.startsWith("08") || code === "40001" || code === "40P01" || code === "57P01") {
    return { status: "TemporaryFailure", message: error.message };
  }
  return { status: "PermanentFailure", message: error.message };
}

export function createPostgresMemoryRepository(executor: PostgresQueryExecutor): MemoryRepository {
  async function insertVersion(
    request: MemoryPersistenceRequest,
    version: number,
    lifecycleState: MemoryLifecycleState,
  ): Promise<MemoryRow> {
    const result = await executor.query<MemoryRow>(
      `insert into enterprise_memory_records
         (memory_id, namespace, version, lifecycle_state, content, classification, provenance, authority,
          confidence, source, relationships, admission_reference, superseded_by, is_current, stored_at,
          archived_at, concurrency_token)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb,
               $12::jsonb, null, true, $13, null, $14)
       returning ${SELECT_COLUMNS}`,
      [
        request.memoryId,
        request.namespace,
        version,
        lifecycleState,
        JSON.stringify(request.content),
        JSON.stringify(request.classification),
        JSON.stringify(request.provenance),
        JSON.stringify(request.authority),
        JSON.stringify(request.confidence),
        JSON.stringify(request.source),
        JSON.stringify(request.relationships),
        JSON.stringify(request.admissionReference),
        request.storedAt,
        request.concurrencyToken,
      ],
    );
    return result.rows[0];
  }

  const repository: MemoryRepository = {
    async storeApprovedMemory(request): Promise<PersistenceResult<PersistedMemoryRecord>> {
      try {
        return { status: "Success", value: mapRow(await insertVersion(request, 1, "approved")) };
      } catch (error) {
        return classifyFailure(error);
      }
    },

    async loadMemoryById(memoryId, namespace, version): Promise<PersistenceResult<PersistedMemoryRecord>> {
      try {
        const result = await executor.query<MemoryRow>(
          `select ${SELECT_COLUMNS} from enterprise_memory_records
             where memory_id = $1 and namespace = $2 and version = $3`,
          [memoryId, namespace, version],
        );
        const row = result.rows[0];
        return row
          ? { status: "Success", value: mapRow(row) }
          : { status: "NotFound", message: `memory ${memoryId} version ${version} was not found` };
      } catch (error) {
        return classifyFailure(error);
      }
    },

    async loadCurrentMemoryVersion(memoryId, namespace): Promise<PersistenceResult<PersistedMemoryRecord>> {
      try {
        const result = await executor.query<MemoryRow>(
          `select ${SELECT_COLUMNS} from enterprise_memory_records
             where memory_id = $1 and namespace = $2 and is_current = true`,
          [memoryId, namespace],
        );
        const row = result.rows[0];
        return row
          ? { status: "Success", value: mapRow(row) }
          : { status: "NotFound", message: `memory ${memoryId} has no current version` };
      } catch (error) {
        return classifyFailure(error);
      }
    },

    async supersedeMemory(request): Promise<PersistenceResult<PersistedMemoryRecord>> {
      try {
        const current = await executor.query<{ version: number }>(
          `select version from enterprise_memory_records
             where memory_id = $1 and namespace = $2 and is_current = true
             for update`,
          [request.memoryId, request.namespace],
        );
        const currentVersion = current.rows[0]?.version;
        if (currentVersion === undefined) {
          return { status: "NotFound", message: `memory ${request.memoryId} has no current version to supersede` };
        }
        if (currentVersion !== request.expectedCurrentVersion) {
          return {
            status: "Conflict",
            message: `expected current version ${request.expectedCurrentVersion}, found ${currentVersion}`,
          };
        }
        const nextVersion = currentVersion + 1;
        await executor.query(
          `update enterprise_memory_records
             set is_current = false, superseded_by = $4::jsonb
             where memory_id = $1 and namespace = $2 and version = $3`,
          [
            request.memoryId,
            request.namespace,
            currentVersion,
            JSON.stringify({
              supersededVersion: currentVersion,
              supersededByVersion: nextVersion,
              supersededAt: request.storedAt,
            }),
          ],
        );
        return { status: "Success", value: mapRow(await insertVersion(request, nextVersion, "approved")) };
      } catch (error) {
        return classifyFailure(error);
      }
    },

    async archiveMemory(memoryId, namespace, archivedAt): Promise<PersistenceResult<PersistedMemoryRecord>> {
      try {
        const result = await executor.query<MemoryRow>(
          `update enterprise_memory_records
             set is_current = false, lifecycle_state = 'archived', archived_at = $3
             where memory_id = $1 and namespace = $2 and is_current = true
             returning ${SELECT_COLUMNS}`,
          [memoryId, namespace, archivedAt],
        );
        const row = result.rows[0];
        return row
          ? { status: "Success", value: mapRow(row) }
          : { status: "NotFound", message: `memory ${memoryId} has no current version to archive` };
      } catch (error) {
        return classifyFailure(error);
      }
    },
  };

  return Object.freeze(repository);
}
