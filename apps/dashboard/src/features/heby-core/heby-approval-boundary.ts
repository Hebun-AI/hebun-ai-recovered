/**
 * Heby Core — approval boundary (Phase 6, Approval Preparation and Director Boundary).
 *
 * The immutable boundary through which a Phase 5 routed intent and its proposed items enter and
 * a frozen, Director-terminated prepared approval leaves, and the canonical declaration of what
 * Phase 6 MAY do and MUST NEVER do. It prepares items deterministically — calling no model
 * itself — by validating the proposal against Heby's identity, the grounded presentation, and
 * the routed intent, keeping every item pending at the Director, keeping approval visibly
 * distinct from advice, stating consequences before a human confirmation, and terminating the
 * interaction at the Director.
 *
 * It approves NOTHING, decides NOTHING, rejects NOTHING, implies NO authority, treats advice as
 * approval NEVER, treats a conversational "approve" as a decision NEVER, resolves NO decision,
 * triggers NO workflow, orchestrates NOTHING, and never executes, calls a model, trusts model
 * output, invents, mutates any upstream system, invokes an API, or advances past the Director.
 * Every permitted capability is preparing, distinguishing, terminating, or preserving. Every
 * prohibited capability is explicitly modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3–4 (Presentation,
 * Grounding), and Phase 5 (Intent and Natural-Language Interaction).
 */

import {
  type CanonicalHebyPreparedApproval,
  type HebyApprovalRequest,
  type HebyPreparedApproval,
} from "@/features/heby-core/heby-approval-types";
import { hebyGroundedElementIdSet } from "@/features/heby-core/heby-intent-rules";
import { normalizeHebyPreparedApproval } from "@/features/heby-core/heby-approval-normalization";
import {
  validateHebyApprovalRequest,
  validateHebyPreparedApproval,
  verifyHebyPreparedApprovalFrozen,
} from "@/features/heby-core/heby-approval-validation";

/** The things Phase 6 MAY do. Preparing, distinguishing, terminating, or preserving only. */
export type HebyApprovalCapability =
  | "prepare-item"
  | "distinguish-advice-from-approval"
  | "state-consequences"
  | "terminate-at-director"
  | "keep-pending"
  | "preserve-identity"
  | "preserve-grounding"
  | "bound-to-context"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 6 capabilities. */
export const HEBY_APPROVAL_CAPABILITIES: readonly HebyApprovalCapability[] = Object.freeze([
  "prepare-item",
  "distinguish-advice-from-approval",
  "state-consequences",
  "terminate-at-director",
  "keep-pending",
  "preserve-identity",
  "preserve-grounding",
  "bound-to-context",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 6 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyApprovalNonResponsibility =
  | "approve"
  | "decide"
  | "reject"
  | "resolve-decision"
  | "imply-authority"
  | "treat-advice-as-approval"
  | "treat-utterance-as-decision"
  | "advance-past-director"
  | "trigger-workflow"
  | "orchestrate"
  | "execute"
  | "call-ai"
  | "trust-ai-output"
  | "invent"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 6 non-responsibilities. */
export const HEBY_APPROVAL_NON_RESPONSIBILITIES: readonly HebyApprovalNonResponsibility[] = Object.freeze([
  "approve",
  "decide",
  "reject",
  "resolve-decision",
  "imply-authority",
  "treat-advice-as-approval",
  "treat-utterance-as-decision",
  "advance-past-director",
  "trigger-workflow",
  "orchestrate",
  "execute",
  "call-ai",
  "trust-ai-output",
  "invent",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "invoke-api",
  "bypass-director",
]);

/** A preparation proposal entering the boundary. */
export interface HebyApprovalInput {
  readonly request: HebyApprovalRequest;
}

/** The result of preparing an approval: canonical prepared approval, or an explicit failure. */
export type HebyApprovalResult =
  | { readonly ok: true; readonly value: CanonicalHebyPreparedApproval }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, prepares, and freezes an approval. Pure and deterministic: the same input always
 * produces the same result, and it calls no model. A request or output validation failure
 * yields explicit issues and no prepared approval. This is the only entry Phase 6 exposes, and
 * it neither approves, decides, rejects, resolves a decision, implies authority, treats advice
 * as approval, treats an utterance as a decision, nor runs anything, and it mutates no upstream
 * system: it validates the proposal against Heby's identity, grounded presentation, and routed
 * intent, keeps every item pending and grounded, keeps approval distinct from advice, states
 * consequences before confirmation, and terminates the interaction at the Director.
 */
export function prepareHebyApproval(input: HebyApprovalInput): HebyApprovalResult {
  const requestValidation = validateHebyApprovalRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const { identity, grounded, routed, items } = input.request;

  const approval: HebyPreparedApproval = {
    presentationId: grounded.presentationId,
    intentId: routed.intentId,
    context: grounded.context,
    items,
    termination: { authorityBasis: grounded.context.authorityBasis, terminatesAtDirector: true },
  };

  const groundedIds = hebyGroundedElementIdSet(grounded);
  const approvalValidation = validateHebyPreparedApproval(approval, routed, identity, groundedIds);
  if (!approvalValidation.ok) return { ok: false, issues: approvalValidation.issues };

  const canonical = normalizeHebyPreparedApproval(approval);

  const frozenCheck = verifyHebyPreparedApprovalFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
