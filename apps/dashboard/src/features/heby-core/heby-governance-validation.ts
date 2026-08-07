/**
 * Heby Core — governance validation (Phase 7, Governance and Security Constraint Enforcement).
 *
 * Validates the STRUCTURAL integrity of a gate request and the governance integrity of a
 * produced gated presentation: Heby's identity is intact; the grounded presentation and prepared
 * approval are structurally well-formed (so the gate can independently re-enforce governance over
 * them without trusting upstream conclusions); every recorded block names a known subject, a
 * known reason, and the constraint kind that reason enforces; every admitted element is
 * presentable and rests on eligible, resolvable evidence; every admitted item rests only on
 * admitted elements; and an isolation failure stops the whole surface.
 *
 * This is a plain, deterministic structural check — NOT a model call, NOT reasoning, NOT an
 * approval, NOT a waiver, NOT authorship of a constraint. It is fail-closed: a malformed request,
 * an admitted element that should have been blocked, an item resting on a blocked element, or an
 * isolation failure that did not stop the surface blocks the whole gate. Heby never approves,
 * waives, or authors a constraint here.
 */

import {
  type HebyGatedPresentation,
  type HebyGovernanceGateRequest,
} from "@/features/heby-core/heby-governance-types";
import {
  hebyClassifyElementGovernance,
  hebyGovernanceBlockReasonConstraintKind,
  isHebyGovernanceBlockReason,
  isHebyGovernanceSubjectKind,
} from "@/features/heby-core/heby-governance-rules";
import { validateHebyIdentity } from "@/features/heby-core/heby-identity-validation";
import { isHebyPresentationKind, isHebyElementClassification } from "@/features/heby-core/heby-presentation-rules";
import { isHebyDecisionStateAdmissible, isHebyPreparationKind } from "@/features/heby-core/heby-approval-rules";
import { isHebyConstraintKind } from "@/features/heby-core/heby-input-context-rules";
import type { HebyAdmittedInput } from "@/features/heby-core/heby-input-context-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";
import type { HebyPreparedApproval } from "@/features/heby-core/heby-approval-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyGovernanceValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Structural checks over the grounded presentation the gate will consume. It does NOT re-run
 * Phase 4 grounding — the gate independently governs these elements — but the surface must be
 * well-formed: an authorized bound context, uniquely identified inputs, and elements with a
 * known kind and classification.
 */
function collectGroundedIssues(grounded: HebyGroundedPresentation, issues: string[]): void {
  if (!isNonEmpty(grounded.presentationId)) issues.push("grounded declares no presentationId");
  if (!isNonEmpty(grounded.requestId)) issues.push("grounded declares no requestId");
  if (!isNonEmpty(grounded.context.contextId)) issues.push("context declares no contextId");
  if (!isNonEmpty(grounded.context.authorityBasis)) issues.push("context declares no authority basis");
  if (!isNonEmpty(grounded.context.organizationId)) issues.push("context declares no organizationId");
  if (!isNonEmpty(grounded.context.tenantId)) issues.push("context declares no tenantId");

  const inputIds = new Set<HebyId>();
  for (const input of grounded.inputs) {
    if (!isNonEmpty(input.inputId)) issues.push("an admitted input declares no inputId");
    if (inputIds.has(input.inputId)) issues.push(`admitted input id '${input.inputId}' appears more than once`);
    inputIds.add(input.inputId);
  }

  for (const element of grounded.groundedElements) {
    if (!isNonEmpty(element.elementId)) issues.push("a grounded element declares no elementId");
    if (!isHebyPresentationKind(element.kind)) issues.push(`grounded element '${element.elementId}' declares unknown kind '${element.kind}'`);
    if (!isHebyElementClassification(element.classification)) issues.push(`grounded element '${element.elementId}' declares unknown classification '${element.classification}'`);
  }
}

/**
 * Structural checks over the prepared approval the gate will consume: a well-formed presentation
 * identity, a Director termination, and prepared items that are pending, known-kind, and carry a
 * non-empty subject set.
 */
function collectPreparedIssues(prepared: HebyPreparedApproval, issues: string[]): void {
  if (!isNonEmpty(prepared.presentationId)) issues.push("prepared declares no presentationId");
  if (prepared.termination.terminatesAtDirector !== true) issues.push("prepared does not terminate at the Director");

  for (const item of prepared.items) {
    if (!isNonEmpty(item.itemId)) issues.push("a prepared item declares no itemId");
    if (!isHebyPreparationKind(item.kind)) issues.push(`prepared item '${item.itemId}' declares unknown kind '${item.kind}'`);
    if (!isHebyDecisionStateAdmissible(item.decisionState)) issues.push(`prepared item '${item.itemId}' is not pending at the Director`);
    if (item.subjectRefs.length === 0) issues.push(`prepared item '${item.itemId}' declares no subject`);
  }
}

/**
 * Validates a gate request: Heby's identity is intact and the grounded presentation and prepared
 * approval are structurally well-formed. Fail-closed: a missing identity, a malformed surface, or
 * a non-pending item blocks the gate before any governance is applied.
 */
export function validateHebyGovernanceGateRequest(
  request: HebyGovernanceGateRequest,
): HebyGovernanceValidation {
  const issues: string[] = [];

  const identityValidation = validateHebyIdentity(request.identity);
  if (!identityValidation.ok) {
    for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);
  }

  collectGroundedIssues(request.grounded, issues);
  collectPreparedIssues(request.prepared, issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a produced gated presentation against the admitted input index. Defensive,
 * post-gate, and fail-closed: every block is well-formed and records the constraint kind its
 * reason enforces; every admitted element is presentable and governance-clean (never one that
 * should have been blocked); every admitted item rests only on admitted elements; and if the
 * whole surface was stopped for isolation, no element or item is admitted.
 */
export function validateHebyGatedPresentation(
  gated: HebyGatedPresentation,
  inputIndex: ReadonlyMap<HebyId, HebyAdmittedInput>,
): HebyGovernanceValidation {
  const issues: string[] = [];

  if (!isNonEmpty(gated.presentationId)) issues.push("gated presentation declares no presentationId");
  if (!isNonEmpty(gated.intentId)) issues.push("gated presentation declares no intentId");
  if (!isNonEmpty(gated.scope.tenantId)) issues.push("gated presentation declares no tenant scope");
  if (!isNonEmpty(gated.scope.organizationId)) issues.push("gated presentation declares no organization scope");

  for (const constraint of gated.constraints) {
    if (!isHebyConstraintKind(constraint.constraintKind)) {
      issues.push(`constraint '${constraint.constraintId}' declares unknown kind '${constraint.constraintKind}'`);
    }
  }

  for (const block of gated.blocks) {
    if (!isHebyGovernanceSubjectKind(block.subjectKind)) {
      issues.push(`block on '${block.subjectId}' declares unknown subject kind '${block.subjectKind}'`);
      continue;
    }
    if (!isHebyGovernanceBlockReason(block.reason)) {
      issues.push(`block on '${block.subjectId}' declares unknown reason '${block.reason}'`);
      continue;
    }
    if (block.constraintKind !== hebyGovernanceBlockReasonConstraintKind(block.reason)) {
      issues.push(`block on '${block.subjectId}' records the wrong constraint kind for '${block.reason}'`);
    }
  }

  // A presentation-level block means the whole surface was stopped for isolation.
  const stoppedForIsolation = gated.blocks.some((block) => block.subjectKind === "presentation");

  // Admitted elements: presentable and governance-clean — a protected, unresolved, or ineligible
  // element must never appear in the admitted set.
  const admittedElementIds = new Set<HebyId>();
  for (const element of gated.admittedElements) {
    const reason = hebyClassifyElementGovernance(element, inputIndex);
    if (reason !== null) issues.push(`admitted element '${element.elementId}' should have been blocked (${reason})`);
    admittedElementIds.add(element.elementId);
  }

  // Admitted items: rest only on admitted elements.
  for (const item of gated.admittedItems) {
    for (const ref of item.subjectRefs) {
      if (!admittedElementIds.has(ref)) issues.push(`admitted item '${item.itemId}' rests on blocked element '${ref}'`);
    }
  }

  // Isolation stop: the whole surface is stopped — nothing admitted.
  if (stoppedForIsolation) {
    if (gated.admittedElements.length > 0) issues.push("isolation-stopped surface still admits elements");
    if (gated.admittedItems.length > 0) issues.push("isolation-stopped surface still admits items");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical gated presentation is deep-frozen: the gated presentation, its scope,
 * its context, its constraint list and each constraint, its admitted element list and each
 * element (with reference and uncertainty lists), its admitted item list and each item (with
 * subject and consequence lists), and its block list and each block are all immutable. Defensive,
 * post-normalization, and fail-closed.
 */
export function verifyHebyGatedPresentationFrozen(gated: HebyGatedPresentation): HebyGovernanceValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(gated)) issues.push("gated presentation is not frozen");
  if (!Object.isFrozen(gated.scope)) issues.push("scope is not frozen");
  if (!Object.isFrozen(gated.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(gated.constraints)) issues.push("constraint list is not frozen");
  for (const constraint of gated.constraints) {
    if (!Object.isFrozen(constraint)) issues.push(`constraint '${constraint.constraintId}' is not frozen`);
  }
  if (!Object.isFrozen(gated.admittedElements)) issues.push("admitted element list is not frozen");
  for (const element of gated.admittedElements) {
    if (!Object.isFrozen(element)) issues.push(`admitted element '${element.elementId}' is not frozen`);
    if (!Object.isFrozen(element.evidenceRefs)) issues.push(`admitted element '${element.elementId}' evidenceRefs are not frozen`);
    if (!Object.isFrozen(element.uncertainty)) issues.push(`admitted element '${element.elementId}' uncertainty is not frozen`);
  }
  if (!Object.isFrozen(gated.admittedItems)) issues.push("admitted item list is not frozen");
  for (const item of gated.admittedItems) {
    if (!Object.isFrozen(item)) issues.push(`admitted item '${item.itemId}' is not frozen`);
    if (!Object.isFrozen(item.subjectRefs)) issues.push(`admitted item '${item.itemId}' subject list is not frozen`);
    if (!Object.isFrozen(item.consequences)) issues.push(`admitted item '${item.itemId}' consequence list is not frozen`);
  }
  if (!Object.isFrozen(gated.blocks)) issues.push("block list is not frozen");
  for (const block of gated.blocks) {
    if (!Object.isFrozen(block)) issues.push(`block on '${block.subjectId}' is not frozen`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
