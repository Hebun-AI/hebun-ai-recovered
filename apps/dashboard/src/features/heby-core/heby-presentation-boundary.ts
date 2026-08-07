/**
 * Heby Core — presentation and explanation boundary (Phase 3, Presentation and Explanation).
 *
 * The immutable boundary through which a proposed presentation enters and a frozen,
 * attributable, scope-bound presentation leaves, and the canonical declaration of what
 * Phase 3 MAY do and MUST NEVER do. It validates a presentation request against its Phase 2
 * binding, composes the distinguished elements and faceted explanation, preserves
 * provenance, source identity, confidence, and uncertainty, and freezes the result — read-
 * only, non-authoritative, and rendering only what the admitted inputs already carry.
 *
 * It invents NO rationale, exposes NO protected information, prescribes NO implementation,
 * asserts NOTHING beyond declared confidence, and performs NO reasoning, NO decision, NO
 * approval, NO rejection, NO execution, NO upstream mutation of Runtime, Memory, Reasoning,
 * or Organization, NO independent AI call, NO API call, and it never bypasses the Director.
 * Every permitted capability is presentational or preserving. Every prohibited capability
 * is explicitly modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity) and Phase 2 (Input and Context Consumption).
 */

import {
  type CanonicalHebyPresentation,
  type HebyPresentation,
  type HebyPresentationRequest,
} from "@/features/heby-core/heby-presentation-types";
import { hebyAdmittedIdSet } from "@/features/heby-core/heby-presentation-rules";
import { normalizeHebyPresentation } from "@/features/heby-core/heby-presentation-normalization";
import {
  validateHebyPresentation,
  validateHebyPresentationRequest,
  verifyHebyPresentationFrozen,
} from "@/features/heby-core/heby-presentation-validation";

/** The things Phase 3 MAY do. Presentational or preserving only. */
export type HebyPresentationCapability =
  | "compose-explanation"
  | "compose-summary"
  | "compose-navigation"
  | "distinguish-evidence"
  | "distinguish-interpretation"
  | "distinguish-recommendation"
  | "distinguish-uncertainty"
  | "distinguish-decision"
  | "attach-provenance"
  | "attach-confidence"
  | "attach-uncertainty"
  | "preserve-source-identity"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 3 capabilities. */
export const HEBY_PRESENTATION_CAPABILITIES: readonly HebyPresentationCapability[] = Object.freeze([
  "compose-explanation",
  "compose-summary",
  "compose-navigation",
  "distinguish-evidence",
  "distinguish-interpretation",
  "distinguish-recommendation",
  "distinguish-uncertainty",
  "distinguish-decision",
  "attach-provenance",
  "attach-confidence",
  "attach-uncertainty",
  "preserve-source-identity",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 3 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyPresentationNonResponsibility =
  | "invent-rationale"
  | "expose-protected-information"
  | "prescribe-implementation"
  | "assert-beyond-confidence"
  | "decide"
  | "approve"
  | "reject"
  | "execute"
  | "reason"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "call-ai"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 3 non-responsibilities. */
export const HEBY_PRESENTATION_NON_RESPONSIBILITIES: readonly HebyPresentationNonResponsibility[] =
  Object.freeze([
    "invent-rationale",
    "expose-protected-information",
    "prescribe-implementation",
    "assert-beyond-confidence",
    "decide",
    "approve",
    "reject",
    "execute",
    "reason",
    "modify-runtime",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "call-ai",
    "invoke-api",
    "bypass-director",
  ]);

/** A proposed presentation entering the boundary. */
export interface HebyPresentationInput {
  readonly request: HebyPresentationRequest;
}

/** The result of composing a presentation: canonical, or an explicit failure. */
export type HebyPresentationResult =
  | { readonly ok: true; readonly value: CanonicalHebyPresentation }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, composes, preserves, and freezes a presentation. Pure and deterministic: the
 * same input always produces the same result. A validation or freeze failure yields
 * explicit issues and no presentation. This is the only entry Phase 3 exposes, and it
 * neither reasons, decides, approves, invents, nor runs anything, and it mutates no
 * upstream system: it renders the admitted material honestly — distinguishing evidence,
 * interpretation, recommendation, uncertainty, and decision, attributing every element to
 * admitted inputs, carrying confidence and uncertainty, withholding protected content —
 * and stops as a non-authoritative presentation awaiting the Director.
 */
export function presentHebyMaterial(input: HebyPresentationInput): HebyPresentationResult {
  const requestValidation = validateHebyPresentationRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const presentation: HebyPresentation = {
    presentationId: input.request.presentationId,
    requestId: input.request.binding.requestId,
    context: input.request.binding.context,
    inputs: input.request.binding.inputs,
    elements: input.request.elements,
    explanation: input.request.explanation,
  };

  const admittedIds = hebyAdmittedIdSet(input.request.binding.inputs);
  const presentationValidation = validateHebyPresentation(presentation, admittedIds);
  if (!presentationValidation.ok) return { ok: false, issues: presentationValidation.issues };

  const canonical = normalizeHebyPresentation(presentation);

  const frozenCheck = verifyHebyPresentationFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
