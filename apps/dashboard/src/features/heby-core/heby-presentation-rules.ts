/**
 * Heby Core — presentation and explanation rules (Phase 3, Presentation and Explanation).
 *
 * Pure, deterministic lookups and projections over Heby's presentation-kind, confidence,
 * classification, and explanation-facet descriptor tables, plus the fail-closed checks
 * that an element is presentable (not protected) and attributable (grounded in admitted
 * inputs). These answer plain questions — is this a known kind, is this element
 * presentable, does this element trace to admitted inputs — and project over elements. NO
 * interface behaviour beyond rendering support, NO invention, NO reasoning, NO decision,
 * NO AI, NO mutation — only table reads and pure, repeatable projections.
 *
 * Canonical ordinals here order categories for stable display only. They are never a
 * rank, score, priority, or confidence, and confidence is never used to order elements.
 */

import {
  HEBY_CONFIDENCE_LEVEL_DESCRIPTORS,
  HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS,
  HEBY_EXPLANATION_FACET_DESCRIPTORS,
  HEBY_PRESENTATION_KIND_DESCRIPTORS,
  type HebyConfidenceLevel,
  type HebyConfidenceLevelDescriptor,
  type HebyElementClassification,
  type HebyElementClassificationDescriptor,
  type HebyExplanationFacet,
  type HebyExplanationFacetDescriptor,
  type HebyPresentationElement,
  type HebyPresentationKind,
  type HebyPresentationKindDescriptor,
} from "@/features/heby-core/heby-presentation-types";
import type { HebyAdmittedInput } from "@/features/heby-core/heby-input-context-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared presentation kind. Read-only table check. */
export function isHebyPresentationKind(value: string): value is HebyPresentationKind {
  return Object.prototype.hasOwnProperty.call(HEBY_PRESENTATION_KIND_DESCRIPTORS, value);
}

/** True when a string is a declared confidence level. Read-only table check. */
export function isHebyConfidenceLevel(value: string): value is HebyConfidenceLevel {
  return Object.prototype.hasOwnProperty.call(HEBY_CONFIDENCE_LEVEL_DESCRIPTORS, value);
}

/** True when a string is a declared element classification. Read-only table check. */
export function isHebyElementClassification(value: string): value is HebyElementClassification {
  return Object.prototype.hasOwnProperty.call(HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS, value);
}

/** True when a string is a declared explanation facet. Read-only table check. */
export function isHebyExplanationFacet(value: string): value is HebyExplanationFacet {
  return Object.prototype.hasOwnProperty.call(HEBY_EXPLANATION_FACET_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a presentation kind. Read-only projection. */
export function hebyPresentationKindDescriptorOf(
  kind: HebyPresentationKind,
): HebyPresentationKindDescriptor {
  return HEBY_PRESENTATION_KIND_DESCRIPTORS[kind];
}

/** The canonical descriptor for a confidence level. Read-only projection. */
export function hebyConfidenceLevelDescriptorOf(
  level: HebyConfidenceLevel,
): HebyConfidenceLevelDescriptor {
  return HEBY_CONFIDENCE_LEVEL_DESCRIPTORS[level];
}

/** The canonical descriptor for an element classification. Read-only projection. */
export function hebyElementClassificationDescriptorOf(
  classification: HebyElementClassification,
): HebyElementClassificationDescriptor {
  return HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS[classification];
}

/** The canonical descriptor for an explanation facet. Read-only projection. */
export function hebyExplanationFacetDescriptorOf(
  facet: HebyExplanationFacet,
): HebyExplanationFacetDescriptor {
  return HEBY_EXPLANATION_FACET_DESCRIPTORS[facet];
}

// --- Canonical ordinals ------------------------------------------------------

/** The fixed canonical display order of a presentation kind. Ordinal only — not a rank. */
export function hebyPresentationKindOrder(kind: HebyPresentationKind): number {
  return HEBY_PRESENTATION_KIND_DESCRIPTORS[kind].order;
}

/** The fixed canonical order of an explanation facet. Ordinal only — not a rank. */
export function hebyExplanationFacetOrder(facet: HebyExplanationFacet): number {
  return HEBY_EXPLANATION_FACET_DESCRIPTORS[facet].order;
}

// --- Presentability and marking ----------------------------------------------

/** True when an element's classification permits exposure through a presentation. */
export function isHebyElementPresentable(element: HebyPresentationElement): boolean {
  const descriptor = HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS[element.classification];
  return descriptor !== undefined && descriptor.presentable === true;
}

/** Whether an element at its confidence level must carry marked uncertainty. */
export function hebyConfidenceRequiresUncertainty(level: HebyConfidenceLevel): boolean {
  return HEBY_CONFIDENCE_LEVEL_DESCRIPTORS[level].requiresUncertainty === true;
}

/**
 * True when an element is honestly marked: if its confidence level requires marked
 * uncertainty, it carries at least one uncertainty statement. Enforces "nothing asserted
 * as truth beyond its declared confidence."
 */
export function isHebyElementHonestlyMarked(element: HebyPresentationElement): boolean {
  if (!hebyConfidenceRequiresUncertainty(element.confidence)) return true;
  return element.uncertainty.length > 0;
}

// --- Attribution -------------------------------------------------------------

/**
 * True when every reference in a set is present among the admitted input identities —
 * the element or explanation entry is fully attributable to admitted inputs. Fail-closed:
 * an empty reference set, or any reference not admitted, makes it unattributable.
 */
export function hebyRefsAttributable(
  refs: readonly HebyId[],
  admittedIds: ReadonlySet<HebyId>,
): boolean {
  if (refs.length === 0) return false;
  for (const ref of refs) {
    if (!admittedIds.has(ref)) return false;
  }
  return true;
}

/** The set of admitted input identities available for attribution. Read-only projection. */
export function hebyAdmittedIdSet(inputs: readonly HebyAdmittedInput[]): ReadonlySet<HebyId> {
  const ids = new Set<HebyId>();
  for (const input of inputs) ids.add(input.inputId);
  return ids;
}

// --- Projections -------------------------------------------------------------

/** The presented elements of one kind, in declared order. Read-only projection. */
export function hebyElementsOfKind(
  elements: readonly HebyPresentationElement[],
  kind: HebyPresentationKind,
): readonly HebyPresentationElement[] {
  return elements.filter((element) => element.kind === kind);
}

/** Every declared presentation kind, in canonical display order. Deterministic. */
export function allHebyPresentationKinds(): readonly HebyPresentationKind[] {
  return (Object.keys(HEBY_PRESENTATION_KIND_DESCRIPTORS) as HebyPresentationKind[]).sort(
    (left, right) => hebyPresentationKindOrder(left) - hebyPresentationKindOrder(right),
  );
}

/** Every declared explanation facet, in canonical order. Deterministic. */
export function allHebyExplanationFacets(): readonly HebyExplanationFacet[] {
  return (Object.keys(HEBY_EXPLANATION_FACET_DESCRIPTORS) as HebyExplanationFacet[]).sort(
    (left, right) => hebyExplanationFacetOrder(left) - hebyExplanationFacetOrder(right),
  );
}
