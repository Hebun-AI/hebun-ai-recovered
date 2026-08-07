/**
 * Heby Core — grounding boundary (Phase 4, Grounding and Anti-Hallucination).
 *
 * The immutable boundary through which a Phase 3 presentation enters and a frozen, uniformly
 * grounded presentation leaves, and the canonical declaration of what Phase 4 MAY do and MUST
 * NEVER do. It verifies, uniformly across all presentation kinds, that every element traces
 * to a settled admitted source; it grounds the traceable elements (each with a settled-source
 * trace), withholds and clearly marks the unsupported ones with an explicit fail-closed
 * reason, carries the grounded explanation, and freezes the result — generating no content
 * and altering no meaning.
 *
 * It performs NO content generation, NO reasoning, NO inference, NO retrieval, NO retrieval
 * orchestration, NO RAG, NO independent AI call, NO confidence inflation, NO recommendation
 * or decision generation, NO invention of evidence or provenance, NO decision, NO approval,
 * NO rejection, NO execution, NO upstream mutation, NO API call, and it never bypasses the
 * Director or dresses unsupported content as grounded. Every permitted capability is
 * verifying, binding, marking, or preserving. Every prohibited capability is explicitly
 * modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Input and Context), Phase 3 (Presentation).
 */

import {
  type CanonicalHebyGroundedPresentation,
  type HebyGroundedPresentation,
  type HebyGroundingRequest,
  type HebyGroundingTrace,
  type HebyWithheldElement,
} from "@/features/heby-core/heby-grounding-types";
import {
  classifyHebyElementGrounding,
  hebyAdmittedInputIndex,
  isHebySettledSource,
} from "@/features/heby-core/heby-grounding-rules";
import { normalizeHebyGroundedPresentation } from "@/features/heby-core/heby-grounding-normalization";
import {
  validateHebyGroundedPresentation,
  validateHebyGroundingRequest,
  verifyHebyGroundedPresentationFrozen,
} from "@/features/heby-core/heby-grounding-validation";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

/** The things Phase 4 MAY do. Verifying, binding, marking, or preserving only. */
export type HebyGroundingCapability =
  | "verify-grounding"
  | "trace-to-settled-source"
  | "mark-unsupported"
  | "withhold-unsupported"
  | "consolidate-grounding"
  | "carry-provenance"
  | "preserve-source-identity"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 4 capabilities. */
export const HEBY_GROUNDING_CAPABILITIES: readonly HebyGroundingCapability[] = Object.freeze([
  "verify-grounding",
  "trace-to-settled-source",
  "mark-unsupported",
  "withhold-unsupported",
  "consolidate-grounding",
  "carry-provenance",
  "preserve-source-identity",
  "preserve-confidence",
  "preserve-uncertainty",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 4 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyGroundingNonResponsibility =
  | "generate-content"
  | "alter-meaning"
  | "invent-evidence"
  | "invent-provenance"
  | "invent-rationale"
  | "dress-unsupported-as-grounded"
  | "reason"
  | "infer"
  | "retrieve"
  | "orchestrate-retrieval"
  | "inflate-confidence"
  | "generate-recommendation"
  | "generate-decision"
  | "decide"
  | "approve"
  | "reject"
  | "execute"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "call-ai"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 4 non-responsibilities. */
export const HEBY_GROUNDING_NON_RESPONSIBILITIES: readonly HebyGroundingNonResponsibility[] =
  Object.freeze([
    "generate-content",
    "alter-meaning",
    "invent-evidence",
    "invent-provenance",
    "invent-rationale",
    "dress-unsupported-as-grounded",
    "reason",
    "infer",
    "retrieve",
    "orchestrate-retrieval",
    "inflate-confidence",
    "generate-recommendation",
    "generate-decision",
    "decide",
    "approve",
    "reject",
    "execute",
    "modify-runtime",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "call-ai",
    "invoke-api",
    "bypass-director",
  ]);

/** A proposed grounding pass entering the boundary. */
export interface HebyGroundingInput {
  readonly request: HebyGroundingRequest;
}

/** The result of grounding a presentation: canonical, or an explicit failure. */
export type HebyGroundingResult =
  | { readonly ok: true; readonly value: CanonicalHebyGroundedPresentation }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, grounds, marks, and freezes a presentation. Pure and deterministic: the same
 * input always produces the same result. A request or output validation failure yields
 * explicit issues and no grounded presentation. This is the only entry Phase 4 exposes, and
 * it neither generates content, reasons, retrieves, infers, decides, approves, nor runs
 * anything, and it mutates no upstream system: it verifies each element's settled-source
 * trace, grounds the traceable elements, withholds and clearly marks the unsupported ones,
 * carries the grounded explanation, and stops as a non-authoritative grounded presentation.
 */
export function groundHebyPresentation(input: HebyGroundingInput): HebyGroundingResult {
  const requestValidation = validateHebyGroundingRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const presentation = input.request.presentation;
  const index = hebyAdmittedInputIndex(presentation.inputs);

  const groundedElements: HebyPresentationElement[] = [];
  const traces: HebyGroundingTrace[] = [];
  const withheld: HebyWithheldElement[] = [];

  for (const element of presentation.elements) {
    const classification = classifyHebyElementGrounding(element, index);
    if (classification.status === "grounded") {
      groundedElements.push(element);
      traces.push({ elementId: element.elementId, settledSourceRefs: classification.settledSourceRefs });
    } else {
      withheld.push({ element, reason: classification.reason });
    }
  }

  // Explanation is carried only where it is attributable to settled sources — never dressed
  // as grounded when it is not. Unsupported explanation is withheld by exclusion.
  const settledIds = new Set<HebyId>();
  for (const admitted of presentation.inputs) {
    if (isHebySettledSource(admitted)) settledIds.add(admitted.inputId);
  }
  const explanation = presentation.explanation.filter(
    (entry) => entry.sourceRefs.length > 0 && entry.sourceRefs.every((ref) => settledIds.has(ref)),
  );

  const grounded: HebyGroundedPresentation = {
    presentationId: presentation.presentationId,
    requestId: presentation.requestId,
    context: presentation.context,
    inputs: presentation.inputs,
    groundedElements,
    traces,
    withheld,
    explanation,
  };

  const groundedValidation = validateHebyGroundedPresentation(grounded);
  if (!groundedValidation.ok) return { ok: false, issues: groundedValidation.issues };

  const canonical = normalizeHebyGroundedPresentation(grounded);

  const frozenCheck = verifyHebyGroundedPresentationFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
