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
  /** Question-driven selection of knowledge as evidence for Heby (KR3). */
  | "retrieval"
  /** Typo and near-miss tolerance in that retrieval. */
  | "fuzzy-matching"
  /** Semantic / embedding-based retrieval. */
  | "semantic-retrieval"
  /** Getting knowledge INTO Hebun in the first place. */
  | "ingestion"
  /** An embedding provider or vector store. */
  | "embeddings";

/**
 * The honest state of one capability.
 *
 *   connected      a real runtime path exists over the canonical Knowledge authority. Originally
 *                  that meant a READ path, because reads were all K1 had; a governed WRITE path
 *                  counts for the same reason, and Knowledge ingestion is the first one to.
 *   not-connected  the concept is defined, but no runtime path exists for it.
 *
 * `connected` says a path EXISTS. It says nothing about how wide, how mature, or how much the
 * capability covers — that is what `canProve` and `cannotProve` are for, and why a capability may
 * be connected through a deliberately narrow slice without the map overstating it.
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
      "That any knowledge exists at all — the read reports the tenant's real state, and an empty listing means the organization holds nothing, never that the read failed.",
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
    /*
     * KR3 falsified the previous wording, which claimed no ranking model or relevance authority
     * existed anywhere. One does now. What is still absent is the SEARCH PRODUCT, and that is what
     * this entry must say — a capability that reports a reason which has stopped being true is worse
     * than one that reports nothing, because the reason is what a reader trusts.
     */
    authority:
      "None. Knowledge retrieval exists (see `retrieval`), but no search PRODUCT does: there is no search surface, no result presentation, and no citation experience. Enabling one is a separate, explicitly authorized product phase.",
    canProve: "Nothing — no search runtime exists for a person to search with.",
    cannotProve:
      "That Hebun offers a place to go searching. Retrieval selects evidence for a question Heby is already answering; it is not a browse or discovery surface, and it returns no user-facing result list, ranking explanation, or citation.",
  }),
  /*
   * KR3. Distinct from `search`, and the distinction is the product boundary, not a hedge: this
   * selects evidence for a question Heby is already answering. It is not an enterprise search
   * capability, it has no user-facing search surface, and `/search` stays unavailable.
   */
  Object.freeze({
    capability: "retrieval" as const,
    label: "Question-driven Knowledge retrieval",
    state: "connected" as const,
    authority:
      "Derived computation over the canonical Knowledge authority — the same tenant-scoped knowledge_facts → active knowledge_nodes join, ranked by a PostgreSQL full-text match against the question. It owns no table, writes nothing, and persists nothing.",
    canProve:
      "Which of your organization's knowledge records bear on a specific question, ordered by how well their text matches it, with records that are archived, retired, expired or not yet effective excluded and reported rather than silently served.",
    cannotProve:
      "That a highly ranked record is true, approved, or current — ordering is a TEXT-MATCH score and nothing else, and each record still states its own authority, lifecycle, ratification and freshness. That a record exists for every question: retrieval finding nothing means nothing matched, never that your organization holds no knowledge.",
  }),
  /*
   * MEASURED, AND HONESTLY ABSENT. The benchmark's best representation used pg_trgm for typo
   * tolerance and measured it worth +10.9pp Recall@1, concentrated almost entirely in misspelled
   * queries. The extension is not installed in this database, so no trigram similarity is computed
   * at all — the runtime does not simulate it, and this entry is why the difference is visible
   * rather than hidden behind a score that looks the same either way.
   */
  Object.freeze({
    capability: "fuzzy-matching" as const,
    label: "Typo and near-miss tolerance",
    state: "not-connected" as const,
    authority:
      "None. The `pg_trgm` extension is not installed in the control-plane database, so no trigram similarity is available to compute.",
    canProve: "Nothing — no fuzzy matching runtime exists.",
    cannotProve:
      "That a misspelled or partially remembered word will find its record. Matching is lexical: a typo that changes a word's stem finds nothing, and the result says so rather than implying the knowledge is absent.",
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
  /*
   * CONNECTED THROUGH ONE DELIBERATELY NARROW SLICE, WIDENED ONCE.
   *
   * K2's ingestion connected this: a human with the Knowledge write band pastes plain text and it
   * becomes canonical facts through the SAME writer that authors a single fact.
   *
   * R4C.1 added ONE way for that text to arrive — a manually selected `.txt` or `.md` file, bounded
   * and decoded server-side. That falsified this entry's previous `cannotProve`, which said "there
   * is no upload path at all, only pasted plain text". The sentence was repaired rather than
   * softened: a capability map whose stated reason has quietly stopped being true is worse than one
   * that reports nothing, because the reason is what a reader trusts.
   *
   * Everything the slice still does NOT do is named below rather than left to be assumed. The
   * `documents` table remains unused, no byte of any file is retained, and no format that needs a
   * parser can be read at all.
   */
  Object.freeze({
    capability: "ingestion" as const,
    label: "Knowledge ingestion",
    state: "connected" as const,
    authority:
      "The canonical Knowledge writer, reached through the governed ingestion path in the Knowledge workspace — the same durable write authority band that authors a single fact, writing the same knowledge_facts and knowledge_nodes rows inside one transaction with its audit history. A selected file reaches that same path through one upload boundary that decodes it and writes nothing itself.",
    canProve:
      "That text a permitted human supplied — pasted, or read from a UTF-8 .txt or .md file they selected — is now held as canonical knowledge records, split deterministically, attributed to its source title, its source type and the person who ingested it, and standing as PROVISIONAL drafts.",
    cannotProve:
      "That anything ingested was reviewed, approved or ratified — ingesting is not ratifying. That any PDF, DOCX, HTML, CSV, spreadsheet, image or archive can be read: only UTF-8 .txt and .md files are accepted, there is no parser and no OCR of any kind, and a file in another encoding is refused rather than converted. That any uploaded file was KEPT: the bytes end with the request, nothing is written to storage or to a filesystem, no object store exists, and the `documents` table still has no consumer. That any URL, connector, scheduled import or automated sync exists — every ingestion is one deliberate human act. That ingested knowledge is findable by meaning, which needs the search, semantic-retrieval and embedding capabilities this map still reports as not connected.",
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
