/**
 * Enterprise Organizational Intelligence Runtime — binding boundary (Phase 7).
 *
 * The immutable boundary through which a proposed binding request enters and a frozen,
 * canonical Runtime Binding bundle leaves, and the canonical declaration of what the
 * binding pass MAY do and what it MUST NEVER do. It validates a request, binds every
 * qualified Learning, Optimization, Awareness, and Evolution candidate into one uniform
 * artifact, preserves each artifact's provenance, explainability, confidence, uncertainty,
 * and supporting references, canonicalizes and freezes the bundle, and stops at the
 * Director Approval boundary — producing the settled input the Director Briefing, Heby
 * Explanation, and Governance Runtimes consume later.
 *
 * It creates NO learning, optimization, awareness, or evolution, NO facts, performs NO
 * reasoning, calculates NO confidence, suppresses NO uncertainty, and NEVER recommends,
 * prioritizes, decides, approves, executes, plans, orchestrates, calls AI or an LLM,
 * persists, invokes an API, modifies memory, reasoning, organization, or any candidate set,
 * or bypasses the Director. Every permitted capability is read-only, binding, or preserving.
 * Every prohibited capability is explicitly modelled so that no later phase can quietly
 * acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalRuntimeBindingBundle,
  RuntimeBindingBundle,
  RuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
import { bindCandidateSets } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-rules";
import { normalizeRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-normalization";
import {
  validateRuntimeBindingBundle,
  validateRuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-validation";

/** The things the binding pass MAY do. Read-only, binding, or preserving only. */
export type RuntimeBindingCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "consume-optimization-candidate-set"
  | "consume-awareness-candidate-set"
  | "consume-evolution-candidate-set"
  | "bind"
  | "validate"
  | "normalize"
  | "canonicalize"
  | "freeze"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "preserve-evidence-references"
  | "preserve-learning-references"
  | "preserve-optimization-references"
  | "preserve-awareness-references"
  | "preserve-evolution-references"
  | "prepare-for-director"
  | "prepare-for-heby-explanation";

/** The canonical, frozen set of binding pass capabilities. */
export const RUNTIME_BINDING_CAPABILITIES: readonly RuntimeBindingCapability[] = Object.freeze([
  "consume-runtime-bundle",
  "consume-learning-candidate-set",
  "consume-optimization-candidate-set",
  "consume-awareness-candidate-set",
  "consume-evolution-candidate-set",
  "bind",
  "validate",
  "normalize",
  "canonicalize",
  "freeze",
  "preserve-provenance",
  "preserve-explainability",
  "preserve-confidence",
  "preserve-uncertainty",
  "preserve-evidence-references",
  "preserve-learning-references",
  "preserve-optimization-references",
  "preserve-awareness-references",
  "preserve-evolution-references",
  "prepare-for-director",
  "prepare-for-heby-explanation",
]);

/** The things the binding pass MUST NEVER do or become. Every prohibition is explicit. */
export type RuntimeBindingNonResponsibility =
  | "create-learning"
  | "create-optimization"
  | "create-awareness"
  | "create-evolution"
  | "create-facts"
  | "perform-reasoning"
  | "calculate-confidence"
  | "suppress-uncertainty"
  | "recommend"
  | "prioritize"
  | "decide"
  | "approve"
  | "execute"
  | "plan"
  | "orchestrate"
  | "call-ai"
  | "call-llm"
  | "persist"
  | "invoke-api"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "modify-candidate-sets"
  | "bypass-director";

/** The canonical, frozen set of binding pass non-responsibilities. */
export const RUNTIME_BINDING_NON_RESPONSIBILITIES: readonly RuntimeBindingNonResponsibility[] =
  Object.freeze([
    "create-learning",
    "create-optimization",
    "create-awareness",
    "create-evolution",
    "create-facts",
    "perform-reasoning",
    "calculate-confidence",
    "suppress-uncertainty",
    "recommend",
    "prioritize",
    "decide",
    "approve",
    "execute",
    "plan",
    "orchestrate",
    "call-ai",
    "call-llm",
    "persist",
    "invoke-api",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "modify-candidate-sets",
    "bypass-director",
  ]);

/** The approval marker every prepared bundle carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed binding pass entering the boundary. */
export interface RuntimeBindingInput {
  readonly request: RuntimeBindingRequest;
}

/** The result of preparing a binding bundle: canonical, or an explicit failure. */
export type RuntimeBindingResult =
  | { readonly ok: true; readonly value: CanonicalRuntimeBindingBundle }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, binds, preserves, canonicalizes, and freezes a Runtime Binding bundle. Pure
 * and deterministic: the same input always produces the same result, and shuffled inputs
 * produce identical canonical output. A validation failure yields explicit issues and no
 * bundle. This is the only entry the binding pass exposes, and it neither creates, reasons,
 * calculates, recommends, decides, nor runs anything: it binds already-produced candidates
 * into one uniform, immutable bundle, preserves their provenance, explanation, confidence,
 * and uncertainty, and stops at the Director Approval boundary.
 */
export function prepareRuntimeBinding(input: RuntimeBindingInput): RuntimeBindingResult {
  const requestValidation = validateRuntimeBindingRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const bundle: RuntimeBindingBundle = {
    requestId: input.request.requestId,
    artifacts: bindCandidateSets(input.request),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const canonical = normalizeRuntimeBindingBundle(bundle);

  const bundleValidation = validateRuntimeBindingBundle(canonical);
  if (!bundleValidation.ok) return { ok: false, issues: bundleValidation.issues };

  return { ok: true, value: canonical };
}
