/**
 * Heby Core — governance normalization (Phase 7, Governance and Security Constraint Enforcement).
 *
 * Deterministically canonicalizes a gated presentation:
 *   - admitted elements are ordered by presentation kind then identity,
 *   - admitted items are ordered by preparation kind then identity,
 *   - recorded blocks are de-duplicated and ordered by subject kind, then reason, then identity,
 *   - the applicable constraints are de-duplicated and ordered through the Phase 2 normalizer,
 *     carried UNCHANGED in meaning — never authored, waived, or reinterpreted,
 *   - the bound context is canonicalized through the Phase 2 normalizer, unchanged in meaning,
 *   - the isolation scope, admitted elements/items, and blocks are carried UNCHANGED in value,
 *   - the whole gated presentation is emitted immutable and deep-frozen.
 *
 * All ordering is ARRANGEMENT ONLY — never a rank, score, priority, or recommendation. Pure
 * canonical normalization: NO model call, NO decision, NO approval, NO mutation of any preserved
 * value, and NO change of semantic meaning. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe. Normalization is idempotent: the canonical form of a
 * canonical gated presentation is itself.
 */

import {
  type CanonicalHebyGatedPresentation,
  type HebyGatedPresentation,
  type HebyGovernanceBlock,
  type HebyGovernanceScope,
} from "@/features/heby-core/heby-governance-types";
import {
  hebyGovernanceBlockReasonOrder,
  hebyGovernanceSubjectKindOrder,
} from "@/features/heby-core/heby-governance-rules";
import { hebyPresentationKindOrder } from "@/features/heby-core/heby-presentation-rules";
import { hebyPreparationKindOrder } from "@/features/heby-core/heby-approval-rules";
import { normalizeHebyConstraints, normalizeHebyDeclaredContext } from "@/features/heby-core/heby-input-context-normalization";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyPreparedItem } from "@/features/heby-core/heby-approval-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** A canonical, text-safe key for one governance block. */
export function hebyGovernanceBlockKey(block: HebyGovernanceBlock): string {
  return JSON.stringify([block.subjectKind, block.subjectId, block.reason, block.constraintKind]);
}

/** Freezes the isolation scope. Values carried UNCHANGED. */
function freezeScope(scope: HebyGovernanceScope): HebyGovernanceScope {
  return Object.freeze({ tenantId: scope.tenantId, organizationId: scope.organizationId });
}

/**
 * Deep-freezes one admitted element by CLONING it — the element and its reference and
 * uncertainty lists are carried UNCHANGED in value and order. Cloning avoids mutating the
 * caller's object; Phase 7 never assumes upstream frozen-ness and hardens its own output.
 */
function freezeElement(element: HebyPresentationElement): HebyPresentationElement {
  return Object.freeze({
    ...element,
    evidenceRefs: Object.freeze([...element.evidenceRefs]),
    uncertainty: Object.freeze([...element.uncertainty]),
  });
}

/**
 * Deep-freezes one admitted item by CLONING it — the item and its subject and consequence
 * lists are carried UNCHANGED in value and order. Cloning avoids mutating the caller's object.
 */
function freezeItem(item: HebyPreparedItem): HebyPreparedItem {
  return Object.freeze({
    ...item,
    subjectRefs: Object.freeze([...item.subjectRefs]),
    consequences: Object.freeze([...item.consequences]),
  });
}

/** Orders admitted elements by presentation kind then identity — arrangement only. Deep-frozen. */
function orderElements(elements: readonly HebyPresentationElement[]): readonly HebyPresentationElement[] {
  return [...elements]
    .sort((left, right) => {
      const byKind = hebyPresentationKindOrder(left.kind) - hebyPresentationKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.elementId, right.elementId);
    })
    .map(freezeElement);
}

/** Orders admitted items by preparation kind then identity — arrangement only. Deep-frozen. */
function orderItems(items: readonly HebyPreparedItem[]): readonly HebyPreparedItem[] {
  return [...items]
    .sort((left, right) => {
      const byKind = hebyPreparationKindOrder(left.kind) - hebyPreparationKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.itemId, right.itemId);
    })
    .map(freezeItem);
}

/** De-duplicates blocks by key and orders them by subject kind, then reason, then identity. */
function orderBlocks(blocks: readonly HebyGovernanceBlock[]): readonly HebyGovernanceBlock[] {
  const byKey = new Map<string, HebyGovernanceBlock>();
  for (const block of blocks) {
    const key = hebyGovernanceBlockKey(block);
    if (!byKey.has(key)) byKey.set(key, Object.freeze({ ...block }));
  }
  return [...byKey.values()].sort((left, right) => {
    const bySubject = hebyGovernanceSubjectKindOrder(left.subjectKind) - hebyGovernanceSubjectKindOrder(right.subjectKind);
    if (bySubject !== 0) return bySubject;
    const byReason = hebyGovernanceBlockReasonOrder(left.reason) - hebyGovernanceBlockReasonOrder(right.reason);
    if (byReason !== 0) return byReason;
    return compareStrings(left.subjectId, right.subjectId);
  });
}

/**
 * Canonicalizes a gated presentation into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical gated presentation, and the
 * canonical form of a canonical gated presentation is itself. Admitted elements, admitted items,
 * blocks, and constraints are ordered; the context and scope are canonicalized; identities and
 * classifications are carried UNCHANGED.
 */
export function normalizeHebyGatedPresentation(
  gated: HebyGatedPresentation,
): CanonicalHebyGatedPresentation {
  return Object.freeze({
    presentationId: gated.presentationId,
    intentId: gated.intentId,
    scope: freezeScope(gated.scope),
    context: normalizeHebyDeclaredContext(gated.context),
    constraints: Object.freeze(normalizeHebyConstraints(gated.constraints)),
    admittedElements: Object.freeze(orderElements(gated.admittedElements)),
    admittedItems: Object.freeze(orderItems(gated.admittedItems)),
    blocks: Object.freeze(orderBlocks(gated.blocks)),
  });
}

/**
 * A canonical, text-safe key for a whole gated presentation. The same gated presentation always
 * produces the same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyGatedPresentationKey(gated: HebyGatedPresentation): string {
  return JSON.stringify([
    gated.presentationId,
    gated.intentId,
    [gated.scope.tenantId, gated.scope.organizationId],
    gated.context.contextId,
    normalizeHebyConstraints(gated.constraints).map((constraint) => [constraint.constraintKind, constraint.constraintId, constraint.statement]),
    orderElements(gated.admittedElements).map((element) => element.elementId),
    orderItems(gated.admittedItems).map((item) => item.itemId),
    orderBlocks(gated.blocks).map(hebyGovernanceBlockKey),
  ]);
}
