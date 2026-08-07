/**
 * Heby Core — grounding rules (Phase 4, Grounding and Anti-Hallucination).
 *
 * Pure, deterministic lookups and the fail-closed classification of one presented element
 * as grounded (traceable to a settled admitted source) or withheld (with an explicit
 * failure reason). These answer plain questions — is this a known status, does this element
 * trace to settled sources, why is it unsupported — and index admitted inputs by identity.
 * NO content generation, NO reasoning, NO retrieval, NO inference, NO AI, NO mutation, and
 * NO invention of evidence to satisfy grounding — only table reads and pure, repeatable
 * classification. Ordinals order status/reason for stable arrangement only; they are never a
 * rank, score, priority, or recommendation.
 */

import {
  HEBY_GROUNDING_STATUS_DESCRIPTORS,
  HEBY_WITHHOLD_REASON_DESCRIPTORS,
  type HebyGroundingStatus,
  type HebyGroundingStatusDescriptor,
  type HebyWithholdReason,
  type HebyWithholdReasonDescriptor,
} from "@/features/heby-core/heby-grounding-types";
import type { HebyAdmittedInput } from "@/features/heby-core/heby-input-context-types";
import { isHebySourceLifecycleAdmissible } from "@/features/heby-core/heby-input-context-rules";
import { isHebyElementPresentable } from "@/features/heby-core/heby-presentation-rules";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared grounding status. Read-only table check. */
export function isHebyGroundingStatus(value: string): value is HebyGroundingStatus {
  return Object.prototype.hasOwnProperty.call(HEBY_GROUNDING_STATUS_DESCRIPTORS, value);
}

/** True when a string is a declared withhold reason. Read-only table check. */
export function isHebyWithholdReason(value: string): value is HebyWithholdReason {
  return Object.prototype.hasOwnProperty.call(HEBY_WITHHOLD_REASON_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a grounding status. Read-only projection. */
export function hebyGroundingStatusDescriptorOf(
  status: HebyGroundingStatus,
): HebyGroundingStatusDescriptor {
  return HEBY_GROUNDING_STATUS_DESCRIPTORS[status];
}

/** The canonical descriptor for a withhold reason. Read-only projection. */
export function hebyWithholdReasonDescriptorOf(reason: HebyWithholdReason): HebyWithholdReasonDescriptor {
  return HEBY_WITHHOLD_REASON_DESCRIPTORS[reason];
}

/** The fixed canonical order of a withhold reason. Ordinal only — not a rank. */
export function hebyWithholdReasonOrder(reason: HebyWithholdReason): number {
  return HEBY_WITHHOLD_REASON_DESCRIPTORS[reason].order;
}

// --- Admitted-input indexing -------------------------------------------------

/** Indexes admitted inputs by identity. First occurrence of an id wins. Read-only. */
export function hebyAdmittedInputIndex(
  inputs: readonly HebyAdmittedInput[],
): ReadonlyMap<HebyId, HebyAdmittedInput> {
  const index = new Map<HebyId, HebyAdmittedInput>();
  for (const input of inputs) {
    if (!index.has(input.inputId)) index.set(input.inputId, input);
  }
  return index;
}

/** True when one admitted input is a settled, eligible source fit to ground an element. */
export function isHebySettledSource(input: HebyAdmittedInput): boolean {
  return isHebySourceLifecycleAdmissible(input.provenance.lifecycle) && input.eligible === true;
}

// --- Classification ----------------------------------------------------------

/**
 * The fail-closed classification of one element: grounded, with the settled source ids that
 * support it; or withheld, with the explicit reason. Never grounded by invention.
 */
export type HebyElementGrounding =
  | { readonly status: "grounded"; readonly settledSourceRefs: readonly HebyId[] }
  | { readonly status: "withheld"; readonly reason: HebyWithholdReason };

/**
 * Classifies one presented element against an admitted-input index. Fail-closed and total:
 * a protected element, an empty basis, a dangling reference, a non-settled source, or an
 * ineligible source each yields a withheld classification with its explicit reason; only an
 * element whose every reference resolves to a settled, eligible source is grounded. The
 * first failure, in a fixed order, determines the reason. No evidence is invented.
 */
export function classifyHebyElementGrounding(
  element: HebyPresentationElement,
  index: ReadonlyMap<HebyId, HebyAdmittedInput>,
): HebyElementGrounding {
  if (!isHebyElementPresentable(element)) {
    return { status: "withheld", reason: "protected" };
  }
  if (element.evidenceRefs.length === 0) {
    return { status: "withheld", reason: "no-basis" };
  }
  for (const ref of element.evidenceRefs) {
    const input = index.get(ref);
    if (input === undefined) return { status: "withheld", reason: "dangling-reference" };
    if (!isHebySourceLifecycleAdmissible(input.provenance.lifecycle)) {
      return { status: "withheld", reason: "unsettled-source" };
    }
    if (input.eligible !== true) return { status: "withheld", reason: "ineligible-source" };
  }
  return { status: "grounded", settledSourceRefs: element.evidenceRefs };
}

/** True when an element traces to settled sources under the given index. Read-only. */
export function isHebyElementGrounded(
  element: HebyPresentationElement,
  index: ReadonlyMap<HebyId, HebyAdmittedInput>,
): boolean {
  return classifyHebyElementGrounding(element, index).status === "grounded";
}

// --- Complete canonical lists ------------------------------------------------

/** Every declared grounding status, in canonical order. Deterministic. */
export function allHebyGroundingStatuses(): readonly HebyGroundingStatus[] {
  return (Object.keys(HEBY_GROUNDING_STATUS_DESCRIPTORS) as HebyGroundingStatus[]).sort(
    (left, right) =>
      HEBY_GROUNDING_STATUS_DESCRIPTORS[left].order - HEBY_GROUNDING_STATUS_DESCRIPTORS[right].order,
  );
}

/** Every declared withhold reason, in canonical order. Deterministic. */
export function allHebyWithholdReasons(): readonly HebyWithholdReason[] {
  return (Object.keys(HEBY_WITHHOLD_REASON_DESCRIPTORS) as HebyWithholdReason[]).sort(
    (left, right) => hebyWithholdReasonOrder(left) - hebyWithholdReasonOrder(right),
  );
}
