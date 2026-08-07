/**
 * Heby Core — approval normalization (Phase 6, Approval Preparation and Director Boundary).
 *
 * Deterministically canonicalizes a prepared approval:
 *   - each prepared item's subject references and consequences are de-duplicated and totally
 *     ordered — arrangement only, never a rank, score, priority, or recommendation,
 *   - prepared items are de-duplicated and totally ordered by kind then identity,
 *   - the bound context is canonicalized through the Phase 2 normalizer, unchanged in meaning,
 *   - itemId, kind, intentId, decision state, authority basis, and every identity are carried
 *     UNCHANGED,
 *   - the whole prepared approval, its items, and its Director termination are emitted
 *     immutable and deep-frozen.
 *
 * Pure canonical normalization — NO model call, NO decision, NO approval, NO mutation of any
 * preserved value, and NO change of semantic meaning. Ordering and de-duplication happen by
 * text key only. Keys use JSON encoding so they are unambiguous, text-safe, UTF-8 stable, and
 * NUL-safe. Normalization is idempotent: the canonical form of a canonical prepared approval is
 * itself.
 */

import {
  type CanonicalHebyPreparedApproval,
  type HebyDirectorTermination,
  type HebyPreparedApproval,
  type HebyPreparedItem,
} from "@/features/heby-core/heby-approval-types";
import { hebyPreparationKindOrder } from "@/features/heby-core/heby-approval-rules";
import { normalizeHebyDeclaredContext } from "@/features/heby-core/heby-input-context-normalization";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of string identities. Arrangement only. */
function orderedUnique(values: readonly HebyId[]): readonly HebyId[] {
  const seen = new Set<HebyId>();
  for (const value of values) seen.add(value);
  return [...seen].sort(compareStrings);
}

/** A canonical, text-safe key for one prepared item. The same item always yields the same key. */
export function hebyPreparedItemKey(item: HebyPreparedItem): string {
  return JSON.stringify([
    item.itemId,
    item.kind,
    item.intentId,
    item.decisionState,
    orderedUnique(item.subjectRefs),
    orderedUnique(item.consequences),
  ]);
}

/**
 * Canonicalizes one prepared item: subject references and consequences de-duplicated and
 * ordered, every other field carried UNCHANGED, and the item deep-frozen.
 */
export function normalizeHebyPreparedItem(item: HebyPreparedItem): HebyPreparedItem {
  return Object.freeze({
    itemId: item.itemId,
    kind: item.kind,
    intentId: item.intentId,
    subjectRefs: Object.freeze(orderedUnique(item.subjectRefs)),
    decisionState: item.decisionState,
    consequences: Object.freeze(orderedUnique(item.consequences)),
  });
}

/**
 * De-duplicates prepared items by canonical key and totally orders them by kind then identity —
 * arrangement only. Each surviving item is canonicalized and deep-frozen.
 */
export function normalizeHebyPreparedItems(
  items: readonly HebyPreparedItem[],
): readonly HebyPreparedItem[] {
  const byKey = new Map<string, HebyPreparedItem>();
  for (const item of items) {
    const key = hebyPreparedItemKey(item);
    if (!byKey.has(key)) byKey.set(key, normalizeHebyPreparedItem(item));
  }
  return [...byKey.values()].sort((left, right) => {
    const byKind = hebyPreparationKindOrder(left.kind) - hebyPreparationKindOrder(right.kind);
    if (byKind !== 0) return byKind;
    return compareStrings(left.itemId, right.itemId);
  });
}

/** Freezes a Director termination marker. Authority basis carried UNCHANGED. */
function freezeTermination(termination: HebyDirectorTermination): HebyDirectorTermination {
  return Object.freeze({ ...termination });
}

/**
 * Canonicalizes a prepared approval into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical prepared approval, and the
 * canonical form of a canonical prepared approval is itself. Items are ordered; the context is
 * canonicalized; the Director termination is frozen; identities and states are carried UNCHANGED.
 */
export function normalizeHebyPreparedApproval(
  approval: HebyPreparedApproval,
): CanonicalHebyPreparedApproval {
  return Object.freeze({
    presentationId: approval.presentationId,
    intentId: approval.intentId,
    context: normalizeHebyDeclaredContext(approval.context),
    items: Object.freeze(normalizeHebyPreparedItems(approval.items)),
    termination: freezeTermination(approval.termination),
  });
}

/**
 * A canonical, text-safe key for a whole prepared approval. The same prepared approval always
 * produces the same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyPreparedApprovalKey(approval: HebyPreparedApproval): string {
  return JSON.stringify([
    approval.presentationId,
    approval.intentId,
    approval.context.contextId,
    normalizeHebyPreparedItems(approval.items).map(hebyPreparedItemKey),
    [approval.termination.authorityBasis, approval.termination.terminatesAtDirector],
  ]);
}
