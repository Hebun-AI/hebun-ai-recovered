export type {
  MemoryAdmissionReference,
  MemoryPersistenceMetadata,
  MemoryPersistenceRequest,
  MemoryPersistenceResult,
  MemorySupersessionReference,
  MemorySupersessionRequest,
  MemoryVersion,
  MemoryVersionReference,
  MemoryWriteIdentity,
  PersistedMemoryRecord,
} from "@/features/enterprise-memory-persistence/contracts";
export type { MemoryRepository } from "@/features/enterprise-memory-persistence/port";
export { persistApprovedMemory } from "@/features/enterprise-memory-persistence/gate";
export type { MemoryPersistenceContext } from "@/features/enterprise-memory-persistence/gate";
export { buildMemoryRecord, buildPersistedRecord } from "@/features/enterprise-memory-persistence/records";
export type { PersistedRecordShape } from "@/features/enterprise-memory-persistence/records";
export {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "@/features/enterprise-memory-persistence/in-memory";
export { createPostgresMemoryRepository } from "@/features/enterprise-memory-persistence/postgresql";
export {
  createInMemoryMemoryPersistence,
  createPostgresMemoryPersistence,
} from "@/features/enterprise-memory-persistence/composition";
export type { MemoryPersistenceComposition } from "@/features/enterprise-memory-persistence/composition";
