/**
 * Heby Core — approval validation (Phase 6, Approval Preparation and Director Boundary).
 *
 * Validates the STRUCTURAL and boundary integrity of a preparation request and of a produced
 * prepared approval: Heby's identity is intact; the grounded presentation is valid; the Phase 5
 * routed intent is valid, resolved, and bound to the same presentation; every prepared item is
 * pending at the Director (never a resolved decision), carries a known kind, derives from the
 * routed intent, concerns only the intent's grounded routing, and states its consequences where
 * a human confirmation is required; and the whole preparation terminates at the Director with
 * authority visible.
 *
 * This is a plain, deterministic structural check — NOT a model call, NOT trust in model
 * output, NOT reasoning, NOT an approval, NOT a decision. It is fail-closed: a resolved
 * decision state, an item smuggled from an unresolved intent, a subject outside the grounded
 * routing, a review or approval item with no consequences, or a path that does not terminate at
 * the Director blocks the whole preparation. Advice is never presented as approval, and a
 * conversational "approve" is never treated as an authoritative act.
 */

import {
  type HebyApprovalRequest,
  type HebyPreparedApproval,
  type HebyPreparedItem,
} from "@/features/heby-core/heby-approval-types";
import {
  hebyKindRequiresConsequences,
  hebySubjectsWithinRouting,
  isHebyDecisionState,
  isHebyDecisionStateAdmissible,
  isHebyPreparationKind,
} from "@/features/heby-core/heby-approval-rules";
import { validateHebyIdentity } from "@/features/heby-core/heby-identity-validation";
import { validateHebyGroundedPresentation } from "@/features/heby-core/heby-grounding-validation";
import { validateHebyRoutedIntent } from "@/features/heby-core/heby-intent-validation";
import { hebyGroundedElementIdSet } from "@/features/heby-core/heby-intent-rules";
import type { CanonicalHebyIdentity, HebyId } from "@/features/heby-core/heby-identity-types";
import type { HebyRoutedIntent } from "@/features/heby-core/heby-intent-types";

export type HebyApprovalValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Structural and boundary checks over one prepared item, given the routed intent it must
 * derive from. Appends any issues found. Fail-closed.
 */
function collectItemIssues(item: HebyPreparedItem, routed: HebyRoutedIntent, issues: string[]): void {
  if (!isNonEmpty(item.itemId)) issues.push("prepared item declares no itemId");

  if (!isHebyPreparationKind(item.kind)) {
    issues.push(`prepared item declares unknown kind '${item.kind}'`);
    return;
  }

  // Every prepared item terminates pending at the Director — Heby prepares, it never decides,
  // and a conversational "approve" is never a completed decision here.
  if (!isHebyDecisionState(item.decisionState)) {
    issues.push(`prepared item declares unknown decision state '${item.decisionState}'`);
  } else if (!isHebyDecisionStateAdmissible(item.decisionState)) {
    issues.push(`prepared item must be pending at the Director, never '${item.decisionState}'`);
  }

  // A prepared item derives from the interpreted intent, and concerns only the grounded
  // elements that intent routed to — never invented, never ungrounded.
  if (item.intentId !== routed.intentId) {
    issues.push("prepared item does not derive from the routed intent");
  }
  if (!hebySubjectsWithinRouting(item.subjectRefs, routed.routedElementRefs)) {
    issues.push("prepared item concerns a subject outside the intent's grounded routing");
  }

  // A review or approval item states the consequences a person must understand before
  // confirming; advice needs none but may carry them.
  if (hebyKindRequiresConsequences(item.kind)) {
    if (item.consequences.length === 0) {
      issues.push(`prepared '${item.kind}' item states no consequences before confirmation`);
    } else if (item.consequences.some((consequence) => !isNonEmpty(consequence))) {
      issues.push(`prepared '${item.kind}' item declares an empty consequence`);
    }
  }
}

/**
 * Validates a preparation request: Heby's identity is intact, the grounded presentation is
 * valid, the routed intent is valid and bound to the same presentation, and — only when the
 * intent is resolved — the proposed items are well-formed, pending, grounded, and consequence-
 * bearing. Fail-closed: an unresolved intent may prepare no items, and any item issue blocks the
 * whole preparation.
 */
export function validateHebyApprovalRequest(request: HebyApprovalRequest): HebyApprovalValidation {
  const issues: string[] = [];

  const identityValidation = validateHebyIdentity(request.identity);
  if (!identityValidation.ok) {
    for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);
  }

  const groundedValidation = validateHebyGroundedPresentation(request.grounded);
  if (!groundedValidation.ok) {
    for (const issue of groundedValidation.issues) issues.push(`grounded: ${issue}`);
  }

  const groundedIds = hebyGroundedElementIdSet(request.grounded);
  const routedValidation = validateHebyRoutedIntent(request.routed, request.identity, groundedIds);
  if (!routedValidation.ok) {
    for (const issue of routedValidation.issues) issues.push(`routed: ${issue}`);
  }

  if (request.routed.presentationId !== request.grounded.presentationId) {
    issues.push("routed intent is not bound to the grounded presentation");
  }

  // Ambiguity terminates at a clarification, never at a prepared item: an unresolved intent may
  // prepare nothing. A resolved intent must have routed to at least one grounded element.
  if (request.routed.disposition !== "resolved") {
    if (request.items.length > 0) {
      issues.push("cannot prepare items from an unresolved intent");
    }
  } else {
    if (request.items.length === 0) {
      issues.push("a resolved intent prepares at least one item");
    }
    for (const item of request.items) collectItemIssues(item, request.routed, issues);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a produced prepared approval against Heby's identity and the grounded element
 * identities. Defensive, post-preparation, and fail-closed: the routed intent still validates,
 * every item still holds its invariants, and the interaction terminates at the Director with a
 * visible authority basis.
 */
export function validateHebyPreparedApproval(
  approval: HebyPreparedApproval,
  routed: HebyRoutedIntent,
  identity: CanonicalHebyIdentity,
  groundedIds: ReadonlySet<HebyId>,
): HebyApprovalValidation {
  const issues: string[] = [];

  if (!isNonEmpty(approval.presentationId)) issues.push("prepared approval declares no presentationId");
  if (approval.intentId !== routed.intentId) issues.push("prepared approval does not derive from the routed intent");

  const routedValidation = validateHebyRoutedIntent(routed, identity, groundedIds);
  if (!routedValidation.ok) {
    for (const issue of routedValidation.issues) issues.push(`routed: ${issue}`);
  }

  for (const item of approval.items) collectItemIssues(item, routed, issues);

  // The Director boundary: every path terminates at the human, authority stays visible.
  if (approval.termination.terminatesAtDirector !== true) {
    issues.push("prepared approval does not terminate at the Director");
  }
  if (!isNonEmpty(approval.termination.authorityBasis)) {
    issues.push("prepared approval declares no visible authority basis");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical prepared approval is deep-frozen: the approval, its context, its
 * item list and every item, each item's subject and consequence lists, and its Director
 * termination are all immutable. Defensive, post-normalization, and fail-closed.
 */
export function verifyHebyPreparedApprovalFrozen(approval: HebyPreparedApproval): HebyApprovalValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(approval)) issues.push("prepared approval is not frozen");
  if (!Object.isFrozen(approval.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(approval.items)) issues.push("item list is not frozen");
  if (!Object.isFrozen(approval.termination)) issues.push("Director termination is not frozen");

  for (const item of approval.items) {
    if (!Object.isFrozen(item)) issues.push(`item '${item.itemId}' is not frozen`);
    if (!Object.isFrozen(item.subjectRefs)) issues.push(`item '${item.itemId}' subject list is not frozen`);
    if (!Object.isFrozen(item.consequences)) issues.push(`item '${item.itemId}' consequence list is not frozen`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
