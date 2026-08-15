/*
 * knowledge-retrieval/evidence.ts — the DERIVED evidence explanation (KR4).
 *
 * ── WHAT THIS IS, AND WHAT IT REFUSES TO BE ──────────────────────────────────
 *
 * KR3 made Heby's evidence question-aware. It also threw almost all of the retrieval's own
 * knowledge away one function later: the diversity cap, the truncation flag, the exclusions, the
 * degraded-capability notice and every structured standing field were flattened into one display
 * string or dropped outright, so the MODEL was told more about the evidence than the human was.
 *
 * This module closes that gap and nothing else. It is a pure projection of a `RetrievalResult` that
 * already happened. It performs no read, no write, no ranking, no resolution and no judgement. It
 * is not an authority, and it is never persisted:
 *
 *   Knowledge            = authoritative
 *   Retrieval            = derived
 *   Evidence explanation = derived PRESENTATION of a derivation
 *
 * ── "WHY WAS THIS SHOWN?" — NOT "HOW TRUE IS THIS?" ─────────────────────────
 *
 * Every field below answers the first question. None of them answers the second, because Hebun
 * cannot. There is deliberately no confidence, no trust, no quality, no certainty and no score:
 * a single number beside a policy is read as a verdict on the policy, and the repository computes
 * no such verdict. The three score components stay inside `RetrievalCandidate` where KR3 put them.
 *
 * `sourceDigest` is likewise absent. It groups chunks of one source, which is a job for the
 * diversity cap, not a fact a reader needs — and a content hash printed under an answer is a
 * fingerprint, not an explanation.
 *
 * ── MULTIPLE SOURCES IS NOT CONTRADICTION ───────────────────────────────────
 *
 * Nothing in this repository detects that two statements disagree, and KR3's closure records
 * contradiction detection as having no owner. So this module never sets a `conflict` flag. It
 * reports the STRUCTURAL fact it actually has — several eligible, active records from different
 * sources answered one question in one domain — and leaves the judgement to the reader. A cautious
 * true signal beats a confident invented one.
 *
 * Pure functions over pure data. No React, no I/O, no server, no model, no authority.
 */

import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import type { RetrievalCandidate, RetrievalResult } from "./contracts";
import { sourceDigestOf } from "./contracts";
import { foldTurkish, normalizeQuery } from "./query-normalization";

/** How much of a statement a card may show before it stops being an excerpt. */
export const EVIDENCE_EXCERPT_LIMIT = 240;

/**
 * The most matched terms reported per record. A reader scanning a card needs the overlap, not a
 * concordance, and a very long question would otherwise print its whole vocabulary under each item.
 */
export const EVIDENCE_MAX_MATCHED_TERMS = 6;

/**
 * How many distinct sources make a set worth a second look.
 *
 * Two is the threshold because one source cannot disagree with itself, and the per-source diversity
 * cap already guarantees that two chunks of ONE document are not two sources.
 */
export const EVIDENCE_MULTIPLE_SOURCE_THRESHOLD = 2;

/* ── explanation ──────────────────────────────────────────────────────────── */

/**
 * Why this record is in front of the reader — every field derived from the retrieval that ran.
 *
 * NOT DERIVED FROM A MODEL. Heby does not write these, and no natural-language reason is generated
 * anywhere: the UI renders fixed copy around these facts. A model-authored "why" is an invented
 * reason wearing the runtime's authority, which is the same defect as an invented citation.
 */
export interface RetrievalExplanation {
  /**
   * The normalized query terms that actually occur in this record's title or statement.
   *
   * Computed with the SAME Turkish fold the SQL side uses, so what the reader is told matched is
   * what the database matched. Empty is a legitimate answer — a record can be returned on a term
   * that survives stemming in PostgreSQL but not a literal substring test, and claiming a term
   * matched when this check cannot see it would be worse than showing none.
   */
  readonly matchedTerms: readonly string[];
  /** True when the caller narrowed by domain and this record is in it. */
  readonly domainMatched: boolean;
  /** True when the caller narrowed by scope and this record is in it. */
  readonly scopeMatched: boolean;
  /** Always true for a served candidate — eligibility already removed every non-active version. */
  readonly activeVersion: boolean;
  /** True when the per-source diversity cap removed something from this result set. */
  readonly diversityAffected: boolean;
}

/* ── item ─────────────────────────────────────────────────────────────────── */

/** One piece of evidence, as a reader should meet it. */
export interface RetrievalEvidenceItem {
  /* IDENTITY — the same reference the evidence validator knows, never a new one. */
  readonly recordRef: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: KnowledgeSourceRecord["scope"];

  /*
   * KR5 — DURABLE IDENTITY, carried for history rather than for display.
   *
   * `recordRef` (domainKey/factKey) is the reference the validator matches on, and it is NOT
   * version-pinned: after a supersession the same recordRef resolves to different text. These two
   * uuids are, which is what lets a historical evidence row say WHICH version an answer used
   * instead of merely which fact. `knowledgeNodeId` is nullable because the canonical fact registry
   * allows a fact with no active node.
   *
   * Nothing renders them. They exist so the historical record can be exact.
   */
  readonly factId: string;
  readonly knowledgeNodeId: string | null;

  /* CONTENT */
  readonly title: string;
  /** A bounded excerpt of the statement. `null` when the record carries none. */
  readonly excerpt: string | null;
  /** True when the statement was longer than the excerpt, so the card can say so. */
  readonly excerptTruncated: boolean;

  /* STANDING — structured, never a pre-joined display string. */
  readonly authorityClass: KnowledgeSourceRecord["authorityClass"];
  readonly lifecycleStatus: KnowledgeSourceRecord["lifecycleStatus"];
  readonly ratified: boolean;
  readonly ratifiedAt: string | null;
  readonly freshness: KnowledgeSourceRecord["freshness"];
  readonly knowledgeVersion: number;
  readonly factVersion: number;
  readonly effectiveFrom: string | null;
  readonly effectiveUntil: string | null;
  readonly nextReviewAt: string | null;

  /* PROVENANCE — projected from the columns the writer has always written. */
  readonly origin: string | null;
  readonly authoredThrough: string | null;
  readonly textOriginUnverified: boolean | null;
  readonly sourceTitle: string | null;
  readonly sourceType: string | null;
  readonly ingestedByActorType: string | null;
  readonly ingestedAt: string | null;
  readonly chunkIndex: number | null;
  readonly chunkCount: number | null;

  readonly explanation: RetrievalExplanation;
}

/* ── set ──────────────────────────────────────────────────────────────────── */

/** The set-level facts about one retrieval, mirroring `RetrievalResult`'s own states. */
export interface RetrievalEvidenceSet {
  /** Carried through unflattened so the UI can render five distinct states, never "no data". */
  readonly status: RetrievalResult["status"];
  readonly items: readonly RetrievalEvidenceItem[];
  /** The candidate pool bound was hit — more eligible knowledge exists than was swept. */
  readonly truncated: boolean;
  /** How many candidates the per-source cap removed. */
  readonly diversityPruned: number;
  /** How many records matched but were not in force. A gap the reader should never have to guess. */
  readonly excludedCount: number;
  /** A retrieval component that could not run, stated exactly. `null` when nothing is missing. */
  readonly degradedReason: string | null;
  /**
   * Several distinct sources answered one question in one domain.
   *
   * NOT `conflict`. This says the reader has more than one organizational source in front of them,
   * which is a fact; whether they disagree is a judgement nothing here makes.
   */
  readonly multipleRelevantSources: boolean;
  /** Why the set is empty, when it is. Mirrors the retrieval's own reason, never a generic one. */
  readonly unavailableReason: string | null;
}

/* ── derivation ───────────────────────────────────────────────────────────── */

function excerptOf(statement: string | null): {
  readonly excerpt: string | null;
  readonly truncated: boolean;
} {
  if (!statement) return { excerpt: null, truncated: false };
  const collapsed = statement.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return { excerpt: null, truncated: false };
  if (collapsed.length <= EVIDENCE_EXCERPT_LIMIT) return { excerpt: collapsed, truncated: false };
  return { excerpt: collapsed.slice(0, EVIDENCE_EXCERPT_LIMIT).trimEnd(), truncated: true };
}

/**
 * Which normalized query terms literally occur in this record's text — reported AS THE RECORD
 * SPELLS THEM.
 *
 * Folded on both sides with the shipped `foldTurkish`, so "İZİN" in the question finds "izin" in
 * the record exactly as the SQL side does. This is a SUBSTRING check on purpose: it is a claim the
 * reader can verify with their own eyes against the excerpt. It deliberately does NOT try to
 * reproduce PostgreSQL stemming — a term the check cannot see is simply not listed, because an
 * unverifiable "matched" claim is worse than a short list.
 *
 * WHY THE RECORD'S SPELLING AND NOT THE QUERY'S. `normalizeQuery` hands back FOLDED tokens, so
 * reporting the token would print "Yillik" under a record that reads "Yıllık" — a word the reader
 * cannot find anywhere on screen, in a panel whose entire job is to be checkable. Recovering the
 * original is exact rather than approximate: the fold is `translate()`, a character-for-character
 * map of thirteen letters, so it never changes length and the offset in the folded text is the same
 * offset in the original.
 */
export function matchedTermsFor(
  record: Pick<KnowledgeSourceRecord, "title" | "statement">,
  tokens: readonly string[],
): readonly string[] {
  const original = `${record.title} ${record.statement ?? ""}`;
  const haystack = foldTurkish(original).toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const folded = foldTurkish(token).toLowerCase();
    if (folded.length === 0 || seen.has(folded)) continue;
    const at = haystack.indexOf(folded);
    if (at < 0) continue;
    seen.add(folded);
    out.push(original.slice(at, at + folded.length));
    if (out.length >= EVIDENCE_MAX_MATCHED_TERMS) break;
  }
  return out;
}

function itemOf(
  candidate: RetrievalCandidate,
  tokens: readonly string[],
  narrowing: { readonly domainKey?: string; readonly scope?: string },
  diversityAffected: boolean,
): RetrievalEvidenceItem {
  const { record } = candidate;
  const { excerpt, truncated } = excerptOf(record.statement);
  const provenance = record.provenance ?? null;
  const attribution = record.sourceAttribution ?? null;

  return {
    recordRef: `${record.domainKey}/${record.factKey}`,
    factKey: record.factKey,
    domainKey: record.domainKey,
    scope: record.scope,

    factId: record.factId,
    knowledgeNodeId: record.activeKnowledgeNodeId,

    title: record.title,
    excerpt,
    excerptTruncated: truncated,

    authorityClass: record.authorityClass,
    lifecycleStatus: record.lifecycleStatus,
    ratified: record.ratified,
    ratifiedAt: record.ratifiedAt,
    freshness: record.freshness,
    knowledgeVersion: record.knowledgeVersion,
    factVersion: record.factVersion,
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    nextReviewAt: record.nextReviewAt,

    origin: provenance?.origin ?? null,
    authoredThrough: provenance?.authoredThrough ?? null,
    /*
     * `null` means the reader is not being told either way, because this projection did not carry
     * provenance. It is NOT the same as `false`, which would assert that the text origin WAS
     * verified — something Hebun never does for any record.
     */
    textOriginUnverified: provenance ? provenance.textOriginUnverified : null,
    sourceTitle: attribution?.sourceTitle ?? null,
    sourceType: attribution?.sourceType ?? provenance?.sourceType ?? null,
    ingestedByActorType: attribution?.ingestedByActorType ?? null,
    ingestedAt: attribution?.ingestedAt ?? null,
    chunkIndex: provenance?.chunkIndex ?? null,
    chunkCount: provenance?.chunkCount ?? null,

    explanation: {
      matchedTerms: matchedTermsFor(record, tokens),
      domainMatched: narrowing.domainKey !== undefined && narrowing.domainKey === record.domainKey,
      scopeMatched: narrowing.scope !== undefined && narrowing.scope === record.scope,
      // Eligibility already removed every archived, retired, expired, future or non-active version.
      activeVersion: true,
      diversityAffected,
    },
  };
}

/**
 * How many DISTINCT sources are represented in a candidate set.
 *
 * A hand-authored fact is its own source; two chunks of one ingested document are one. That
 * asymmetry is the whole point — otherwise a single long policy split into forty chunks would
 * report itself as forty disagreeing sources.
 */
export function distinctSourceCount(candidates: readonly RetrievalCandidate[]): number {
  const sources = new Set<string>();
  for (const candidate of candidates) {
    const digest = sourceDigestOf(candidate.record.factKey);
    sources.add(digest === null ? `authored:${candidate.record.factKey}` : `source:${digest}`);
  }
  return sources.size;
}

/**
 * Project a retrieval result into the evidence a reader should see.
 *
 * `queryText` is re-normalized here rather than threaded through the call chain: `normalizeQuery`
 * is pure and already ran identically inside the search, so re-deriving the tokens keeps this a
 * projection of the result instead of a second output the search has to carry.
 *
 * The four empty states keep their four different meanings. The `unavailableReason` carried here is
 * the SAME sentence the source resolution shows, so the card and the prose can never disagree.
 */
export function buildRetrievalEvidence(
  result: RetrievalResult,
  queryText: string,
  narrowing: { readonly domainKey?: string; readonly scope?: string } = {},
): RetrievalEvidenceSet {
  const empty = {
    items: [] as readonly RetrievalEvidenceItem[],
    truncated: false,
    diversityPruned: 0,
    excludedCount: 0,
    multipleRelevantSources: false,
  };

  switch (result.status) {
    case "unavailable":
      return {
        ...empty,
        status: result.status,
        degradedReason: null,
        unavailableReason: result.detail ?? null,
      };

    case "empty-query":
    case "empty-corpus":
      return {
        ...empty,
        status: result.status,
        degradedReason: result.capability.degradedReason,
        unavailableReason: null,
      };

    case "no-match":
      return {
        ...empty,
        status: result.status,
        excludedCount: result.excluded.length,
        degradedReason: result.capability.degradedReason,
        unavailableReason: null,
      };

    case "matched": {
      const tokens = normalizeQuery(queryText).tokens;
      const diversityAffected = result.diversityPruned > 0;
      const items = result.candidates.map((candidate) =>
        itemOf(candidate, tokens, narrowing, diversityAffected),
      );
      /*
       * Only a MATCHED set can carry this signal, and only when more than one source is actually
       * present in ONE domain. Records from different domains answering the same question are not
       * competing statements about the same rule — a leave policy and a travel policy can both be
       * relevant without either being wrong.
       */
      const domains = new Set(result.candidates.map((candidate) => candidate.record.domainKey));
      const multipleRelevantSources =
        domains.size === 1 &&
        distinctSourceCount(result.candidates) >= EVIDENCE_MULTIPLE_SOURCE_THRESHOLD;

      return {
        status: result.status,
        items,
        truncated: result.truncated,
        diversityPruned: result.diversityPruned,
        excludedCount: result.excluded.length,
        degradedReason: result.capability.degradedReason,
        multipleRelevantSources,
        unavailableReason: null,
      };
    }
  }
}
