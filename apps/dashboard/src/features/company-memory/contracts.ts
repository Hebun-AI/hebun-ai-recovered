/*
 * company-memory/contracts.ts — the read-only presentation contract for the
 * Company Memory surface (Hebun UI Phase 21B).
 *
 * Company Memory is the Knowledge product view onto the REAL Enterprise Memory
 * authority (features/enterprise-memory* — admission, persistence, query,
 * retrieval). It is READ-ONLY: it never admits, mutates, or persists, and it
 * never fabricates a memory, count, evidence reference, provenance, or score.
 *
 * These view types carry ONLY fields that exist on a real PersistedMemoryRecord.
 * The five Enterprise Memory metadata dimensions are kept explicitly separate —
 * origin, authority, provenance, confidence, lifecycle — plus classification and
 * relationships. None implies another (high confidence ≠ high authority, approved
 * lifecycle ≠ authoritative source, restricted sensitivity ≠ low confidence).
 */

import type {
  MemoryAuthorityType,
  MemoryConfidenceLevel,
  MemoryLifecycleState,
  MemoryRelationshipType,
  MemorySensitivity,
  MemorySourceKind,
} from "@/features/enterprise-memory";

/**
 * The connection state of the Enterprise Memory read path. Every state is honest:
 * there is no state that presents fabricated or seeded memory as truth.
 */
export type CompanyMemoryConnection =
  /** No authorized organization context could be resolved — reads fail closed. */
  | "authority-unavailable"
  /** The real authority was read under an authorized context; zero records admitted. */
  | "connected-empty"
  /** The real authority returned admitted records. */
  | "connected-populated"
  /** The read path itself failed (validation or persistence failure). */
  | "read-failed";

/** One real memory reference (identity only — carries no content). */
export interface CompanyMemoryReferenceView {
  readonly memoryId: string;
  readonly namespace: string;
}

/** A real typed relationship from this memory to another. */
export interface CompanyMemoryRelationshipView {
  readonly type: MemoryRelationshipType;
  readonly target: CompanyMemoryReferenceView;
}

/**
 * The read-only view of one admitted memory. Every field maps 1:1 to a real
 * PersistedMemoryRecord field — nothing is invented for presentation.
 */
export interface CompanyMemoryRecordView {
  readonly memoryId: string;
  readonly namespace: string;
  readonly version: number;
  readonly isCurrent: boolean;

  /** Durable content. Withheld (never shown) when sensitivity requires it. */
  readonly statement: string | null;
  readonly contentWithheld: boolean;
  readonly attributes: ReadonlyArray<{ readonly key: string; readonly value: string }>;

  /** Origin — where the knowledge came from. Not authority, not provenance. */
  readonly origin: {
    readonly kind: MemorySourceKind;
    readonly reference: string;
    readonly originatedAt: string;
  };
  /** Authority — who admitted it. */
  readonly authority: {
    readonly authorityType: MemoryAuthorityType;
    readonly admittedByType: MemoryAuthorityType;
    readonly admittedById: string;
    readonly grantReference: string;
    readonly admittedAt: string;
  };
  /** Provenance — how it was derived. Distinct from origin and authority. */
  readonly provenance: {
    readonly method: string;
    readonly derivedFrom: readonly CompanyMemoryReferenceView[];
    readonly recordedAt: string;
  };
  /** Confidence — how strongly trusted. Not authority, not truth. */
  readonly confidence: {
    readonly level: MemoryConfidenceLevel;
    readonly score: number | null;
    readonly rationale: string | null;
  };
  /** Classification — category and sensitivity. */
  readonly classification: {
    readonly category: string;
    readonly sensitivity: MemorySensitivity;
    readonly tags: readonly string[];
  };
  /** Lifecycle — current standing. */
  readonly lifecycle: {
    readonly state: MemoryLifecycleState;
    readonly enteredAt: string;
  };
  /** Real typed relationships to other admitted memories. */
  readonly relationships: readonly CompanyMemoryRelationshipView[];
  /** Storage-side supersession bookkeeping, when the version was superseded. */
  readonly supersededBy: {
    readonly supersededByVersion: number;
    readonly supersededAt: string;
  } | null;
  readonly storedAt: string;
}

/** The read model handed to the Company Memory presentation surface. */
export interface CompanyMemoryReadModel {
  readonly connection: CompanyMemoryConnection;
  /** A machine reason for a non-connected/failed state. Never user-fabricated data. */
  readonly reason?: string;
  readonly records: readonly CompanyMemoryRecordView[];
}
