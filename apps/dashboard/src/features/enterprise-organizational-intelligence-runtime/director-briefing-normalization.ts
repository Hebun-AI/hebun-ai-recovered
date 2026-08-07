/**
 * Enterprise Organizational Intelligence Runtime — Director Briefing normalization (Phase 8).
 *
 * Deterministically canonicalizes a Director Briefing:
 *   - each item's evidence, learning, optimization, awareness, and evolution references are
 *     de-duplicated and totally ordered,
 *   - items are de-duplicated by binding identity and ordered by binding identity,
 *   - the governance view's constraint, restriction, and pending-decision lists are
 *     de-duplicated and totally ordered,
 *   - provenance, explainability, confidence, uncertainty, and lifecycle are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole briefing is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO reasoning, NO confidence
 * calculation, NO uncertainty suppression, NO prioritization, NO ranking, NO mutation of any
 * preserved value. Ordering and de-duplication happen by canonical key only. Keys use JSON
 * encoding so they are unambiguous, text-safe, UTF-8 stable, and NUL-safe. Ordering by binding
 * identity is canonical arrangement, never a ranking or priority.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalDirectorBriefing,
  DirectorBriefing,
  DirectorBriefingGovernance,
  DirectorBriefingItem,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of references or identities. */
export function normalizeReferenceIds(refs: readonly RuntimeId[]): readonly RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** An unambiguous, text-safe key for one briefing item. */
export function briefingItemKey(item: DirectorBriefingItem): string {
  return JSON.stringify([
    item.bindingId,
    item.sourceKind,
    item.sourceCandidateId,
    item.statement,
    normalizeReferenceIds(item.evidenceRefs),
    normalizeReferenceIds(item.learningRefs),
    normalizeReferenceIds(item.optimizationRefs),
    normalizeReferenceIds(item.awarenessRefs),
    normalizeReferenceIds(item.evolutionRefs),
    item.provenance.version,
    item.provenance.lifecycle,
    item.lifecycle,
    item.confidence.level,
    item.approval.state,
  ]);
}

/**
 * Canonicalizes a briefing item: its reference lists de-duplicated and ordered, every other
 * field — identity, kind, statement, provenance, explainability, confidence, lifecycle,
 * approval — carried UNCHANGED. Frozen.
 */
export function normalizeBriefingItem(item: DirectorBriefingItem): DirectorBriefingItem {
  return Object.freeze({
    bindingId: item.bindingId,
    sourceKind: item.sourceKind,
    sourceCandidateId: item.sourceCandidateId,
    statement: item.statement,
    provenance: item.provenance,
    explainability: item.explainability,
    confidence: item.confidence,
    evidenceRefs: normalizeReferenceIds(item.evidenceRefs),
    learningRefs: normalizeReferenceIds(item.learningRefs),
    optimizationRefs: normalizeReferenceIds(item.optimizationRefs),
    awarenessRefs: normalizeReferenceIds(item.awarenessRefs),
    evolutionRefs: normalizeReferenceIds(item.evolutionRefs),
    lifecycle: item.lifecycle,
    approval: item.approval,
  });
}

/**
 * De-duplicates items by binding identity (first occurrence wins) and orders them by binding
 * identity. Each item is canonicalized. Deterministic — shuffled inputs produce identical
 * canonical output. Ordering is canonical arrangement, never a ranking or priority.
 */
export function normalizeBriefingItems(
  items: readonly DirectorBriefingItem[],
): readonly DirectorBriefingItem[] {
  const byId = new Map<RuntimeId, DirectorBriefingItem>();
  for (const item of items) {
    if (!byId.has(item.bindingId)) byId.set(item.bindingId, item);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.bindingId, right.bindingId))
    .map(normalizeBriefingItem);
}

/**
 * Canonicalizes the descriptive governance view: its constraint, restriction, and
 * pending-decision lists de-duplicated and ordered, the immutable marker and approval carried
 * UNCHANGED. Frozen.
 */
export function normalizeGovernance(
  governance: DirectorBriefingGovernance,
): DirectorBriefingGovernance {
  return Object.freeze({
    constraints: normalizeReferenceIds(governance.constraints),
    heldImmutable: true,
    restrictions: Object.freeze([...new Set(governance.restrictions)].sort(compareStrings)),
    approval: governance.approval,
    pendingDirectorDecisions: normalizeReferenceIds(governance.pendingDirectorDecisions),
  });
}

/** A canonical key for a briefing: its request identity, approval state, governance view, and ordered item keys. */
export function canonicalDirectorBriefingKey(briefing: CanonicalDirectorBriefing): string {
  return JSON.stringify([
    briefing.requestId,
    briefing.approval.state,
    briefing.governance.constraints,
    briefing.governance.restrictions,
    briefing.governance.pendingDirectorDecisions,
    briefing.items.map(briefingItemKey),
  ]);
}

/**
 * Canonicalizes a Director Briefing into an immutable, frozen form. Deterministic: the same
 * input always produces the same canonical briefing. Items and the governance view are
 * canonicalized and ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeDirectorBriefing(briefing: DirectorBriefing): CanonicalDirectorBriefing {
  return Object.freeze({
    requestId: briefing.requestId,
    items: Object.freeze(normalizeBriefingItems(briefing.items)),
    governance: normalizeGovernance(briefing.governance),
    approval: briefing.approval,
  });
}
