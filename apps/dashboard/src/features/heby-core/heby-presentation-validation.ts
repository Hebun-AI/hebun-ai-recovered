/**
 * Heby Core — presentation and explanation validation (Phase 3, Presentation and Explanation).
 *
 * Validates the STRUCTURAL and CONSTITUTIONAL integrity of a proposed presentation and of
 * a prepared presentation: the bound context is a valid Phase 2 binding; every element is
 * of a known kind, presentable (never protected), grounded in admitted inputs, honestly
 * marked (uncertainty carried where confidence requires it), and uniquely identified;
 * every explanation entry is of a known facet, non-empty, and attributable to admitted
 * sources. This is a plain, deterministic structural check — NOT reasoning, NOT invention,
 * NOT a decision. It is fail-closed: any unknown, unattributable, protected, unmarked, or
 * duplicate field blocks the presentation. Nothing is asserted beyond its declared
 * confidence, and protected information is never exposed.
 */

import {
  HEBY_CONFIDENCE_LEVEL_DESCRIPTORS,
  HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS,
  HEBY_EXPLANATION_FACET_DESCRIPTORS,
  HEBY_PRESENTATION_KIND_DESCRIPTORS,
  type HebyExplanationEntry,
  type HebyPresentation,
  type HebyPresentationElement,
  type HebyPresentationRequest,
} from "@/features/heby-core/heby-presentation-types";
import {
  hebyAdmittedIdSet,
  hebyRefsAttributable,
  isHebyElementHonestlyMarked,
  isHebyElementPresentable,
} from "@/features/heby-core/heby-presentation-rules";
import { validateHebyContextBinding } from "@/features/heby-core/heby-input-context-validation";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyPresentationValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** Structural, attribution, and honesty checks over one element. Appends any issues found. */
function collectElementIssues(
  element: HebyPresentationElement,
  admittedIds: ReadonlySet<HebyId>,
  issues: string[],
): void {
  const label = element.elementId;
  if (!isNonEmpty(element.elementId)) issues.push("element declares no elementId");
  if (!isNonEmpty(element.statement)) issues.push(`element '${label}' declares no statement`);

  if (!(element.kind in HEBY_PRESENTATION_KIND_DESCRIPTORS)) {
    issues.push(`element '${label}' declares unknown kind '${element.kind}'`);
  }
  if (!(element.confidence in HEBY_CONFIDENCE_LEVEL_DESCRIPTORS)) {
    issues.push(`element '${label}' declares unknown confidence '${element.confidence}'`);
  }
  if (!(element.classification in HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS)) {
    issues.push(`element '${label}' declares unknown classification '${element.classification}'`);
  } else if (!isHebyElementPresentable(element)) {
    // Protected information is never exposed through a presentation. Fail closed.
    issues.push(`element '${label}' is protected and must never be exposed`);
  }

  // Attribution: every presented element traces to admitted inputs. Fail-closed.
  if (!hebyRefsAttributable(element.evidenceRefs, admittedIds)) {
    issues.push(`element '${label}' is not attributable to admitted inputs`);
  }
  for (const ref of element.evidenceRefs) {
    if (!isNonEmpty(ref)) issues.push(`element '${label}' declares an empty evidence reference`);
  }

  // Honesty: nothing asserted beyond its declared confidence — low/indeterminate must be marked.
  if (
    element.confidence in HEBY_CONFIDENCE_LEVEL_DESCRIPTORS &&
    !isHebyElementHonestlyMarked(element)
  ) {
    issues.push(`element '${label}' asserts '${element.confidence}' confidence without marked uncertainty`);
  }
  for (const statement of element.uncertainty) {
    if (!isNonEmpty(statement)) issues.push(`element '${label}' declares an empty uncertainty statement`);
  }
}

/** Structural and attribution checks over one explanation entry. Appends any issues found. */
function collectExplanationIssues(
  entry: HebyExplanationEntry,
  admittedIds: ReadonlySet<HebyId>,
  issues: string[],
): void {
  if (!(entry.facet in HEBY_EXPLANATION_FACET_DESCRIPTORS)) {
    issues.push(`explanation declares unknown facet '${entry.facet}'`);
  }
  if (entry.statements.length === 0) issues.push(`explanation facet '${entry.facet}' declares no statements`);
  for (const statement of entry.statements) {
    if (!isNonEmpty(statement)) issues.push(`explanation facet '${entry.facet}' declares an empty statement`);
  }
  if (!hebyRefsAttributable(entry.sourceRefs, admittedIds)) {
    issues.push(`explanation facet '${entry.facet}' is not attributable to admitted sources`);
  }
}

/**
 * Validates a proposed presentation request: a valid Phase 2 binding, at least one
 * element, and every element and explanation entry well-formed, presentable, attributable,
 * honestly marked, and uniquely identified. Fail-closed: any issue blocks the presentation.
 */
export function validateHebyPresentationRequest(
  request: HebyPresentationRequest,
): HebyPresentationValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.presentationId)) issues.push("request declares no presentationId");

  const bindingValidation = validateHebyContextBinding(request.binding);
  if (!bindingValidation.ok) {
    for (const issue of bindingValidation.issues) issues.push(`binding: ${issue}`);
  }

  const admittedIds = hebyAdmittedIdSet(request.binding.inputs);

  if (request.elements.length === 0) issues.push("request declares no presentation elements");

  const elementIds = new Set<string>();
  for (const element of request.elements) {
    collectElementIssues(element, admittedIds, issues);
    if (elementIds.has(element.elementId)) {
      issues.push(`element id '${element.elementId}' is declared more than once`);
    }
    elementIds.add(element.elementId);
  }

  const facets = new Set<string>();
  for (const entry of request.explanation) {
    collectExplanationIssues(entry, admittedIds, issues);
    if (facets.has(entry.facet)) {
      issues.push(`explanation facet '${entry.facet}' is declared more than once`);
    }
    facets.add(entry.facet);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared presentation: a valid bound context, and every element presentable,
 * attributable, honestly marked, and uniquely identified, with unique explanation facets.
 * Defensive, post-composition, and fail-closed.
 */
export function validateHebyPresentation(
  presentation: HebyPresentation,
  admittedIds: ReadonlySet<HebyId>,
): HebyPresentationValidation {
  const issues: string[] = [];

  if (!isNonEmpty(presentation.presentationId)) issues.push("presentation declares no presentationId");
  if (!isNonEmpty(presentation.requestId)) issues.push("presentation declares no requestId");
  if (presentation.elements.length === 0) issues.push("presentation declares no elements");

  const elementIds = new Set<string>();
  for (const element of presentation.elements) {
    if (!isHebyElementPresentable(element)) {
      issues.push(`element '${element.elementId}' is protected and must never be exposed`);
    }
    if (!hebyRefsAttributable(element.evidenceRefs, admittedIds)) {
      issues.push(`element '${element.elementId}' is not attributable to admitted inputs`);
    }
    if (!isHebyElementHonestlyMarked(element)) {
      issues.push(`element '${element.elementId}' is not honestly marked for its confidence`);
    }
    if (elementIds.has(element.elementId)) {
      issues.push(`element id '${element.elementId}' appears more than once`);
    }
    elementIds.add(element.elementId);
  }

  const facets = new Set<string>();
  for (const entry of presentation.explanation) {
    if (!hebyRefsAttributable(entry.sourceRefs, admittedIds)) {
      issues.push(`explanation facet '${entry.facet}' is not attributable to admitted sources`);
    }
    if (facets.has(entry.facet)) {
      issues.push(`explanation facet '${entry.facet}' appears more than once`);
    }
    facets.add(entry.facet);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical presentation is deep-frozen: the presentation, its context,
 * its carried admitted inputs and each input's provenance, its element list and each
 * element's reference and uncertainty lists, and its explanation list and each entry's
 * statement and source lists are all immutable. Defensive, post-normalization, and
 * fail-closed.
 */
export function verifyHebyPresentationFrozen(
  presentation: HebyPresentation,
): HebyPresentationValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(presentation)) issues.push("presentation is not frozen");
  if (!Object.isFrozen(presentation.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(presentation.inputs)) issues.push("carried inputs are not frozen");
  for (const carried of presentation.inputs) {
    if (!Object.isFrozen(carried)) issues.push(`carried input '${carried.inputId}' is not frozen`);
    if (!Object.isFrozen(carried.provenance)) issues.push(`carried input '${carried.inputId}' provenance is not frozen`);
  }
  if (!Object.isFrozen(presentation.elements)) issues.push("elements are not frozen");
  for (const element of presentation.elements) {
    if (!Object.isFrozen(element)) issues.push(`element '${element.elementId}' is not frozen`);
    if (!Object.isFrozen(element.evidenceRefs)) issues.push(`element '${element.elementId}' evidenceRefs are not frozen`);
    if (!Object.isFrozen(element.uncertainty)) issues.push(`element '${element.elementId}' uncertainty is not frozen`);
  }
  if (!Object.isFrozen(presentation.explanation)) issues.push("explanation is not frozen");
  for (const entry of presentation.explanation) {
    if (!Object.isFrozen(entry)) issues.push(`explanation facet '${entry.facet}' is not frozen`);
    if (!Object.isFrozen(entry.statements)) issues.push(`explanation facet '${entry.facet}' statements are not frozen`);
    if (!Object.isFrozen(entry.sourceRefs)) issues.push(`explanation facet '${entry.facet}' sourceRefs are not frozen`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
