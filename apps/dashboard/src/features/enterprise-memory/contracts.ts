/**
 * Enterprise Memory — canonical architectural contracts.
 *
 * Enterprise Memory stores durable enterprise knowledge that has been admitted
 * through explicit authority. It is NOT a Timeline, NOT an Audit log, NOT an
 * Event Store, and NOT a Database. These contracts are technology-neutral: they
 * describe the shape of admitted knowledge and its metadata only. They define no
 * persistence, retrieval, similarity search, ingestion, or reasoning.
 *
 * The five metadata dimensions are kept explicitly separate:
 *   - origin      → MemorySource
 *   - authority   → MemoryAuthority
 *   - provenance  → MemoryProvenance
 *   - confidence  → MemoryConfidence
 *   - lifecycle   → MemoryLifecycle
 * Origin is where knowledge came from; authority is who admitted it; provenance
 * is how it was derived; confidence is how strongly it is trusted; lifecycle is
 * its current standing. None of these implies or grants another.
 */

export type MemoryId = string;
export type MemoryNamespace = string;
export type MemoryTimestamp = string;

/** A durable attribute value. Intentionally scalar and technology-neutral. */
export type MemoryAttributeValue = string | number | boolean | null;

/** Identifies an actor without granting or proving authority. */
export interface MemoryActor {
  readonly type: MemoryAuthorityType;
  readonly id: string;
}

/** Stable identity of a memory record. Identity never changes across lifecycle. */
export interface MemoryIdentity {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
}

/** Where the knowledge originated. Origin is not authority and not provenance. */
export type MemorySourceKind =
  | "human-input"
  | "document"
  | "system-observation"
  | "external-source"
  | "derived";

export interface MemorySource {
  readonly kind: MemorySourceKind;
  /** Opaque, technology-neutral origin descriptor. Not a storage pointer. */
  readonly reference: string;
  readonly originatedAt: MemoryTimestamp;
}

/** How the knowledge came to exist. Distinct from origin and from authority. */
export interface MemoryProvenance {
  /** Technology-neutral descriptor of the method that produced the knowledge. */
  readonly method: string;
  /** Prior memories this knowledge was derived from, by reference only. */
  readonly derivedFrom: readonly MemoryReference[];
  readonly recordedAt: MemoryTimestamp;
}

/** The explicit authority under which the memory was admitted. */
export type MemoryAuthorityType = "director" | "human" | "delegated";

export interface MemoryAuthority {
  readonly authorityType: MemoryAuthorityType;
  readonly admittedBy: MemoryActor;
  /** Reference to the explicit grant that authorized admission. */
  readonly grantReference: string;
  readonly admittedAt: MemoryTimestamp;
}

/** Categorization and sensitivity of the knowledge. */
export type MemorySensitivity = "public" | "internal" | "confidential" | "restricted";

export interface MemoryClassification {
  readonly category: string;
  readonly sensitivity: MemorySensitivity;
  readonly tags: readonly string[];
}

/** How strongly the knowledge is trusted. Confidence is not authority. */
export type MemoryConfidenceLevel = "low" | "medium" | "high" | "verified";

export interface MemoryConfidence {
  readonly level: MemoryConfidenceLevel;
  /** Normalized 0..1 confidence. Technology-neutral; no model is implied. */
  readonly score?: number;
  readonly rationale?: string;
}

/** Current standing of the memory within its lifecycle. */
export type MemoryLifecycleState = "candidate" | "approved" | "rejected" | "archived";

export interface MemoryLifecycle {
  readonly state: MemoryLifecycleState;
  readonly enteredAt: MemoryTimestamp;
}

/** A reference to another memory, by identity only. Carries no content. */
export interface MemoryReference {
  readonly memoryId: MemoryId;
  readonly namespace: MemoryNamespace;
}

/** A typed relationship from one memory to another. */
export type MemoryRelationshipType =
  | "supports"
  | "contradicts"
  | "supersedes"
  | "derived-from"
  | "related-to";

export interface MemoryRelationship {
  readonly type: MemoryRelationshipType;
  readonly target: MemoryReference;
}

/** The durable knowledge itself. A neutral shape carrying no derived representations. */
export interface MemoryContent {
  readonly statement: string;
  readonly attributes: Readonly<Record<string, MemoryAttributeValue>>;
}

/**
 * A canonical admitted enterprise memory. Composes the durable content with the
 * five separated metadata dimensions and its relationships. Every field is
 * immutable; a record is never mutated in place — a new record supersedes it.
 */
export interface MemoryRecord {
  readonly identity: MemoryIdentity;
  readonly content: MemoryContent;
  readonly source: MemorySource;
  readonly authority: MemoryAuthority;
  readonly provenance: MemoryProvenance;
  readonly confidence: MemoryConfidence;
  readonly classification: MemoryClassification;
  readonly lifecycle: MemoryLifecycle;
  readonly relationships: readonly MemoryRelationship[];
}
