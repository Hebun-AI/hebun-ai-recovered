/*
 * knowledge/capability-map.ts — the honest, per-capability map of what Hebun's Knowledge
 * subsystem can and cannot do (Knowledge Source Expansion K1).
 *
 * WHY THIS FILE EXISTS. "Knowledge connected" is too broad a phrase to be true. Hebun's
 * Knowledge capabilities are in genuinely different states, and collapsing them into one
 * boolean would be a lie in both directions. This file states each one separately, names the
 * subsystem that owns it, and — for every capability that is NOT connected — names the exact
 * thing that is missing. It follows the shape the Security Center source map already
 * established (features/security-center/source-map.ts), because the honesty problem is the
 * same one.
 *
 * WHAT WAS AUDITED (K1 discovery, against the shipped code — not inferred from filenames):
 *
 *   knowledge_facts / knowledge_nodes / knowledge_edges  exist as canonical tables in the
 *     control-plane database and are migrated. K1 adds the FIRST application read path over
 *     them. They hold no rows, because nothing writes to them.
 *   documents  exists as a table with ZERO consumers anywhere in the repository: no upload,
 *     no parser, no storage binding, no reader. It is a schema, not a corpus.
 *   canonical-read (features/canonical-read)  is a real Postgres query layer, but it is an
 *     OPTIONAL diagnostics/shadow layer on its own isolated connection string, it reads only
 *     BY EXPLICIT IDENTITY (tenant + factKey + domainKey + scope), and it cannot enumerate.
 *   knowledge-crud / knowledge-graph  are in-memory stores SEEDED from a mock registry, with
 *     a `confidence` figure derived from mock health. They are never organizational truth.
 *   Architecture Intelligence, Architecture Ingestion, and the Knowledge Processing Pipeline
 *     are DOCUMENTATION ONLY (docs/architecture/**). They have zero code bindings.
 *
 * Pure. No React, no I/O, no server, no authority.
 */

/** The Knowledge capabilities that must be reported separately, never collapsed. */
export type KnowledgeCapabilityId =
  /** Listing the knowledge a tenant actually holds. */
  | "source-listing"
  /** Reading one named knowledge source. */
  | "source-read"
  /** Lexical/keyword search across knowledge. */
  | "search"
  /** Semantic / embedding-based retrieval. */
  | "semantic-retrieval"
  /** Getting knowledge INTO Hebun in the first place. */
  | "ingestion"
  /** An embedding provider or vector store. */
  | "embeddings";

/**
 * The honest state of one capability.
 *
 *   connected      a real read path exists over the canonical Knowledge authority.
 *   not-connected  the concept is defined, but no runtime path exists for it.
 */
export type KnowledgeCapabilityState = "connected" | "not-connected";

export interface KnowledgeCapabilityStatus {
  readonly capability: KnowledgeCapabilityId;
  readonly label: string;
  readonly state: KnowledgeCapabilityState;
  /** The subsystem that owns this capability — or the reason none does. */
  readonly authority: string;
  /** What this capability can actually establish today. */
  readonly canProve: string;
  /** What it cannot, stated so it cannot be quietly assumed. */
  readonly cannotProve: string;
}

const CAPABILITIES: readonly KnowledgeCapabilityStatus[] = Object.freeze([
  Object.freeze({
    capability: "source-listing" as const,
    label: "Knowledge source listing",
    state: "connected" as const,
    authority:
      "Canonical Knowledge authority — knowledge_facts joined to its active knowledge_nodes row, read tenant-scoped over the R1 control-plane database.",
    canProve:
      "Which knowledge facts exist FOR YOUR ORGANIZATION, with their domain, scope, lifecycle, authority class and declared review dates.",
    cannotProve:
      "That any knowledge exists at all — the read reports the tenant's real state, and today that state is empty because nothing writes knowledge.",
  }),
  Object.freeze({
    capability: "source-read" as const,
    label: "Named source read",
    state: "connected" as const,
    authority:
      "The same canonical authority, resolved by fact key within the authorized tenant.",
    canProve:
      "The content, governance metadata and declared freshness of one named fact the tenant owns.",
    cannotProve:
      "Anything about a fact belonging to another tenant, or about a file, path, or URL — the only addressable thing is a canonical fact key.",
  }),
  Object.freeze({
    capability: "search" as const,
    label: "Knowledge search",
    state: "not-connected" as const,
    authority:
      "None. No search authority exists: there is no index, no ranking model, and no relevance authority anywhere in the repository.",
    canProve: "Nothing — no search runtime exists.",
    cannotProve:
      "Relevance, ranking, or a best match. A substring scan over an empty table is not search, and Hebun will not present one as if it were.",
  }),
  Object.freeze({
    capability: "semantic-retrieval" as const,
    label: "Semantic retrieval",
    state: "not-connected" as const,
    authority:
      "None. No vector store, no similarity index, and no retrieval service exists.",
    canProve: "Nothing — no semantic retrieval runtime exists.",
    cannotProve: "Similarity, nearest-neighbour matches, or semantic recall of any kind.",
  }),
  Object.freeze({
    capability: "ingestion" as const,
    label: "Knowledge ingestion",
    state: "not-connected" as const,
    authority:
      "None. The `documents` table exists but has no consumer anywhere: no upload, no parser, no normalizer, no chunker, no storage binding, and no writer to knowledge_facts or knowledge_nodes.",
    canProve: "Nothing — no knowledge can enter Hebun through any path today.",
    cannotProve:
      "That the organization's documents, policies, or procedures are known to Hebun. None of them has been ingested, because there is nothing to ingest them with.",
  }),
  Object.freeze({
    capability: "embeddings" as const,
    label: "Embeddings",
    state: "not-connected" as const,
    authority: "None. No embedding provider is configured and no embedding is stored.",
    canProve: "Nothing — no embedding exists.",
    cannotProve: "Any semantic distance, cluster, or vector-derived claim.",
  }),
]);

/** The full capability map, in reporting order. */
export function listKnowledgeCapabilities(): readonly KnowledgeCapabilityStatus[] {
  return CAPABILITIES;
}

export function findKnowledgeCapability(
  capability: KnowledgeCapabilityId,
): KnowledgeCapabilityStatus {
  const found = CAPABILITIES.find((entry) => entry.capability === capability);
  // Total over the union: every id is present, so this cannot be reached at runtime.
  if (!found) throw new Error(`Unknown knowledge capability: ${capability}`);
  return found;
}

/**
 * Whether ANY Knowledge capability is connected. Deliberately not exposed as "knowledge is
 * connected" — callers must still report each capability separately.
 */
export function hasConnectedKnowledgeCapability(): boolean {
  return CAPABILITIES.some((entry) => entry.state === "connected");
}
