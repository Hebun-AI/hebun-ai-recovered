/**
 * Enterprise Memory Persistence — technology-neutral persistence contracts.
 *
 * This is the persistence boundary for admitted Enterprise Memory. It stores an
 * already-approved memory; it never decides admission, never re-evaluates truth,
 * authority, relevance, confidence, or policy. Storage outcomes are distinct from
 * admission decisions. These contracts reuse the published Memory contracts and
 * the canonical PersistenceResult; they add only what storage requires.
 *
 * Deliberate distinctions preserved here:
 *   - Approved Memory ≠ Persisted Memory (approval is a decision; persistence is a write)
 *   - Memory Identity ≠ database primary key (identity is business, keys are storage)
 *   - Superseded ≠ Deleted, Archived ≠ Deleted (records are retained, never removed)
 *   - Persistence Failure ≠ Admission Rejection (a write can fail on an approved memory)
 */

import type {
  MemoryAuthority,
  MemoryClassification,
  MemoryConfidence,
  MemoryContent,
  MemoryId,
  MemoryNamespace,
  MemoryProvenance,
  MemoryRecord,
  MemoryRelationship,
  MemorySource,
  MemoryTimestamp,
} from "@/features/enterprise-memory";
import type { PersistenceResult } from "@/features/enterprise-persistence";

/** A monotonic memory version. The first stored version is 1. */
export type MemoryVersion = number;

/** Storage-side write identity: business identity plus the written version. */
export interface MemoryWriteIdentity {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
  readonly version: MemoryVersion;
}

/** Points at a specific memory version. Not a database key. */
export interface MemoryVersionReference {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
  readonly version: MemoryVersion;
}

/** Preserves the admission decision that authorized this write. Never recomputed. */
export interface MemoryAdmissionReference {
  readonly grantReference: string;
  readonly policySetId: string;
  readonly decidedAt: MemoryTimestamp;
}

/** Records that a version was superseded by a later version. */
export interface MemorySupersessionReference {
  readonly supersededVersion: MemoryVersion;
  readonly supersededByVersion: MemoryVersion;
  readonly supersededAt: MemoryTimestamp;
}

/** Storage bookkeeping. Concurrency metadata, not business meaning. */
export interface MemoryPersistenceMetadata {
  readonly storedAt: MemoryTimestamp;
  readonly concurrencyToken: string;
  readonly isCurrent: boolean;
  readonly archivedAt?: MemoryTimestamp;
}

/**
 * The immutable persisted form of an approved memory. Composes the canonical
 * MemoryRecord (lifecycle "approved" or later) with storage-side identity,
 * version, admission reference, and metadata.
 */
export interface PersistedMemoryRecord {
  readonly writeIdentity: MemoryWriteIdentity;
  readonly record: MemoryRecord;
  readonly admissionReference: MemoryAdmissionReference;
  readonly supersededBy?: MemorySupersessionReference;
  readonly metadata: MemoryPersistenceMetadata;
}

/** The neutral payload extracted from an approved admission, ready to persist. */
export interface MemoryPersistenceRequest {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
  readonly content: MemoryContent;
  readonly classification: MemoryClassification;
  readonly provenance: MemoryProvenance;
  readonly authority: MemoryAuthority;
  readonly confidence: MemoryConfidence;
  readonly source: MemorySource;
  readonly relationships: readonly MemoryRelationship[];
  readonly admissionReference: MemoryAdmissionReference;
  readonly storedAt: MemoryTimestamp;
  readonly concurrencyToken: string;
}

/** A request to supersede a memory's current version with new content. */
export interface MemorySupersessionRequest extends MemoryPersistenceRequest {
  /** The version the caller believes is current; a mismatch is a conflict. */
  readonly expectedCurrentVersion: MemoryVersion;
}

/** The outcome of a persistence operation. Reuses the canonical result union. */
export type MemoryPersistenceResult = PersistenceResult<PersistedMemoryRecord>;
