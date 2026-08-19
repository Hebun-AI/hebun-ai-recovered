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
  AppendSourceEvidenceInput,
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

/* ===========================================================================
 * G6D — THE SAME TWO PROJECTIONS, FOR NON-KNOWLEDGE SOURCES.
 *
 * They live beside the KR5 pair above for that section's own reason: a write projection and a read
 * projection that drift apart is how a reloaded answer starts describing something the live one
 * never showed. Keeping all four in one file makes both round trips reviewable together.
 *
 * KNOWLEDGE IS EXCLUDED HERE, not forgotten. It already has the authority above, and a CHECK
 * constraint refuses it in the table, so the exclusion is enforced twice — once where the rows are
 * built and once where they land.
 * ========================================================================= */

/** One replayed citation. Exactly what was stored; this record is never reshaped on the way out. */
export interface ReplayedSourceEvidenceItem {
  readonly recordRef: string;
  readonly label: string;
  readonly detail: string;
}

/** One source class's citations from one historical answer, with the standing it asserted then. */
export interface ReplayedSourceEvidence {
  readonly sourceClass: string;
  /** The standing recorded AT ANSWER TIME — never re-derived from the source's state today. */
  readonly authoritative: boolean;
  readonly items: readonly ReplayedSourceEvidenceItem[];
}

/**
 * Resolutions → storage rows.
 *
 * Only RESOLVED sources contribute: an unavailable source cited nothing, and its own reason is
 * already printed into the answer body, so a zero-row marker would record a second time what the
 * message already says.
 *
 * `authoritative` is read off the owning RESOLUTION, so a class cannot declare one standing and
 * store another. `ordinal` runs across the whole answer, preserving the order the reader met the
 * items in rather than an order per class.
 */
export function toStoredSourceEvidence(
  resolutions: readonly {
    readonly sourceClass: string;
    readonly state: string;
    readonly authoritative: boolean;
    readonly items: readonly { readonly recordRef: string; readonly label: string; readonly detail: string }[];
  }[],
): AppendSourceEvidenceInput[] {
  const rows: AppendSourceEvidenceInput[] = [];
  let ordinal = 0;
  for (const resolution of resolutions) {
    if (resolution.state !== "resolved") continue;
    if (resolution.sourceClass === "knowledge") continue;
    for (const item of resolution.items) {
      rows.push({
        sourceClass: resolution.sourceClass,
        recordRef: item.recordRef,
        label: item.label,
        detail: item.detail,
        authoritative: resolution.authoritative,
        ordinal: ordinal++,
      });
    }
  }
  return rows;
}

/**
 * Storage rows → replay, grouped by the class that cited them.
 *
 * A MIXED ANSWER STAYS MIXED. Each group carries its OWN recorded standing, so an answer that cited
 * an authoritative Governance record beside a derived read model replays as two groups saying two
 * different things — never one rounded to whichever is more flattering.
 */
export function fromStoredSourceEvidence(
  /*
   * G7 WIDENED THIS PARAMETER, AND THE WIDENING IS THE POINT.
   *
   * The projection reads `sourceClass`, `ordinal`, `authoritative`, `recordRef`, `label` and
   * `detail` — every one of which `AppendSourceEvidenceInput` already carries. It never read
   * `messageId`. Accepting the narrower row shape lets the LIVE answer replay its own citations
   * through THIS function, before a row has an id, so the live view is produced by the same code
   * that produces the reloaded one rather than by a parallel implementation that could drift.
   *
   * `StoredSourceEvidence` extends `AppendSourceEvidenceInput`, so every existing caller is
   * unaffected and the reload path is unchanged.
   */
  rows: readonly AppendSourceEvidenceInput[],
): readonly ReplayedSourceEvidence[] {
  const groups = new Map<string, { authoritative: boolean; items: ReplayedSourceEvidenceItem[] }>();
  for (const row of [...rows].sort((a, b) => a.ordinal - b.ordinal)) {
    const group = groups.get(row.sourceClass) ?? { authoritative: row.authoritative, items: [] };
    group.items.push({ recordRef: row.recordRef, label: row.label, detail: row.detail });
    groups.set(row.sourceClass, group);
  }
  return [...groups].map(([sourceClass, group]) => ({
    sourceClass,
    authoritative: group.authoritative,
    items: group.items,
  }));
}

/**
 * G7 — the citations of the answer being produced RIGHT NOW, in the shape a reload will replay.
 *
 * ── WHY THIS IS A COMPOSITION AND NOT A THIRD PROJECTION ────────────────────
 *
 * Before G7 the live answer could not show a citation's label, detail or standing: the response
 * carried only `{ sourceClass, recordRef, lifecycle }`, while the reloaded answer carried all three.
 * The same answer therefore described itself differently before and after a refresh, and the
 * reader had no way to know which reading was the fuller one.
 *
 * The fix could have been a new function that walks the resolutions and builds the reader's shape
 * directly. It deliberately is NOT, because that function would be a SECOND definition of "what
 * this answer cited" sitting beside `toStoredSourceEvidence`, and two definitions of one sentence
 * drift. This is literally the write projection followed by the read projection:
 *
 *     resolutions → toStoredSourceEvidence → fromStoredSourceEvidence
 *
 * The rows in the middle are the very rows `persistExchange` is given for this same answer, from
 * this same `resolutions` array. So live and reloaded agreement is not a property a test has to
 * check for regressions — it is the only thing this code can express. A divergence would require
 * changing one of the two projections, which changes BOTH views at once.
 *
 * It inherits every exclusion of the pair unchanged: unresolved sources contribute nothing,
 * Knowledge is excluded (it has its own evidence authority), the standing is read off the owning
 * resolution, and no content, score, confidence or lifecycle travels.
 */
export function toResponseSourceEvidence(
  resolutions: readonly {
    readonly sourceClass: string;
    readonly state: string;
    readonly authoritative: boolean;
    readonly items: readonly { readonly recordRef: string; readonly label: string; readonly detail: string }[];
  }[],
): readonly ReplayedSourceEvidence[] {
  return fromStoredSourceEvidence(toStoredSourceEvidence(resolutions));
}
