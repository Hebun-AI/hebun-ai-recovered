/**
 * Heby Core — grounding normalization (Phase 4, Grounding and Anti-Hallucination).
 *
 * Deterministically canonicalizes a grounded presentation:
 *   - grounded elements are de-duplicated and canonically ordered (via the Phase 3
 *     element normalizer) — arrangement only, never a rank, score, or priority,
 *   - grounding traces are de-duplicated by element identity and ordered, their settled
 *     source references de-duplicated and ordered,
 *   - withheld elements are de-duplicated by element identity and ordered by withhold-reason
 *     ordinal then element identity, each element canonicalized and its reason carried
 *     UNCHANGED,
 *   - explanation, admitted inputs, and bound context are canonicalized via their owning
 *     phase normalizers, unchanged in meaning,
 *   - the whole grounded presentation is emitted immutable and deep-frozen.
 *
 * Pure canonical normalization — NO content generation, NO reasoning, NO mutation of any
 * preserved value, and NO change of semantic meaning. Ordering and de-duplication happen by
 * canonical ordinal or by text key only. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe. Normalization is idempotent: the canonical form of
 * a canonical grounded presentation is itself.
 */

import {
  type CanonicalHebyGroundedPresentation,
  type HebyGroundedPresentation,
  type HebyGroundingTrace,
  type HebyWithheldElement,
} from "@/features/heby-core/heby-grounding-types";
import { hebyWithholdReasonOrder } from "@/features/heby-core/heby-grounding-rules";
import {
  hebyAdmittedInputKey,
  normalizeHebyDeclaredContext,
  normalizeHebyInputs,
} from "@/features/heby-core/heby-input-context-normalization";
import {
  hebyExplanationEntryKey,
  hebyPresentationElementKey,
  normalizeHebyElements,
  normalizeHebyExplanation,
} from "@/features/heby-core/heby-presentation-normalization";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeRefs(refs: readonly HebyId[]): readonly HebyId[] {
  const seen = new Set<HebyId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** De-duplicates traces by element identity (first wins) and totally orders them by identity. */
export function normalizeHebyTraces(
  traces: readonly HebyGroundingTrace[],
): readonly HebyGroundingTrace[] {
  const byId = new Map<HebyId, HebyGroundingTrace>();
  for (const trace of traces) {
    if (!byId.has(trace.elementId)) byId.set(trace.elementId, trace);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.elementId, right.elementId))
    .map((trace) =>
      Object.freeze({
        elementId: trace.elementId,
        settledSourceRefs: Object.freeze(normalizeRefs(trace.settledSourceRefs)),
      }),
    );
}

/**
 * De-duplicates withheld elements by element identity (first wins) and totally orders them
 * by withhold-reason ordinal, then by element identity. Each element is canonicalized; the
 * reason is carried UNCHANGED; each entry is frozen.
 */
export function normalizeHebyWithheld(
  withheld: readonly HebyWithheldElement[],
): readonly HebyWithheldElement[] {
  const byId = new Map<HebyId, HebyWithheldElement>();
  for (const entry of withheld) {
    if (!byId.has(entry.element.elementId)) byId.set(entry.element.elementId, entry);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const byReason = hebyWithholdReasonOrder(left.reason) - hebyWithholdReasonOrder(right.reason);
      return byReason !== 0 ? byReason : compareStrings(left.element.elementId, right.element.elementId);
    })
    .map((entry) =>
      Object.freeze({
        element: normalizeHebyElements([entry.element])[0],
        reason: entry.reason,
      }),
    );
}

/** An unambiguous, text-safe key for one grounding trace. */
export function hebyGroundingTraceKey(trace: HebyGroundingTrace): string {
  return JSON.stringify([trace.elementId, normalizeRefs(trace.settledSourceRefs)]);
}

/** An unambiguous, text-safe key for one withheld element. */
export function hebyWithheldElementKey(entry: HebyWithheldElement): string {
  return JSON.stringify([entry.reason, hebyPresentationElementKey(entry.element)]);
}

/**
 * Canonicalizes a grounded presentation into an immutable, deep-frozen form. Deterministic
 * and idempotent: the same input always produces the same canonical grounded presentation,
 * and the canonical form of a canonical grounded presentation is itself. Elements, traces,
 * withheld entries, explanation, inputs, and context are ordered and canonicalized; no
 * meaning is changed.
 */
export function normalizeHebyGroundedPresentation(
  grounded: HebyGroundedPresentation,
): CanonicalHebyGroundedPresentation {
  return Object.freeze({
    presentationId: grounded.presentationId,
    requestId: grounded.requestId,
    context: normalizeHebyDeclaredContext(grounded.context),
    inputs: Object.freeze(normalizeHebyInputs(grounded.inputs)),
    groundedElements: Object.freeze(normalizeHebyElements(grounded.groundedElements)),
    traces: Object.freeze(normalizeHebyTraces(grounded.traces)),
    withheld: Object.freeze(normalizeHebyWithheld(grounded.withheld)),
    explanation: Object.freeze(normalizeHebyExplanation(grounded.explanation)),
  });
}

/**
 * A canonical, text-safe key for a whole grounded presentation. The same grounded
 * presentation always produces the same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyGroundedPresentationKey(grounded: HebyGroundedPresentation): string {
  return JSON.stringify([
    grounded.presentationId,
    grounded.requestId,
    grounded.context.contextId,
    normalizeHebyInputs(grounded.inputs).map(hebyAdmittedInputKey),
    normalizeHebyElements(grounded.groundedElements).map(hebyPresentationElementKey),
    normalizeHebyTraces(grounded.traces).map(hebyGroundingTraceKey),
    normalizeHebyWithheld(grounded.withheld).map(hebyWithheldElementKey),
    normalizeHebyExplanation(grounded.explanation).map(hebyExplanationEntryKey),
  ]);
}
