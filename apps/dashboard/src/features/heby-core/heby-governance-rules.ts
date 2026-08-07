/**
 * Heby Core — governance rules (Phase 7, Governance and Security Constraint Enforcement).
 *
 * Pure, deterministic lookups and projections over the subject-kind and block-reason tables,
 * the isolation scope a declared context binds, and the per-element governance classification
 * that decides whether a rendered element is admitted or blocked. These answer plain questions
 * — is this a known reason, do two surfaces share a tenant and organization, does this element
 * rest on eligible, resolvable evidence, is it protected — and never approve, waive, author,
 * decide, or mutate anything. Only table reads and pure, repeatable projections. Ordinals order
 * kinds and reasons for stable arrangement only; they are never a rank, score, priority, or
 * recommendation.
 */

import {
  HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS,
  HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS,
  type HebyGovernanceBlockReason,
  type HebyGovernanceBlockReasonDescriptor,
  type HebyGovernanceScope,
  type HebyGovernanceSubjectKind,
  type HebyGovernanceSubjectKindDescriptor,
} from "@/features/heby-core/heby-governance-types";
import { isHebyInputAdmissible } from "@/features/heby-core/heby-input-context-rules";
import { isHebyElementPresentable } from "@/features/heby-core/heby-presentation-rules";
import type { HebyAdmittedInput, HebyConstraintKind, HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared governance subject kind. Read-only table check. */
export function isHebyGovernanceSubjectKind(value: string): value is HebyGovernanceSubjectKind {
  return Object.prototype.hasOwnProperty.call(HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS, value);
}

/** True when a string is a declared governance block reason. Read-only table check. */
export function isHebyGovernanceBlockReason(value: string): value is HebyGovernanceBlockReason {
  return Object.prototype.hasOwnProperty.call(HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a governance subject kind. Read-only projection. */
export function hebyGovernanceSubjectKindDescriptorOf(
  subjectKind: HebyGovernanceSubjectKind,
): HebyGovernanceSubjectKindDescriptor {
  return HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS[subjectKind];
}

/** The fixed canonical order of a governance subject kind. Ordinal only — not a rank. */
export function hebyGovernanceSubjectKindOrder(subjectKind: HebyGovernanceSubjectKind): number {
  return HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS[subjectKind].order;
}

/** The canonical descriptor for a governance block reason. Read-only projection. */
export function hebyGovernanceBlockReasonDescriptorOf(
  reason: HebyGovernanceBlockReason,
): HebyGovernanceBlockReasonDescriptor {
  return HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS[reason];
}

/** The fixed canonical order of a governance block reason. Ordinal only — not a rank. */
export function hebyGovernanceBlockReasonOrder(reason: HebyGovernanceBlockReason): number {
  return HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS[reason].order;
}

/** The constraint kind a block reason enforces. Read-only projection. */
export function hebyGovernanceBlockReasonConstraintKind(
  reason: HebyGovernanceBlockReason,
): HebyConstraintKind {
  return HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS[reason].constraintKind;
}

// --- Isolation scope ---------------------------------------------------------

/** The isolation scope a declared context binds: its tenant and organization. Read-only. */
export function hebyGovernanceScopeOf(context: HebyDeclaredContext): HebyGovernanceScope {
  return { tenantId: context.tenantId, organizationId: context.organizationId };
}

/** True when two scopes share both tenant and organization — no isolation boundary is crossed. */
export function hebyScopesMatch(left: HebyGovernanceScope, right: HebyGovernanceScope): boolean {
  return left.tenantId === right.tenantId && left.organizationId === right.organizationId;
}

/**
 * The isolation block reason for a scope mismatch, or null when the scopes match. Tenant
 * isolation is checked before organization isolation — deterministic, fail-closed.
 */
export function hebyScopeMismatchReason(
  left: HebyGovernanceScope,
  right: HebyGovernanceScope,
): HebyGovernanceBlockReason | null {
  if (left.tenantId !== right.tenantId) return "cross-tenant";
  if (left.organizationId !== right.organizationId) return "cross-organization";
  return null;
}

// --- Per-element governance classification ------------------------------------

/**
 * The governance block reason for one rendered element, or null when it is admitted. Checked in
 * fixed order, most-restrictive first: a protected element is blocked (no secret exposure), then
 * an element whose evidence resolves to no admitted input (unresolved evidence), then an element
 * whose evidence resolves to an ineligible admitted input (evidence eligibility). An element with
 * no evidence reference resolves to nothing and is blocked as unresolved — never silently
 * admitted. This does NOT trust upstream grounding; it re-checks independently, fail-closed.
 */
export function hebyClassifyElementGovernance(
  element: HebyPresentationElement,
  inputIndex: ReadonlyMap<HebyId, HebyAdmittedInput>,
): HebyGovernanceBlockReason | null {
  if (!isHebyElementPresentable(element)) return "protected-classification";
  if (element.evidenceRefs.length === 0) return "unresolved-evidence";
  for (const ref of element.evidenceRefs) {
    const input = inputIndex.get(ref);
    if (input === undefined) return "unresolved-evidence";
  }
  for (const ref of element.evidenceRefs) {
    const input = inputIndex.get(ref);
    if (input !== undefined && !isHebyInputAdmissible(input)) return "ineligible-evidence";
  }
  return null;
}

// --- Complete canonical lists ------------------------------------------------

/** Every declared governance subject kind, in canonical order. Deterministic. */
export function allHebyGovernanceSubjectKinds(): readonly HebyGovernanceSubjectKind[] {
  return (Object.keys(HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS) as HebyGovernanceSubjectKind[]).sort(
    (left, right) => hebyGovernanceSubjectKindOrder(left) - hebyGovernanceSubjectKindOrder(right),
  );
}

/** Every declared governance block reason, in canonical order. Deterministic. */
export function allHebyGovernanceBlockReasons(): readonly HebyGovernanceBlockReason[] {
  return (Object.keys(HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS) as HebyGovernanceBlockReason[]).sort(
    (left, right) => hebyGovernanceBlockReasonOrder(left) - hebyGovernanceBlockReasonOrder(right),
  );
}
