/*
 * knowledge-retrieval/ranking.ts — ordering candidates, and bounding how much one source may own.
 *
 * ── THE SCORE IS A TEXT-MATCH SCORE ──────────────────────────────────────────
 *
 * Everything here answers one question: how well did this record's words match the question's words.
 * It answers nothing about truth, approval, currency, or safety to act on. The components are kept
 * separate on the way out (`lexical`, `trigram`, `combined`) so that no consumer can mistake the
 * blend for a single measurement of quality, and so a missing component is visibly missing rather
 * than silently contributing zero.
 *
 * ── THE WEIGHTS ARE A MEASUREMENT, NOT A PREFERENCE ──────────────────────────
 *
 * 0.6 lexical / 0.4 trigram is what the KR2 benchmark measured as best on a 172-fact Turkish corpus
 * against 46 hand-authored gold queries. They are frozen first-generation constants. There is no
 * dynamic tuning, no learned weighting, and no per-query adaptation — any of those would need its own
 * measurement, and inventing one now would make the number less trustworthy, not more.
 *
 * `ts_rank_cd` is UNBOUNDED and in practice lands around 0.01–1.5 on this corpus, while
 * `word_similarity` is 0–1 by construction. Adding them raw would make the blend a trigram score
 * wearing a hybrid label, so the lexical term is squashed with r/(r+1) into 0–1 first. That squash is
 * monotonic, so it never reorders the lexical component against itself.
 *
 * ── DIVERSITY BOUNDS A SOURCE, IT DOES NOT RESOLVE DISAGREEMENT ──────────────
 *
 * Knowledge ingestion turns one pasted document into up to 40 facts. KR2 measured a single such
 * source taking 3 of 5 slots on a purchasing question. The cap stops one document from owning an
 * answer.
 *
 * It is a CAP, never a merge and never a dedupe. Two sources that contradict each other have
 * different digests, so both survive the cap and both reach the reader. Retrieval exposes
 * disagreement; resolving it belongs to Governance and to a future Knowledge Quality phase, not to a
 * sort function. Pruning is counted and reported so a shortened result is never mysterious.
 *
 * Pure. No I/O, no database, no clock.
 */

import type { KnowledgeSourceRecord } from "@/features/knowledge/contracts";
import {
  RETRIEVAL_MAX_PER_SOURCE,
  RETRIEVAL_WEIGHTS,
  sourceDigestOf,
  type RetrievalCandidate,
  type RetrievalScore,
} from "./contracts";

/** Squash an unbounded rank into 0–1 without changing its order. */
export function squash(rank: number): number {
  if (!Number.isFinite(rank) || rank <= 0) return 0;
  return rank / (rank + 1);
}

/**
 * Blend the components that were actually computed.
 *
 * When trigram is absent the lexical term carries the whole score rather than 0.6 of it — otherwise
 * every score would be scaled down by a constant for no reason, which changes nothing about the
 * ordering but makes the number meaningless to compare across databases.
 */
export function combineScore(lexicalRank: number, trigram: number | null): RetrievalScore {
  const lexical = squash(lexicalRank);
  if (trigram === null) {
    return { lexical, trigram: null, combined: lexical };
  }
  const bounded = Number.isFinite(trigram) ? Math.min(Math.max(trigram, 0), 1) : 0;
  return {
    lexical,
    trigram: bounded,
    combined: RETRIEVAL_WEIGHTS.LEXICAL * lexical + RETRIEVAL_WEIGHTS.TRIGRAM * bounded,
  };
}

export interface ScoredRow {
  readonly record: KnowledgeSourceRecord;
  readonly lexicalRank: number;
  readonly trigram: number | null;
}

export function toCandidate(row: ScoredRow): RetrievalCandidate {
  return {
    record: row.record,
    score: combineScore(row.lexicalRank, row.trigram),
    sourceDigest: sourceDigestOf(row.record.factKey),
  };
}

/**
 * Order candidates by match score.
 *
 * Ties break on domain then fact key — the SAME deterministic order the K1 listing already uses — so
 * two records that match a question equally well always come back in the same order. A stable order
 * is what makes a retrieval reproducible, and reproducibility is what makes a bug reportable.
 */
export function rankCandidates(
  candidates: readonly RetrievalCandidate[],
): readonly RetrievalCandidate[] {
  return [...candidates].sort((a, b) => {
    if (b.score.combined !== a.score.combined) return b.score.combined - a.score.combined;
    if (a.record.domainKey !== b.record.domainKey) {
      return a.record.domainKey < b.record.domainKey ? -1 : 1;
    }
    return a.record.factKey < b.record.factKey ? -1 : a.record.factKey > b.record.factKey ? 1 : 0;
  });
}

export interface DiversityOutcome {
  readonly kept: readonly RetrievalCandidate[];
  /** How many candidates the per-source cap removed. Reported, never silent. */
  readonly pruned: number;
}

/**
 * Bound how many chunks one ingested source may contribute.
 *
 * Applied to an ALREADY-RANKED list, so the chunks a source keeps are its best-matching ones.
 * Hand-authored facts have no source document (`sourceDigest === null`) and are never capped — the
 * problem this solves is one document fragmenting into many rows, and a fact authored by a human is
 * not a fragment of anything.
 */
export function applySourceDiversity(
  ranked: readonly RetrievalCandidate[],
  maxPerSource: number = RETRIEVAL_MAX_PER_SOURCE,
): DiversityOutcome {
  const seen = new Map<string, number>();
  const kept: RetrievalCandidate[] = [];
  let pruned = 0;

  for (const candidate of ranked) {
    const digest = candidate.sourceDigest;
    if (digest === null) {
      kept.push(candidate);
      continue;
    }
    const used = seen.get(digest) ?? 0;
    if (used >= maxPerSource) {
      pruned += 1;
      continue;
    }
    seen.set(digest, used + 1);
    kept.push(candidate);
  }

  return { kept, pruned };
}
