/**
 * Enterprise Memory Reasoning — understanding assembly normalization (Phase 8).
 *
 * Deterministically assembles a canonical understanding bundle:
 *   - each artifact set is de-duplicated and totally ordered by its canonical member
 *     id — each artifact object is carried through UNCHANGED, never rewritten,
 *   - the understanding index (chain), summary, and evidence basis are derived
 *     deterministically from that canonical context,
 *   - the whole bundle is emitted immutable and frozen.
 *
 * This is pure canonical assembly — NO new reasoning, NO new artifact, and crucially
 * NO mutation or internal rewriting of any gathered artifact. Ordering and
 * de-duplication happen by canonical id only; the artifact values are the very
 * objects the earlier phases produced. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import type { EvidenceItem, EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type {
  Understanding,
  UnderstandingBundle,
  UnderstandingChain,
  UnderstandingContext,
  UnderstandingReference,
  UnderstandingSubject,
  UnderstandingScope,
} from "@/features/enterprise-memory-reasoning/understanding-types";
import {
  basisOf,
  confidenceMemberId,
  explanationMemberId,
  provenanceMemberId,
  referencesOf,
  summaryOf,
  understandingLayerOf,
} from "@/features/enterprise-memory-reasoning/understanding-rules";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * De-duplicates and totally orders a set by canonical member id, carrying each
 * original object UNCHANGED. First occurrence of a duplicate id wins.
 */
function canonicalizeById<T>(items: readonly T[], idOf: (item: T) => string): readonly T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const id = idOf(item);
    if (!byId.has(id)) byId.set(id, item);
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const item = byId.get(id);
    if (item === undefined) throw new Error("canonicalizeById: missing item");
    return item;
  });
}

/** An unambiguous, text-safe key for one understanding reference. */
export function understandingReferenceKey(reference: UnderstandingReference): string {
  return JSON.stringify([reference.artifactKind, reference.artifactId]);
}

/** Deterministic total order over references: by canonical layer, then id, then kind. */
function compareReference(left: UnderstandingReference, right: UnderstandingReference): number {
  const byLayer = understandingLayerOf(left.artifactKind) - understandingLayerOf(right.artifactKind);
  if (byLayer !== 0) return byLayer;
  const byId = compareStrings(left.artifactId, right.artifactId);
  if (byId !== 0) return byId;
  return compareStrings(left.artifactKind, right.artifactKind);
}

/** De-duplicates and totally orders evidence items by their canonical memory key. */
export function normalizeEvidenceItems(items: readonly EvidenceItem[]): readonly EvidenceItem[] {
  return canonicalizeById(items, (item) => evidenceKey(item.reference));
}

/**
 * Canonicalizes every artifact set by de-duplicating and ordering on canonical id.
 * Each artifact is carried UNCHANGED — no internal field is rewritten or re-derived.
 */
export function normalizeContext(context: UnderstandingContext): UnderstandingContext {
  const evidence: EvidenceSet = { items: normalizeEvidenceItems(context.evidence.items) };
  return {
    evidence,
    relations: canonicalizeById(context.relations, (relation) => relation.relationId),
    implications: canonicalizeById(context.implications, (implication) => implication.implicationId),
    contradictions: canonicalizeById(context.contradictions, (contradiction) => contradiction.contradictionId),
    gaps: canonicalizeById(context.gaps, (gap) => gap.gapId),
    provenances: canonicalizeById(context.provenances, provenanceMemberId),
    explanations: canonicalizeById(context.explanations, explanationMemberId),
    confidences: canonicalizeById(context.confidences, confidenceMemberId),
  };
}

/** De-duplicates and totally orders an index of references. */
export function normalizeChain(references: readonly UnderstandingReference[]): UnderstandingChain {
  const byKey = new Map<string, UnderstandingReference>();
  for (const reference of references) {
    const key = understandingReferenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  return { references: [...byKey.values()].sort(compareReference) };
}

/**
 * Derives the canonical understanding record from a subject, scope, and an
 * already-normalized context. The chain, summary, and basis are all projections of
 * the context — nothing is invented.
 */
export function assembleUnderstanding(
  subject: UnderstandingSubject,
  scope: UnderstandingScope,
  normalizedContext: UnderstandingContext,
): Understanding {
  return {
    subject,
    scope,
    chain: normalizeChain(referencesOf(normalizedContext)),
    summary: summaryOf(normalizedContext),
    basis: basisOf(normalizedContext),
  };
}

/** A canonical key for a bundle: its subject, scope, and ordered reference index. */
export function canonicalUnderstandingKey(bundle: UnderstandingBundle): string {
  return JSON.stringify([
    bundle.understanding.subject.subjectId,
    bundle.understanding.scope.scopeId,
    bundle.understanding.chain.references.map(understandingReferenceKey),
  ]);
}

/**
 * Assembles a canonical, immutable understanding bundle from a subject, scope, and a
 * proposed context. Deterministic: the same input always produces the same bundle.
 * The context is canonicalized and the understanding index is derived from it.
 */
export function normalizeUnderstandingBundle(
  subject: UnderstandingSubject,
  scope: UnderstandingScope,
  context: UnderstandingContext,
): UnderstandingBundle {
  const normalizedContext = normalizeContext(context);
  const understanding = assembleUnderstanding(subject, scope, normalizedContext);
  return Object.freeze({ understanding: Object.freeze(understanding), context: Object.freeze(normalizedContext) });
}
