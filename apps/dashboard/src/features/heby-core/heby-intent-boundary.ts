/**
 * Heby Core — intent boundary (Phase 5, Intent and Natural-Language Interaction).
 *
 * The immutable boundary through which an utterance and an untrusted model-shaped proposal
 * enter and a frozen, bounded routed intent leaves, and the canonical declaration of what
 * Phase 5 MAY do and MUST NEVER do. It interprets intent deterministically — calling no model
 * itself — by validating the proposal against Heby's identity and the grounded presentation,
 * routing a resolved intent only to grounded elements and only to a capability within Heby's
 * identity, and turning an ambiguous intent into an explicit clarification rather than an
 * assumption.
 *
 * It calls NO model, trusts NO model output as authority, grants the model NO authority,
 * assumes NO ambiguous intent, invents NO intent, generates NO candidate, reasons as NO
 * authority, expands NO capability beyond Heby's identity, routes to NO non-grounded element,
 * and never decides, approves, rejects, executes, triggers a workflow, orchestrates, mutates
 * any upstream system, invokes an API, or bypasses the Director. Every permitted capability
 * is interpretive, bounding, routing, or preserving. Every prohibited capability is explicitly
 * modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3–4 (Presentation, Grounding).
 */

import {
  type CanonicalHebyRoutedIntent,
  type HebyIntentRequest,
  type HebyRoutedIntent,
} from "@/features/heby-core/heby-intent-types";
import { hebyGroundedElementIdSet } from "@/features/heby-core/heby-intent-rules";
import { normalizeHebyRoutedIntent } from "@/features/heby-core/heby-intent-normalization";
import {
  validateHebyIntentRequest,
  validateHebyRoutedIntent,
  verifyHebyRoutedIntentFrozen,
} from "@/features/heby-core/heby-intent-validation";

/** The things Phase 5 MAY do. Interpretive, bounding, routing, or preserving only. */
export type HebyIntentCapability =
  | "interpret-intent"
  | "clarify-ambiguity"
  | "bound-to-context"
  | "route-to-grounded"
  | "preserve-identity"
  | "preserve-grounding"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 5 capabilities. */
export const HEBY_INTENT_CAPABILITIES: readonly HebyIntentCapability[] = Object.freeze([
  "interpret-intent",
  "clarify-ambiguity",
  "bound-to-context",
  "route-to-grounded",
  "preserve-identity",
  "preserve-grounding",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 5 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyIntentNonResponsibility =
  | "call-ai"
  | "trust-ai-output"
  | "grant-ai-authority"
  | "assume-ambiguous-intent"
  | "invent-intent"
  | "generate-candidate"
  | "reason-as-authority"
  | "expand-capability-beyond-identity"
  | "route-to-ungrounded"
  | "approve"
  | "reject"
  | "decide"
  | "execute"
  | "trigger-workflow"
  | "orchestrate"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 5 non-responsibilities. */
export const HEBY_INTENT_NON_RESPONSIBILITIES: readonly HebyIntentNonResponsibility[] = Object.freeze([
  "call-ai",
  "trust-ai-output",
  "grant-ai-authority",
  "assume-ambiguous-intent",
  "invent-intent",
  "generate-candidate",
  "reason-as-authority",
  "expand-capability-beyond-identity",
  "route-to-ungrounded",
  "approve",
  "reject",
  "decide",
  "execute",
  "trigger-workflow",
  "orchestrate",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "invoke-api",
  "bypass-director",
]);

/** A proposed interpretation entering the boundary. */
export interface HebyIntentInput {
  readonly request: HebyIntentRequest;
}

/** The result of interpreting intent: canonical routed intent, or an explicit failure. */
export type HebyIntentResult =
  | { readonly ok: true; readonly value: CanonicalHebyRoutedIntent }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, routes, and freezes an interpreted intent. Pure and deterministic: the same
 * input always produces the same result, and it calls no model. A request or output
 * validation failure yields explicit issues and no routed intent. This is the only entry
 * Phase 5 exposes, and it neither trusts model output, assumes ambiguity, reasons, decides,
 * nor runs anything, and it mutates no upstream system: it validates the untrusted proposal
 * against Heby's identity and the grounded presentation, routes a resolved intent only to
 * grounded elements and an in-identity capability, or yields a clarification — bounded,
 * non-authoritative, and awaiting the Director.
 */
export function interpretHebyIntent(input: HebyIntentInput): HebyIntentResult {
  const requestValidation = validateHebyIntentRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const { grounded, utterance, proposed } = input.request;

  const routed: HebyRoutedIntent = {
    intentId: proposed.intentId,
    utteranceId: utterance.utteranceId,
    presentationId: grounded.presentationId,
    context: grounded.context,
    disposition: proposed.disposition,
    requestedCapability: proposed.requestedCapability,
    routedElementRefs: proposed.routedElementRefs,
    clarification: proposed.clarification,
  };

  const groundedIds = hebyGroundedElementIdSet(grounded);
  const routedValidation = validateHebyRoutedIntent(routed, input.request.identity, groundedIds);
  if (!routedValidation.ok) return { ok: false, issues: routedValidation.issues };

  const canonical = normalizeHebyRoutedIntent(routed);

  const frozenCheck = verifyHebyRoutedIntentFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
