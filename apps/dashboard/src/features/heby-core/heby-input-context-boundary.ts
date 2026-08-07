/**
 * Heby Core — input and context boundary (Phase 2, Input and Context Consumption).
 *
 * The immutable boundary through which a proposed admission enters and a frozen context
 * binding leaves, and the canonical declaration of what Phase 2 MAY do and MUST NEVER do.
 * It validates an admission request, binds the eligible, settled, provenance-complete
 * inputs to their declared context, preserves provenance and source identity, and freezes
 * the binding — read-only, non-authoritative, and awaiting a later presentation phase.
 *
 * It performs NO reasoning, NO answer generation, NO presentation, NO explanation, NO
 * decision, NO approval, NO execution, NO upstream mutation of Runtime, Memory, Reasoning,
 * or Organization, NO independent AI call, NO API call, and it never bypasses the
 * Director. Every permitted capability is read-only, admitting, binding, or preserving.
 * Every prohibited capability is explicitly modelled so no later phase can quietly acquire
 * it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity Foundation).
 */

import {
  type CanonicalHebyContextBinding,
  type HebyAdmissionRequest,
  type HebyContextBinding,
} from "@/features/heby-core/heby-input-context-types";
import { normalizeHebyContextBinding } from "@/features/heby-core/heby-input-context-normalization";
import {
  validateHebyAdmissionRequest,
  validateHebyContextBinding,
  verifyHebyContextBindingFrozen,
} from "@/features/heby-core/heby-input-context-validation";

/** The things Phase 2 MAY do. Read-only, admitting, binding, or preserving only. */
export type HebyInputContextCapability =
  | "admit-runtime-output"
  | "admit-reasoning-understanding"
  | "admit-memory-context"
  | "bind-context"
  | "preserve-role"
  | "preserve-domain"
  | "preserve-subject"
  | "preserve-authority"
  | "preserve-constraints"
  | "preserve-provenance"
  | "preserve-source-identity"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 2 capabilities. */
export const HEBY_INPUT_CONTEXT_CAPABILITIES: readonly HebyInputContextCapability[] = Object.freeze([
  "admit-runtime-output",
  "admit-reasoning-understanding",
  "admit-memory-context",
  "bind-context",
  "preserve-role",
  "preserve-domain",
  "preserve-subject",
  "preserve-authority",
  "preserve-constraints",
  "preserve-provenance",
  "preserve-source-identity",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 2 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyInputContextNonResponsibility =
  | "answer-question"
  | "reason"
  | "generate-response"
  | "approve"
  | "decide"
  | "execute"
  | "mutate-upstream"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "call-ai"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 2 non-responsibilities. */
export const HEBY_INPUT_CONTEXT_NON_RESPONSIBILITIES: readonly HebyInputContextNonResponsibility[] =
  Object.freeze([
    "answer-question",
    "reason",
    "generate-response",
    "approve",
    "decide",
    "execute",
    "mutate-upstream",
    "modify-runtime",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "call-ai",
    "invoke-api",
    "bypass-director",
  ]);

/** A proposed admission entering the boundary. */
export interface HebyInputContextInput {
  readonly request: HebyAdmissionRequest;
}

/** The result of admitting inputs to context: canonical, or an explicit failure. */
export type HebyContextBindingResult =
  | { readonly ok: true; readonly value: CanonicalHebyContextBinding }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, binds, preserves, and freezes a context binding. Pure and deterministic: the
 * same input always produces the same result. A validation or freeze failure yields
 * explicit issues and no binding. This is the only entry Phase 2 exposes, and it neither
 * reasons, answers, presents, decides, approves, nor runs anything, and it mutates no
 * upstream system: it admits the eligible, settled, provenance-complete inputs read-only,
 * binds them to their declared context, and stops before any presentation or reasoning.
 */
export function admitHebyContext(input: HebyInputContextInput): HebyContextBindingResult {
  const requestValidation = validateHebyAdmissionRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const binding: HebyContextBinding = {
    requestId: input.request.requestId,
    context: input.request.context,
    inputs: input.request.inputs,
  };

  const bindingValidation = validateHebyContextBinding(binding);
  if (!bindingValidation.ok) return { ok: false, issues: bindingValidation.issues };

  const canonical = normalizeHebyContextBinding(binding);

  const frozenCheck = verifyHebyContextBindingFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
