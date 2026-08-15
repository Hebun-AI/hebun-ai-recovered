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
 *
 * SCOPE NOTE — the vocabulary is Enterprise Memory's; the availability map is not.
 *
 *   Everything above describes the VOCABULARY this model surfaces, which remains
 *   Enterprise Memory's and remains types-only: `memories` is still empty and every
 *   origin kind still reports 0 connected, because no Enterprise Memory ORIGIN
 *   CONNECTOR exists.
 *
 *   The `availability` map is a different question — it reports what the Knowledge
 *   areas of this workspace can actually do — and since K1/K2 it must answer for the
 *   CANONICAL Knowledge authority (knowledge_facts / knowledge_nodes), which is
 *   connected, written by governed authoring and plain-text ingestion, and read into
 *   Heby's evidence. Three of its entries went on describing the pre-K1 world; they
 *   are corrected below. Conflating the two is exactly the mistake that let this
 *   page tell an operator nothing could get in, beside the control that puts things in.
 */

import type {
  MemoryAuthorityType,
  MemoryConfidenceLevel,
  MemoryLifecycleState,
  MemoryRelationshipType,
  MemorySensitivity,
  MemorySourceKind,
} from "@/features/enterprise-memory";

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

/**
 * The listing bound Heby's Knowledge evidence path is subject to, stated in the copy below.
 *
 * Deliberately a LITERAL rather than an import: the constant lives in
 * `durable-knowledge-repository.server.ts`, and pulling a `.server` module into this pure model
 * would drag the database client toward the client bundle. `tests/knowledge-overview/overview.ts`
 * asserts this number still equals `KNOWLEDGE_LISTING_LIMIT`, so it cannot drift silently.
 */
const HEBY_EVIDENCE_LISTING_CAP = 50;

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
      /*
       * TWO DIFFERENT THINGS SHARE THE WORD "SOURCE", and this entry must not blur them.
       *
       * Knowledge INTAKE — how a statement enters the canonical Knowledge authority — is
       * connected: a permitted human authors one fact, or pastes plain text that becomes many.
       * Enterprise Memory's ORIGIN KINDS (document, system-observation, external-source, derived)
       * are the connector taxonomy, and none of those is connected — which is why the Sources
       * region below still reports 0 for every kind. Both statements are true; naming only the
       * second is what made this entry read as "nothing can get in", on the same page as the
       * control that puts things in.
       */
      {
        area: "Sources",
        question: "Where does knowledge come from?",
        state: "requires-authorized-context",
        detail:
          "Knowledge enters through the governed intake on this page: a permitted human authors one fact, or ingests plain text that becomes many. Both write the canonical Knowledge authority and require an authorized organization context. No file upload, URL, connector or stored-document source exists — the origin taxonomy below stays at zero connected.",
      },
      {
        area: "Provenance & evidence",
        question: "How is it evidenced?",
        state: "requires-authorized-context",
        detail:
          "Every record carries its own provenance and source attribution, and that standing — authority class, lifecycle, whether a ratification is recorded, freshness — travels with it into Heby's evidence. Reading it requires an authorized organization context. It is not rendered as a citation surface here, and no relevance or scoring engine mints it.",
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
      /*
       * RENAMED FROM "Heby retrieval", because what is connected is not retrieval.
       *
       * The old entry derived its state from the Heby workspace CAPABILITY profile — a different
       * authority — and so kept reporting contract-only after K1 wired the real evidence path.
       * The honest statement has two halves and needs both: the path is connected AND what it
       * does is listing, not relevance. Calling it "retrieval" would overstate it; calling it
       * contract-only understated it, which is what it did.
       */
      {
        area: "Heby Knowledge evidence",
        question: "How does Heby use organizational knowledge?",
        state: "requires-authorized-context",
        detail:
          `Connected. Heby reads the tenant's canonical Knowledge through the same seam this page uses, and each record reaches the model as data carrying its own standing. Selection is a listing, not a search: records are ordered by domain and key and capped at ${HEBY_EVIDENCE_LISTING_CAP}, so beyond that cap a record is simply not seen. Nothing ranks by relevance — no index, no scoring, no semantic or vector retrieval exists. Heby is advisory: it never admits, ratifies or mutates knowledge.`,
      },
    ],
    memories: [],
  };
}
