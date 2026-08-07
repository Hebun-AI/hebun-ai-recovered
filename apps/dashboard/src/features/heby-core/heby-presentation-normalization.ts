/**
 * Heby Core — presentation and explanation normalization (Phase 3, Presentation and Explanation).
 *
 * Deterministically canonicalizes a presentation:
 *   - elements are de-duplicated by identity and totally ordered by presentation-category
 *     ordinal then element identity — NEVER by confidence, and NEVER as a rank or priority,
 *   - each element's evidence references and uncertainty statements are de-duplicated and
 *     ordered; its statement, confidence, and classification are carried UNCHANGED,
 *   - explanation entries are de-duplicated by facet and ordered by facet ordinal, their
 *     statements and source references de-duplicated and ordered,
 *   - the bound context is canonicalized through the Phase 2 normalizer, unchanged in
 *     meaning,
 *   - the whole presentation is emitted immutable and deep-frozen.
 *
 * This is pure canonical normalization — NO invention, NO reasoning, NO decision, NO
 * mutation of any preserved value, and NO change of semantic meaning. Ordering and
 * de-duplication happen by canonical ordinal or by text key only. Keys use JSON encoding
 * so they are unambiguous, text-safe, UTF-8 stable, and NUL-safe. Normalization is
 * idempotent: the canonical form of a canonical presentation is itself.
 */

import {
  type CanonicalHebyPresentation,
  type HebyExplanationEntry,
  type HebyPresentation,
  type HebyPresentationElement,
} from "@/features/heby-core/heby-presentation-types";
import {
  hebyExplanationFacetOrder,
  hebyPresentationKindOrder,
} from "@/features/heby-core/heby-presentation-rules";
import {
  hebyAdmittedInputKey,
  normalizeHebyDeclaredContext,
  normalizeHebyInputs,
} from "@/features/heby-core/heby-input-context-normalization";
import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of identity references. */
function normalizeRefs(refs: readonly HebyId[]): readonly HebyId[] {
  const seen = new Set<HebyId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** De-duplicates and totally orders a set of statements. */
function normalizeStatements(statements: readonly HebyStatement[]): readonly HebyStatement[] {
  const seen = new Set<HebyStatement>();
  for (const statement of statements) seen.add(statement);
  return [...seen].sort(compareStrings);
}

/**
 * De-duplicates elements by identity (first occurrence wins) and totally orders them by
 * presentation-category ordinal, then by element identity. Statement, confidence, and
 * classification are carried UNCHANGED; each element is frozen. Confidence is NEVER an
 * ordering key.
 */
export function normalizeHebyElements(
  elements: readonly HebyPresentationElement[],
): readonly HebyPresentationElement[] {
  const byId = new Map<HebyId, HebyPresentationElement>();
  for (const element of elements) {
    if (!byId.has(element.elementId)) byId.set(element.elementId, element);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const byKind = hebyPresentationKindOrder(left.kind) - hebyPresentationKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.elementId, right.elementId);
    })
    .map((element) =>
      Object.freeze({
        elementId: element.elementId,
        kind: element.kind,
        statement: element.statement,
        evidenceRefs: Object.freeze(normalizeRefs(element.evidenceRefs)),
        confidence: element.confidence,
        uncertainty: Object.freeze(normalizeStatements(element.uncertainty)),
        classification: element.classification,
      }),
    );
}

/**
 * De-duplicates explanation entries by facet (first occurrence wins) and totally orders
 * them by facet ordinal. Each entry's statements and source references are de-duplicated
 * and ordered; each entry is frozen.
 */
export function normalizeHebyExplanation(
  explanation: readonly HebyExplanationEntry[],
): readonly HebyExplanationEntry[] {
  const byFacet = new Map<string, HebyExplanationEntry>();
  for (const entry of explanation) {
    if (!byFacet.has(entry.facet)) byFacet.set(entry.facet, entry);
  }
  return [...byFacet.values()]
    .sort((left, right) => hebyExplanationFacetOrder(left.facet) - hebyExplanationFacetOrder(right.facet))
    .map((entry) =>
      Object.freeze({
        facet: entry.facet,
        statements: Object.freeze(normalizeStatements(entry.statements)),
        sourceRefs: Object.freeze(normalizeRefs(entry.sourceRefs)),
      }),
    );
}

/** An unambiguous, text-safe key for one presentation element. */
export function hebyPresentationElementKey(element: HebyPresentationElement): string {
  return JSON.stringify([
    element.elementId,
    element.kind,
    element.statement,
    normalizeRefs(element.evidenceRefs),
    element.confidence,
    normalizeStatements(element.uncertainty),
    element.classification,
  ]);
}

/** An unambiguous, text-safe key for one explanation entry. */
export function hebyExplanationEntryKey(entry: HebyExplanationEntry): string {
  return JSON.stringify([entry.facet, normalizeStatements(entry.statements), normalizeRefs(entry.sourceRefs)]);
}

/**
 * Canonicalizes a presentation into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical presentation, and the
 * canonical form of a canonical presentation is itself. Elements are ordered by category
 * then identity, explanation by facet; statements, confidence, and classification are
 * carried UNCHANGED. Meaning is never changed.
 */
export function normalizeHebyPresentation(presentation: HebyPresentation): CanonicalHebyPresentation {
  return Object.freeze({
    presentationId: presentation.presentationId,
    requestId: presentation.requestId,
    context: normalizeHebyDeclaredContext(presentation.context),
    inputs: Object.freeze(normalizeHebyInputs(presentation.inputs)),
    elements: Object.freeze(normalizeHebyElements(presentation.elements)),
    explanation: Object.freeze(normalizeHebyExplanation(presentation.explanation)),
  });
}

/**
 * A canonical, text-safe key for a whole presentation: its identity, request identity,
 * bound context identity, ordered element keys, and ordered explanation keys. The same
 * presentation always produces the same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyPresentationKey(presentation: HebyPresentation): string {
  return JSON.stringify([
    presentation.presentationId,
    presentation.requestId,
    presentation.context.contextId,
    normalizeHebyInputs(presentation.inputs).map(hebyAdmittedInputKey),
    normalizeHebyElements(presentation.elements).map(hebyPresentationElementKey),
    normalizeHebyExplanation(presentation.explanation).map(hebyExplanationEntryKey),
  ]);
}
