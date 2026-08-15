/*
 * knowledge-retrieval/contracts.ts — the retrieval vocabulary (KR3).
 *
 * ── WHAT RETRIEVAL IS ────────────────────────────────────────────────────────
 *
 * Derived computation over the canonical Knowledge authority, and nothing else. It owns candidate
 * selection, eligibility, relevance, diversity and its own explanation. It does NOT own Knowledge
 * truth, ratification, lifecycle, authority, writes, Governance decisions, or memory promotion. No
 * retrieval output is ever written back into `knowledge_facts` / `knowledge_nodes`, and no relevance
 * figure is persisted into an authoritative table — a match score has no business outliving the
 * request that produced it.
 *
 * ── A MATCH SCORE IS NOT A TRUTH SCORE ───────────────────────────────────────
 *
 * `RetrievalScore` says how well a record's TEXT matched the question's TEXT. It says nothing about
 * whether the record is true, current, approved, or safe to act on. That is why there is deliberately
 * no `confidence`, no `truthScore`, and no `knowledgeQualityScore` here: Hebun computes none of them,
 * and a single blended number is exactly how "the top result" quietly becomes "the answer".
 *
 * Standing travels SEPARATELY and unflattened, on the candidate's own record — authority class,
 * lifecycle, ratification, freshness — precisely as K1 already carries it.
 *
 * ── ELIGIBILITY IS A GATE, NOT A WEIGHT ──────────────────────────────────────
 *
 * A record that is archived, retired, expired, not yet effective, deleted, or not the active version
 * of its fact is not a low-ranking candidate. It is not a candidate. Making it a ranking penalty
 * would let a strong lexical match drag a withdrawn policy into an answer, which is the failure mode
 * KR2 measured: 6 of 46 benchmark questions served an out-of-force record inside the top five.
 *
 * Pure types and pure constants. No React, no I/O, no server, no authority.
 */

import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";

/** The most candidates one retrieval may return. A bound, not a filter — truncation is reported. */
export const RETRIEVAL_DEFAULT_LIMIT = 8;
export const RETRIEVAL_MAX_LIMIT = 20;

/**
 * How many candidates the SQL layer fetches before eligibility, ranking and diversity run.
 *
 * Larger than the result limit on purpose: eligibility and the diversity cap both REMOVE rows, so
 * fetching exactly `limit` would let one 40-chunk ingested source or a handful of expired records
 * silently starve the result. Bounded so a broad query can never scan unboundedly.
 */
export const RETRIEVAL_CANDIDATE_POOL = 60;

/**
 * The most chunks one ingested source may contribute to a final result.
 *
 * KR2 measured a single 40-chunk source taking 3 of 5 slots on a purchasing question. Two leaves
 * room for a source to make its point twice without owning the answer. Pruning is REPORTED, never
 * silent — and it never merges or discards a source, so two sources that disagree both survive.
 */
export const RETRIEVAL_MAX_PER_SOURCE = 2;

/**
 * The measured first-generation blend from the KR2 benchmark.
 *
 * These are frozen constants, not tuning knobs. They were measured once, on one synthetic Turkish
 * corpus, and they stay fixed until another measurement replaces them. `TRIGRAM` is declared here
 * and deliberately unused by the shipped runtime: `pg_trgm` is not installed in the canonical
 * database, so the trigram component is NOT COMPUTED. See `RetrievalCapability`.
 */
export const RETRIEVAL_WEIGHTS = Object.freeze({ LEXICAL: 0.6, TRIGRAM: 0.4 });

/* ── request ──────────────────────────────────────────────────────────────── */

/**
 * What a caller may ask for.
 *
 * NOTE WHAT IS ABSENT: no tenant, no organization, no membership, no role, no authority, no
 * ratification policy, no lifecycle policy, no truth threshold. The tenant is resolved server-side
 * from the session and is never accepted from a client; the policies belong to this module and to
 * the Knowledge authority, not to whoever is asking.
 */
export interface RetrievalRequest {
  /** The human's question, verbatim. Never translated, never rewritten, never sent to a model. */
  readonly queryText: string;
  /** Optional NARROWING hint. It can only shrink the candidate set — it never widens or grants. */
  readonly domainKey?: string;
  /** Optional NARROWING hint, same rule. */
  readonly scope?: KnowledgeSourceRecord["scope"];
  /** Clamped server-side to `RETRIEVAL_MAX_LIMIT`. */
  readonly limit?: number;
}

/* ── score ────────────────────────────────────────────────────────────────── */

/**
 * The components stay separate so nobody downstream can mistake the blend for a measurement of
 * anything but text overlap. `trigram` is `null` when the capability is absent — never 0, because
 * "not computed" and "computed as no match" are different facts.
 */
export interface RetrievalScore {
  /** PostgreSQL `ts_rank_cd`, squashed into 0–1 so the blend is not dominated by an unbounded term. */
  readonly lexical: number;
  /** `word_similarity` when `pg_trgm` is installed; `null` when it is not. */
  readonly trigram: number | null;
  /** The weighted blend actually used for ordering. A TEXT-MATCH score. Not truth, not confidence. */
  readonly combined: number;
}

/* ── candidate ────────────────────────────────────────────────────────────── */

/**
 * One eligible record, with its match score and the derivation a reader needs to judge it. The
 * record itself is the UNCHANGED K1 projection — retrieval adds fields beside it and rewrites none.
 */
export interface RetrievalCandidate {
  readonly record: KnowledgeSourceRecord;
  readonly score: RetrievalScore;
  /**
   * The ingested source this chunk came from, derived from `fact_key` (`ingest:<title>:<digest>:<n>`).
   * `null` for hand-authored facts, which have no source document. Nothing is stored to compute it.
   */
  readonly sourceDigest: string | null;
}

/** Why a record that MATCHED the question was nonetheless not served. */
export type RetrievalExclusionReason =
  | "lifecycle-archived"
  | "lifecycle-retired"
  | "expired"
  | "not-yet-effective"
  | "deleted";

export interface RetrievalExclusion {
  readonly factKey: string;
  readonly domainKey: string;
  readonly reason: RetrievalExclusionReason;
}

/* ── capability ───────────────────────────────────────────────────────────── */

/**
 * Which retrieval components the CONNECTED database can actually run.
 *
 * This exists because the KR2 benchmark's winning representation used `unaccent` and `pg_trgm`, and
 * the canonical database has neither installed. Rather than pretend, the runtime reports exactly what
 * it computed. Turkish folding needs no extension at all — it is `translate()`, a built-in — so the
 * only thing an install would add is trigram fuzzy matching, and its absence is stated rather than
 * hidden behind a number that looks the same either way.
 *
 * Nothing here simulates a missing extension in application code. A component that cannot run is not
 * run, and the result says so.
 */
export interface RetrievalCapability {
  /** Always true: `to_tsvector('turkish', translate(...))` needs no extension. */
  readonly lexical: true;
  /** True only when `pg_trgm` is installed in the connected database. */
  readonly trigram: boolean;
  /** Operator-facing, states the missing thing exactly. `null` when nothing is missing. */
  readonly degradedReason: string | null;
}

export const RETRIEVAL_TRIGRAM_MISSING =
  "Typo and near-miss tolerance is not connected: the `pg_trgm` extension is not installed in this " +
  "database, so no trigram similarity was computed. Matching is lexical only — a misspelled word may " +
  "find nothing. This is a missing capability, not a judgement about your knowledge.";

/* ── result ───────────────────────────────────────────────────────────────── */

/**
 * The outcome of one retrieval.
 *
 * `no-match` and `empty-corpus` are SEPARATE states and must never be collapsed. "Your organization
 * holds no knowledge" and "your organization holds knowledge, but none of it answers this question"
 * are different facts about the organization, and telling someone the first when the second is true
 * is the kind of false claim this codebase repeatedly has had to repair.
 */
export type RetrievalResult =
  | {
      readonly status: "matched";
      readonly candidates: readonly RetrievalCandidate[];
      /** Records that matched but were not in force. Reported so a gap is never mysterious. */
      readonly excluded: readonly RetrievalExclusion[];
      /** How many candidates the per-source cap removed. 0 when it did not fire. */
      readonly diversityPruned: number;
      /** True when the candidate pool bound was hit, so the caller knows the sweep was partial. */
      readonly truncated: boolean;
      readonly capability: RetrievalCapability;
    }
  | {
      /** The tenant HOLDS knowledge; none of it matched this question. */
      readonly status: "no-match";
      readonly excluded: readonly RetrievalExclusion[];
      readonly capability: RetrievalCapability;
    }
  | {
      /** The tenant holds NO knowledge records at all. A different fact entirely. */
      readonly status: "empty-corpus";
      readonly capability: RetrievalCapability;
    }
  | {
      /** The query normalized to nothing searchable (punctuation, stop words only). */
      readonly status: "empty-query";
      readonly capability: RetrievalCapability;
    }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" | "read-failed";
      readonly detail?: string;
    };

/** Clamp a caller's limit into the bound this module owns. */
export function resolveRetrievalLimit(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return RETRIEVAL_DEFAULT_LIMIT;
  const floored = Math.floor(requested);
  if (floored < 1) return 1;
  return Math.min(floored, RETRIEVAL_MAX_LIMIT);
}

/**
 * The ingested source a fact key belongs to.
 *
 * Ingestion writes `ingest:<title-key>:<digest12>:<index>`, so the source identity is ALREADY in the
 * key and needs no column, no join and no migration to recover. A hand-authored fact has no source
 * document, and `null` says exactly that rather than inventing a per-record pseudo-source.
 */
export function sourceDigestOf(factKey: string): string | null {
  if (!factKey.startsWith("ingest:")) return null;
  const parts = factKey.split(":");
  return parts.length >= 4 && parts[2].length > 0 ? parts[2] : null;
}

/**
 * The provenance line that travels with every retrieval result.
 *
 * IT CARRIES K1'S PRECEDENCE RULE VERBATIM, and that is not decoration. K1 established that settled
 * knowledge describes its own subject and NEVER the current runtime state, so a policy about
 * provider authority can never answer "what is running right now". Retrieval changed which records
 * are selected; it did not change what a knowledge record IS, so dropping that sentence here would
 * quietly retire an invariant while looking like a copy edit. The grounding test that caught this
 * omission is the reason it is spelled out.
 *
 * What retrieval ADDS is the second paragraph: rank is a text match, not a measure of truth.
 */
export const RETRIEVAL_PROVENANCE =
  "Derived retrieval over the canonical Knowledge authority (knowledge_facts → knowledge_nodes), " +
  "tenant-scoped and read-only. It is settled organizational knowledge about its own subject — it is " +
  "NOT a statement of current runtime, operational, or execution state, and it never overrides a " +
  "live read model. " +
  "Ordering is a TEXT-MATCH score against your question: it is not a measure of truth, approval, or " +
  "currency. Each record still states its own authority, lifecycle, ratification and freshness, and " +
  "none of those are affected by where it ranked.";
