/*
 * knowledge/workspace-model.ts — the read model for the Knowledge & Memory
 * Workspace (Hebun UI Phase 9).
 *
 * PROVENANCE CONTRACT (no-fake-data):
 *
 *   The canonical, authoritative substrate for what the organization KNOWS is the
 *   Enterprise Memory contract (features/enterprise-memory/contracts.ts): durable
 *   knowledge admitted under explicit authority, described by five deliberately
 *   separated metadata dimensions — origin, authority, provenance, confidence,
 *   lifecycle — plus classification/sensitivity and typed relationships. Those
 *   contracts are REAL and canonical, but they are types only: no MemoryRecord is
 *   persisted, admitted, or surfaced through a real read model, and no populated
 *   knowledge source, document, graph, or history exists.
 *
 *   This model therefore surfaces ONLY the REAL Enterprise Memory vocabulary (the
 *   canonical union members, bound to their contract types with `satisfies` so a
 *   contract change breaks the build) plus short human-authored copy that names
 *   each real term. It fabricates no source, document, count, trust score,
 *   coverage percentage, relationship, provenance, evidence reference, timestamp,
 *   or change. Every place populated knowledge would appear, the workspace renders
 *   an honest empty state.
 *
 *   The synthetic sources (features/knowledge-domain/mock.ts, the seeded
 *   knowledge-graph builder, and the memory-runtime projection registry) are
 *   deliberately NOT imported here.
 */

import type {
  MemoryAuthorityType,
  MemoryConfidenceLevel,
  MemoryLifecycleState,
  MemoryRelationshipType,
  MemorySensitivity,
  MemorySourceKind,
} from "@/features/enterprise-memory";
import { getHebyWorkspaceProfile } from "@/features/heby-integration";

/** One origin kind Enterprise Memory recognizes, joined to explanatory copy. */
export interface SourceKindView {
  readonly kind: MemorySourceKind;
  readonly label: string;
  readonly describes: string;
  /** Honest count — no source is connected, so always 0. */
  readonly connected: 0;
}

/*
 * The canonical MemorySourceKind union, enumerated and bound to the contract type.
 * If the contract's union changes, `satisfies` fails the build — keeping this list
 * REAL rather than a hand-drifted copy. Order is presentational only.
 */
const SOURCE_KINDS = [
  { kind: "human-input", label: "Human Input", describes: "Knowledge a person stated directly." },
  { kind: "document", label: "Document", describes: "Knowledge drawn from a document." },
  { kind: "system-observation", label: "System Observation", describes: "Knowledge the system observed from its own operation." },
  { kind: "external-source", label: "External Source", describes: "Knowledge from a source outside the organization." },
  { kind: "derived", label: "Derived", describes: "Knowledge derived from other admitted knowledge." },
] as const satisfies readonly { kind: MemorySourceKind; label: string; describes: string }[];

/** The five separated metadata dimensions of an admitted memory. */
export interface MetadataDimensionView {
  readonly dimension: "origin" | "authority" | "provenance" | "confidence" | "lifecycle";
  readonly label: string;
  readonly question: string;
  readonly describes: string;
}

/*
 * The five dimensions the contract keeps explicitly separate, with the canonical
 * rule that none implies or grants another.
 */
const METADATA_DIMENSIONS: readonly MetadataDimensionView[] = [
  { dimension: "origin", label: "Origin", question: "Where did it come from?", describes: "The source the knowledge originated from." },
  { dimension: "authority", label: "Authority", question: "Who admitted it?", describes: "The explicit authority under which it was admitted." },
  { dimension: "provenance", label: "Provenance", question: "How was it derived?", describes: "The method that produced it and what it was derived from." },
  { dimension: "confidence", label: "Confidence", question: "How strongly is it trusted?", describes: "A declared trust level — not authority, not truth." },
  { dimension: "lifecycle", label: "Lifecycle", question: "What is its current standing?", describes: "Where it stands from candidate to archived." },
];

export interface LifecycleStateView {
  readonly state: MemoryLifecycleState;
  readonly label: string;
  readonly describes: string;
}

const LIFECYCLE_STATES = [
  { state: "candidate", label: "Candidate", describes: "Proposed for admission; not yet admitted." },
  { state: "approved", label: "Approved", describes: "Admitted under explicit authority." },
  { state: "rejected", label: "Rejected", describes: "Considered and denied admission." },
  { state: "archived", label: "Archived", describes: "Previously admitted; retired from active standing." },
] as const satisfies readonly { state: MemoryLifecycleState; label: string; describes: string }[];

export interface ConfidenceLevelView {
  readonly level: MemoryConfidenceLevel;
  readonly label: string;
}

const CONFIDENCE_LEVELS = [
  { level: "low", label: "Low" },
  { level: "medium", label: "Medium" },
  { level: "high", label: "High" },
  { level: "verified", label: "Verified" },
] as const satisfies readonly { level: MemoryConfidenceLevel; label: string }[];

export interface SensitivityView {
  readonly sensitivity: MemorySensitivity;
  readonly label: string;
  readonly describes: string;
  /** Whether content at this level is withheld from display where required. */
  readonly withheldWhereRequired: boolean;
}

const SENSITIVITY_LEVELS = [
  { sensitivity: "public", label: "Public", describes: "Shareable outside the organization.", withheldWhereRequired: false },
  { sensitivity: "internal", label: "Internal", describes: "For inside the organization.", withheldWhereRequired: false },
  { sensitivity: "confidential", label: "Confidential", describes: "Limited to authorized readers.", withheldWhereRequired: true },
  { sensitivity: "restricted", label: "Restricted", describes: "Withheld unless explicitly authorized — not shown and tagged.", withheldWhereRequired: true },
] as const satisfies readonly { sensitivity: MemorySensitivity; label: string; describes: string; withheldWhereRequired: boolean }[];

export interface RelationshipTypeView {
  readonly type: MemoryRelationshipType;
  readonly label: string;
  readonly describes: string;
}

const RELATIONSHIP_TYPES = [
  { type: "supports", label: "Supports", describes: "One memory backs another." },
  { type: "contradicts", label: "Contradicts", describes: "One memory conflicts with another." },
  { type: "supersedes", label: "Supersedes", describes: "One memory replaces another." },
  { type: "derived-from", label: "Derived from", describes: "One memory was derived from another." },
  { type: "related-to", label: "Related to", describes: "A general association between memories." },
] as const satisfies readonly { type: MemoryRelationshipType; label: string; describes: string }[];

export interface AuthorityTypeView {
  readonly authority: MemoryAuthorityType;
  readonly label: string;
}

const AUTHORITY_TYPES = [
  { authority: "director", label: "Director" },
  { authority: "human", label: "Human" },
  { authority: "delegated", label: "Delegated" },
] as const satisfies readonly { authority: MemoryAuthorityType; label: string }[];

/*
 * Availability map — the Overview's honest answer to "what organizational
 * knowledge is available, where does it come from, and how trustworthy/available
 * is it?" Every value is a structural fact or an explicit unavailable/derived
 * state. No count, freshness, connected source, or aggregate Knowledge score is
 * fabricated.
 */
export type KnowledgeAvailabilityState =
  /** A real governed authority exists and is connected. */
  | "authority-connected"
  /** A real authority exists, but reading it requires an authorized org context. */
  | "requires-authorized-context"
  /** Defined in the architecture, but no data path is connected. */
  | "not-connected"
  /** Real, but a derived, non-authoritative projection — not settled truth. */
  | "derived-nonauthoritative"
  /** Reference/master data whose authority lives in the owning system. */
  | "reference-data"
  /** A structural contract exists, but no runtime is connected. */
  | "contract-only";

export interface KnowledgeAvailabilityView {
  readonly area: string;
  readonly question: string;
  readonly state: KnowledgeAvailabilityState;
  readonly detail: string;
  /** A drill-through to the surface that owns this area, when one exists. */
  readonly href?: string;
}

/** Derive the honest Heby-retrieval availability from the REAL Heby Knowledge profile. */
function hebyRetrievalAvailability(): KnowledgeAvailabilityState {
  const profile = getHebyWorkspaceProfile("knowledge");
  const everyContractOnly = profile.capabilities.every(
    (capability) => capability.state === "contract-only",
  );
  return everyContractOnly ? "contract-only" : "not-connected";
}

export interface KnowledgeWorkspaceModel {
  /** Real origin taxonomy — zero sources connected. */
  readonly sourceKinds: readonly SourceKindView[];
  /** The five separated metadata dimensions of an admitted memory. */
  readonly metadataDimensions: readonly MetadataDimensionView[];
  /** Real admission lifecycle states. */
  readonly lifecycleStates: readonly LifecycleStateView[];
  /** Real declared confidence levels — not scores, not authority. */
  readonly confidenceLevels: readonly ConfidenceLevelView[];
  /** Real sensitivity classification, with withholding semantics. */
  readonly sensitivityLevels: readonly SensitivityView[];
  /** Real typed relationships between memories. */
  readonly relationshipTypes: readonly RelationshipTypeView[];
  /** Real authority types under which knowledge is admitted. */
  readonly authorityTypes: readonly AuthorityTypeView[];
  /** Honest availability of each Knowledge area — the Overview's orientation map. */
  readonly availability: readonly KnowledgeAvailabilityView[];
  /**
   * Populated admitted memories. Always empty: no MemoryRecord is surfaced, and
   * none is fabricated.
   */
  readonly memories: readonly never[];
}

/**
 * Build the Knowledge Workspace model from REAL Enterprise Memory vocabulary only.
 * Pure and synchronous; fabricates nothing.
 */
export function getKnowledgeWorkspaceModel(): KnowledgeWorkspaceModel {
  return {
    sourceKinds: SOURCE_KINDS.map((source) => ({ ...source, connected: 0 })),
    metadataDimensions: METADATA_DIMENSIONS,
    lifecycleStates: LIFECYCLE_STATES.map((entry) => ({ ...entry })),
    confidenceLevels: CONFIDENCE_LEVELS.map((entry) => ({ ...entry })),
    sensitivityLevels: SENSITIVITY_LEVELS.map((entry) => ({ ...entry })),
    relationshipTypes: RELATIONSHIP_TYPES.map((entry) => ({ ...entry })),
    authorityTypes: AUTHORITY_TYPES.map((entry) => ({ ...entry })),
    availability: [
      {
        area: "Company Memory",
        question: "What durable memory has been admitted?",
        state: "requires-authorized-context",
        detail:
          "The Enterprise Memory authority is connected. Reading admitted memory requires an authorized organization context.",
        href: "/director/memory",
      },
      {
        area: "Sources",
        question: "Where does knowledge come from?",
        state: "not-connected",
        detail:
          "The origin taxonomy is defined, but no knowledge source is connected. Zero sources are connected.",
      },
      {
        area: "Provenance & evidence",
        question: "How is it evidenced?",
        state: "not-connected",
        detail:
          "Evidence is minted only at retrieval. No retrieval path is connected, so no evidence reference is available.",
      },
      {
        area: "Knowledge Graph",
        question: "How is knowledge related?",
        state: "not-connected",
        detail:
          "Reads the canonical knowledge layer, which is not connected here. The legacy derived graph is no longer presented as truth.",
        href: "/director/knowledge-graph",
      },
      {
        area: "Registries",
        question: "What reference data exists?",
        state: "reference-data",
        detail:
          "Master-data registries are reference views. Their authority lives in the systems that own them.",
        href: "/director/registries",
      },
      {
        area: "Heby retrieval",
        question: "Can Heby retrieve knowledge?",
        state: hebyRetrievalAvailability(),
        detail:
          "Heby knowledge retrieval and evidence tracing are contract-only; no retrieval path is connected. Heby is advisory — it never admits or mutates memory.",
      },
    ],
    memories: [],
  };
}
