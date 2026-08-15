/*
 * heby-conversation/answer-evidence.ts — KR5. The two projections between the retrieval evidence a
 * reader meets and the historical rows recorded with an answer.
 *
 * PURE. No database, no React, no authority, no clock. Both directions live here together on
 * purpose: a write projection and a read projection that drift apart is exactly how a reloaded
 * answer starts describing a different result set than the live one did, and the reader would have
 * no way to tell. Keeping them adjacent makes the round trip reviewable in one screen.
 *
 * WHAT DOES NOT CROSS INTO STORAGE, and the omissions are the point:
 *
 *   - the full Knowledge statement. Only the bounded excerpt the reader actually saw travels; the
 *     statement stays in `knowledge_nodes`, which is its only authority. Copying it here would make
 *     these tables a second Knowledge content store.
 *   - lexical / trigram / combined score, rank, weights. They are not in `RetrievalEvidenceItem` to
 *     begin with, and there is no line below that could reintroduce one.
 *   - trust, confidence, certainty. Hebun computes none of these anywhere.
 *   - `explanation.activeVersion`, which is a constant `true` for any served candidate, and
 *     `explanation.diversityAffected`, which is derivable from the set's own `diversityPruned`.
 *     A stored constant is a field that will one day be wrong.
 */

import type {
  RetrievalEvidenceItem,
  RetrievalEvidenceSet,
} from "@/features/knowledge-retrieval";
import type {
  AppendEvidenceItemInput,
  AppendEvidenceSetInput,
  StoredEvidenceSet,
} from "./durable-conversation-repository.server";

/** ISO string → Date for a timestamptz column; absent stays absent. */
function toDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → ISO string, restoring the shape the evidence contract uses. */
function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function itemToRow(item: RetrievalEvidenceItem, ordinal: number): AppendEvidenceItemInput {
  return {
    factId: item.factId,
    knowledgeNodeId: item.knowledgeNodeId,
    domainKey: item.domainKey,
    factKey: item.factKey,
    scope: item.scope,

    title: item.title,
    excerpt: item.excerpt,
    excerptTruncated: item.excerptTruncated,
    authorityClass: item.authorityClass,
    lifecycleStatus: item.lifecycleStatus,
    ratified: item.ratified,
    ratifiedAt: toDate(item.ratifiedAt),
    freshness: item.freshness,
    knowledgeVersion: item.knowledgeVersion,
    factVersion: item.factVersion,
    effectiveFrom: toDate(item.effectiveFrom),
    effectiveUntil: toDate(item.effectiveUntil),
    nextReviewAt: toDate(item.nextReviewAt),
    origin: item.origin,
    authoredThrough: item.authoredThrough,
    textOriginUnverified: item.textOriginUnverified,
    sourceTitle: item.sourceTitle,
    sourceType: item.sourceType,
    ingestedByActorType: item.ingestedByActorType,
    ingestedAt: toDate(item.ingestedAt),
    chunkIndex: item.chunkIndex,
    chunkCount: item.chunkCount,
    /*
     * The only part of `explanation` that is worth storing. `activeVersion` is a constant, and
     * `diversityAffected` is the set's `diversityPruned > 0` — both are re-derived on read rather
     * than frozen into a column that could one day disagree with the set beside it.
     */
    matchedTerms: item.explanation.matchedTerms,

    ordinal,
  };
}

/**
 * Project the retrieval a reader saw into the rows recorded with the answer.
 *
 * `ordinal` is the retrieval's own order, captured rather than recomputed: relevance ordering came
 * from a query and a corpus that will not exist in this form again, so re-deriving it later is not
 * possible and re-sorting on any stored field would invent a different order.
 */
export function toStoredEvidence(set: RetrievalEvidenceSet): AppendEvidenceSetInput {
  return {
    status: set.status,
    truncated: set.truncated,
    diversityPruned: set.diversityPruned,
    excludedCount: set.excludedCount,
    degradedReason: set.degradedReason,
    multipleRelevantSources: set.multipleRelevantSources,
    unavailableReason: set.unavailableReason,
    items: set.items.map(itemToRow),
  };
}

/**
 * Rebuild the reader's evidence set from the recorded rows.
 *
 * NOTHING IS RE-READ FROM KNOWLEDGE HERE. Every value comes off the historical row, which is the
 * whole guarantee: a superseded fact cannot substitute its current text into a card describing an
 * answer that never saw it.
 *
 * `explanation` is reconstructed from what was stored plus what is structurally known.
 * `activeVersion` is `true` because eligibility had already removed every non-active version before
 * the candidate was served — it was true when recorded and cannot become false retroactively.
 * `domainMatched` / `scopeMatched` are `false` because narrowing was not part of this answer's
 * request; asserting a match that was never evaluated would be an invented claim.
 */
export function fromStoredEvidence(stored: StoredEvidenceSet): RetrievalEvidenceSet {
  const diversityAffected = stored.diversityPruned > 0;
  return {
    status: stored.status as RetrievalEvidenceSet["status"],
    truncated: stored.truncated,
    diversityPruned: stored.diversityPruned,
    excludedCount: stored.excludedCount,
    degradedReason: stored.degradedReason,
    multipleRelevantSources: stored.multipleRelevantSources,
    unavailableReason: stored.unavailableReason,
    items: [...stored.items]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((row) => ({
        recordRef: `${row.domainKey}/${row.factKey}`,
        factKey: row.factKey,
        domainKey: row.domainKey,
        scope: row.scope as RetrievalEvidenceItem["scope"],

        factId: row.factId,
        knowledgeNodeId: row.knowledgeNodeId,

        title: row.title,
        excerpt: row.excerpt,
        excerptTruncated: row.excerptTruncated,

        authorityClass: row.authorityClass as RetrievalEvidenceItem["authorityClass"],
        lifecycleStatus: row.lifecycleStatus as RetrievalEvidenceItem["lifecycleStatus"],
        ratified: row.ratified,
        ratifiedAt: toIso(row.ratifiedAt),
        freshness: row.freshness as RetrievalEvidenceItem["freshness"],
        knowledgeVersion: row.knowledgeVersion,
        factVersion: row.factVersion,
        effectiveFrom: toIso(row.effectiveFrom),
        effectiveUntil: toIso(row.effectiveUntil),
        nextReviewAt: toIso(row.nextReviewAt),

        origin: row.origin,
        authoredThrough: row.authoredThrough,
        textOriginUnverified: row.textOriginUnverified,
        sourceTitle: row.sourceTitle,
        sourceType: row.sourceType,
        ingestedByActorType: row.ingestedByActorType,
        ingestedAt: toIso(row.ingestedAt),
        chunkIndex: row.chunkIndex,
        chunkCount: row.chunkCount,

        explanation: {
          matchedTerms: row.matchedTerms,
          domainMatched: false,
          scopeMatched: false,
          activeVersion: true,
          diversityAffected,
        },
      })),
  };
}
