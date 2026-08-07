/**
 * Heby Core — grounding validation (Phase 4, Grounding and Anti-Hallucination).
 *
 * Validates the STRUCTURAL and grounding integrity of a proposed grounding request and of a
 * produced grounded presentation: the request's carried admitted inputs and bound context
 * form a valid Phase 2 binding; every grounded element traces to a settled source (a
 * non-empty trace whose every reference resolves to a settled, eligible admitted input);
 * every withheld element carries a known fail-closed reason; grounded and withheld sets are
 * disjoint; explanation entries are attributable to settled sources. This is a plain,
 * deterministic structural check — NOT reasoning, NOT invention, NOT content generation. It
 * is fail-closed: any unsettled, dangling, protected, or unattributable grounding blocks the
 * grounded presentation. No element is ever grounded without a settled-source trace.
 */

import {
  HEBY_WITHHOLD_REASON_DESCRIPTORS,
  type HebyGroundedPresentation,
  type HebyGroundingRequest,
} from "@/features/heby-core/heby-grounding-types";
import {
  hebyAdmittedInputIndex,
  isHebyElementGrounded,
  isHebySettledSource,
} from "@/features/heby-core/heby-grounding-rules";
import { isHebyElementPresentable } from "@/features/heby-core/heby-presentation-rules";
import type { HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyGroundingValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** Structural checks over the bound context. Appends any issues found. Authority is required. */
function collectContextIssues(context: HebyDeclaredContext, issues: string[]): void {
  if (!isNonEmpty(context.contextId)) issues.push("context declares no contextId");
  if (!isNonEmpty(context.authorityBasis)) issues.push("context declares no authority basis");
  if (!isNonEmpty(context.organizationId)) issues.push("context declares no organizationId");
  if (!isNonEmpty(context.tenantId)) issues.push("context declares no tenantId");
}

/**
 * Validates a proposed grounding request: a well-formed presentation identity, an authorized
 * bound context, and structurally well-formed carried inputs. Fail-closed on a missing
 * identity, an unauthorized context, or a malformed input. It deliberately does NOT reject a
 * non-settled input here — settledness is decided per element during grounding, so an
 * unsettled or ineligible source causes the referencing element to be withheld, never
 * silently grounded.
 */
export function validateHebyGroundingRequest(request: HebyGroundingRequest): HebyGroundingValidation {
  const issues: string[] = [];
  const presentation = request.presentation;

  if (!isNonEmpty(presentation.presentationId)) issues.push("presentation declares no presentationId");
  if (!isNonEmpty(presentation.requestId)) issues.push("presentation declares no requestId");

  collectContextIssues(presentation.context, issues);

  const inputIds = new Set<string>();
  for (const input of presentation.inputs) {
    if (!isNonEmpty(input.inputId)) issues.push("an admitted input declares no inputId");
    if (!isNonEmpty(input.sourceId)) issues.push(`admitted input '${input.inputId}' declares no sourceId`);
    if (inputIds.has(input.inputId)) issues.push(`admitted input id '${input.inputId}' appears more than once`);
    inputIds.add(input.inputId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a produced grounded presentation. Fail-closed: every grounded element must be
 * presentable and independently re-verified as grounded against the settled admitted index;
 * every grounded element must have a trace with a non-empty settled-source reference set,
 * and every trace must belong to a grounded element; grounded and withheld identities must be
 * disjoint; withheld reasons must be known; explanation entries must be attributable to
 * settled sources.
 */
export function validateHebyGroundedPresentation(
  grounded: HebyGroundedPresentation,
): HebyGroundingValidation {
  const issues: string[] = [];

  if (!isNonEmpty(grounded.presentationId)) issues.push("grounded presentation declares no presentationId");
  if (!isNonEmpty(grounded.requestId)) issues.push("grounded presentation declares no requestId");

  const index = hebyAdmittedInputIndex(grounded.inputs);
  const settledIds = new Set<HebyId>();
  for (const input of grounded.inputs) {
    if (isHebySettledSource(input)) settledIds.add(input.inputId);
  }

  // Grounded elements: presentable, independently grounded, unique.
  const groundedIds = new Set<HebyId>();
  for (const element of grounded.groundedElements) {
    if (!isHebyElementPresentable(element)) {
      issues.push(`grounded element '${element.elementId}' is protected and must never be exposed`);
    }
    if (!isHebyElementGrounded(element, index)) {
      issues.push(`grounded element '${element.elementId}' does not trace to a settled source`);
    }
    if (groundedIds.has(element.elementId)) {
      issues.push(`grounded element id '${element.elementId}' appears more than once`);
    }
    groundedIds.add(element.elementId);
  }

  // Traces: one per grounded element, non-empty, referencing only settled sources.
  const tracedIds = new Set<HebyId>();
  for (const trace of grounded.traces) {
    if (!groundedIds.has(trace.elementId)) {
      issues.push(`trace for '${trace.elementId}' has no grounded element`);
    }
    if (trace.settledSourceRefs.length === 0) {
      issues.push(`trace for '${trace.elementId}' declares no settled-source trace`);
    }
    for (const ref of trace.settledSourceRefs) {
      const input = index.get(ref);
      if (input === undefined || !isHebySettledSource(input)) {
        issues.push(`trace for '${trace.elementId}' references non-settled source '${ref}'`);
      }
    }
    tracedIds.add(trace.elementId);
  }
  for (const id of groundedIds) {
    if (!tracedIds.has(id)) issues.push(`grounded element '${id}' has no settled-source trace`);
  }

  // Withheld elements: known reason, and disjoint from grounded.
  const withheldIds = new Set<HebyId>();
  for (const entry of grounded.withheld) {
    if (!(entry.reason in HEBY_WITHHOLD_REASON_DESCRIPTORS)) {
      issues.push(`withheld element '${entry.element.elementId}' declares unknown reason '${entry.reason}'`);
    }
    if (groundedIds.has(entry.element.elementId)) {
      issues.push(`element '${entry.element.elementId}' is both grounded and withheld`);
    }
    if (withheldIds.has(entry.element.elementId)) {
      issues.push(`withheld element id '${entry.element.elementId}' appears more than once`);
    }
    withheldIds.add(entry.element.elementId);
  }

  // Explanation: attributable to settled sources.
  for (const entry of grounded.explanation) {
    if (entry.sourceRefs.length === 0) {
      issues.push(`explanation facet '${entry.facet}' declares no settled-source basis`);
    }
    for (const ref of entry.sourceRefs) {
      if (!settledIds.has(ref)) {
        issues.push(`explanation facet '${entry.facet}' references non-settled source '${ref}'`);
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical grounded presentation is deep-frozen: the grounded presentation,
 * its context, its inputs and each provenance, its grounded elements and their reference and
 * uncertainty lists, its traces and each trace's source list, its withheld entries and their
 * elements, and its explanation entries and their lists are all immutable. Defensive,
 * post-normalization, and fail-closed.
 */
export function verifyHebyGroundedPresentationFrozen(
  grounded: HebyGroundedPresentation,
): HebyGroundingValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(grounded)) issues.push("grounded presentation is not frozen");
  if (!Object.isFrozen(grounded.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(grounded.inputs)) issues.push("inputs are not frozen");
  for (const input of grounded.inputs) {
    if (!Object.isFrozen(input)) issues.push(`input '${input.inputId}' is not frozen`);
    if (!Object.isFrozen(input.provenance)) issues.push(`input '${input.inputId}' provenance is not frozen`);
  }
  if (!Object.isFrozen(grounded.groundedElements)) issues.push("grounded elements are not frozen");
  for (const element of grounded.groundedElements) {
    if (!Object.isFrozen(element)) issues.push(`grounded element '${element.elementId}' is not frozen`);
    if (!Object.isFrozen(element.evidenceRefs)) issues.push(`grounded element '${element.elementId}' evidenceRefs are not frozen`);
    if (!Object.isFrozen(element.uncertainty)) issues.push(`grounded element '${element.elementId}' uncertainty is not frozen`);
  }
  if (!Object.isFrozen(grounded.traces)) issues.push("traces are not frozen");
  for (const trace of grounded.traces) {
    if (!Object.isFrozen(trace)) issues.push(`trace '${trace.elementId}' is not frozen`);
    if (!Object.isFrozen(trace.settledSourceRefs)) issues.push(`trace '${trace.elementId}' settledSourceRefs are not frozen`);
  }
  if (!Object.isFrozen(grounded.withheld)) issues.push("withheld list is not frozen");
  for (const entry of grounded.withheld) {
    if (!Object.isFrozen(entry)) issues.push(`withheld entry '${entry.element.elementId}' is not frozen`);
    if (!Object.isFrozen(entry.element)) issues.push(`withheld element '${entry.element.elementId}' is not frozen`);
  }
  if (!Object.isFrozen(grounded.explanation)) issues.push("explanation is not frozen");
  for (const entry of grounded.explanation) {
    if (!Object.isFrozen(entry)) issues.push(`explanation facet '${entry.facet}' is not frozen`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
