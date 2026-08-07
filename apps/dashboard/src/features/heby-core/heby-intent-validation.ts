/**
 * Heby Core — intent validation (Phase 5, Intent and Natural-Language Interaction).
 *
 * Validates the STRUCTURAL and boundary integrity of a proposed interpretation and of a
 * produced routed intent: Heby's identity is intact; the grounded presentation is valid; a
 * resolved interpretation maps to a capability that belongs to Heby's identity (never a
 * non-responsibility) and routes only to grounded elements; a clarify interpretation carries
 * a real question and NO assumed routing. This is a plain, deterministic structural check —
 * NOT a model call, NOT trust in model output, NOT reasoning, NOT a decision. It is
 * fail-closed: an out-of-identity capability, a route to a non-grounded element, or an
 * ambiguous intent smuggled through as resolved blocks the routing. AI output is never
 * accepted as authority, and ambiguity always fails to clarification, never to assumption.
 */

import {
  HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS,
  type HebyIntentRequest,
  type HebyProposedIntent,
  type HebyRoutedIntent,
} from "@/features/heby-core/heby-intent-types";
import {
  hebyGroundedElementIdSet,
  hebyRoutesToGrounded,
  isHebyCapabilityWithinIdentity,
} from "@/features/heby-core/heby-intent-rules";
import { validateHebyIdentity } from "@/features/heby-core/heby-identity-validation";
import { isHebyCapability } from "@/features/heby-core/heby-identity-rules";
import { validateHebyGroundedPresentation } from "@/features/heby-core/heby-grounding-validation";
import type { CanonicalHebyIdentity, HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyIntentValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Structural and boundary checks over one disposition-bearing interpretation (the proposed
 * shape or the routed output share these invariants). Appends any issues found. Fail-closed.
 */
function collectDispositionIssues(
  intent: Pick<
    HebyProposedIntent,
    "disposition" | "requestedCapability" | "routedElementRefs" | "clarification"
  >,
  identity: CanonicalHebyIdentity,
  groundedIds: ReadonlySet<HebyId>,
  issues: string[],
): void {
  if (!(intent.disposition in HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS)) {
    issues.push(`intent declares unknown disposition '${intent.disposition}'`);
    return;
  }

  if (intent.disposition === "resolved") {
    // A resolved intent must map to a capability in Heby's identity — never a
    // non-responsibility, never an authority the model tried to grant.
    const capability = intent.requestedCapability;
    if (capability === null) {
      issues.push("resolved intent declares no requested capability");
    } else if (!isHebyCapability(capability) || !isHebyCapabilityWithinIdentity(capability, identity)) {
      issues.push(`resolved intent requests capability '${capability}' outside Heby's identity`);
    }
    // A resolved intent must route only to grounded elements.
    if (!hebyRoutesToGrounded(intent.routedElementRefs, groundedIds)) {
      issues.push("resolved intent does not route only to grounded elements");
    }
    // A resolved intent carries no clarification — resolution is not a question.
    if (intent.clarification !== null) {
      issues.push("resolved intent must not carry a clarification");
    }
  } else {
    // Ambiguity fails to clarification, never to assumption: a clarify intent asks a real
    // question and carries NO assumed capability and NO assumed routing.
    if (intent.clarification === null) {
      issues.push("clarify intent declares no clarification");
    } else {
      if (!isNonEmpty(intent.clarification.question)) issues.push("clarify intent declares no question");
      if (!isNonEmpty(intent.clarification.reason)) issues.push("clarify intent declares no reason");
    }
    if (intent.requestedCapability !== null) {
      issues.push("clarify intent must not assume a capability");
    }
    if (intent.routedElementRefs.length > 0) {
      issues.push("clarify intent must not assume a routing");
    }
  }
}

/**
 * Validates a proposed interpretation request: Heby's identity is intact, the grounded
 * presentation is valid, the utterance is well-formed, and the untrusted proposal is bounded
 * — a resolved proposal maps to an in-identity capability routed to grounded elements, a
 * clarify proposal asks without assuming. Fail-closed: any issue blocks the routing.
 */
export function validateHebyIntentRequest(request: HebyIntentRequest): HebyIntentValidation {
  const issues: string[] = [];

  const identityValidation = validateHebyIdentity(request.identity);
  if (!identityValidation.ok) {
    for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);
  }

  const groundedValidation = validateHebyGroundedPresentation(request.grounded);
  if (!groundedValidation.ok) {
    for (const issue of groundedValidation.issues) issues.push(`grounded: ${issue}`);
  }

  if (!isNonEmpty(request.utterance.utteranceId)) issues.push("utterance declares no utteranceId");
  if (!isNonEmpty(request.utterance.text)) issues.push("utterance declares no text");

  if (!isNonEmpty(request.proposed.intentId)) issues.push("proposed intent declares no intentId");
  if (request.proposed.utteranceId !== request.utterance.utteranceId) {
    issues.push("proposed intent does not reference the utterance");
  }

  const groundedIds = hebyGroundedElementIdSet(request.grounded);
  collectDispositionIssues(request.proposed, request.identity, groundedIds, issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a produced routed intent against Heby's identity and the grounded element
 * identities. Defensive, post-interpretation, and fail-closed: the same disposition
 * invariants must still hold — an in-identity capability routed to grounded elements, or a
 * clarification with no assumed routing.
 */
export function validateHebyRoutedIntent(
  intent: HebyRoutedIntent,
  identity: CanonicalHebyIdentity,
  groundedIds: ReadonlySet<HebyId>,
): HebyIntentValidation {
  const issues: string[] = [];

  if (!isNonEmpty(intent.intentId)) issues.push("routed intent declares no intentId");
  if (!isNonEmpty(intent.utteranceId)) issues.push("routed intent declares no utteranceId");
  if (!isNonEmpty(intent.presentationId)) issues.push("routed intent declares no presentationId");

  collectDispositionIssues(intent, identity, groundedIds, issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical routed intent is deep-frozen: the routed intent, its context, its
 * routed reference list, and its clarification are all immutable. Defensive,
 * post-normalization, and fail-closed.
 */
export function verifyHebyRoutedIntentFrozen(intent: HebyRoutedIntent): HebyIntentValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(intent)) issues.push("routed intent is not frozen");
  if (!Object.isFrozen(intent.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(intent.routedElementRefs)) issues.push("routed references are not frozen");
  if (intent.clarification !== null && !Object.isFrozen(intent.clarification)) {
    issues.push("clarification is not frozen");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
