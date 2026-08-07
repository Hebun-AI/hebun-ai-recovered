/**
 * Enterprise Organizational Intelligence Runtime — Runtime Composition boundary (Phase 9).
 *
 * The immutable boundary through which a proposed composition request enters and a frozen,
 * canonical Runtime Composition leaves, and the canonical declaration of what the composition
 * pass MAY do and what it MUST NEVER do. It validates cross-phase integrity, composes every
 * settled Phase 1–8 output into one immutable closed Runtime state, preserves every sub-output
 * unchanged, carries the briefing's governance view, derives the composition identity, tally,
 * and lifecycle, canonicalizes and freezes the result, and stops at the Director Approval
 * boundary — producing the settled input a downstream consumer reads. This closes the Runtime
 * roadmap.
 *
 * It COMPOSES only. It introduces NO new intelligence, NO new candidate, NO reasoning, NO
 * execution, NO AI or LLM call, NO persistence, NO UI behaviour, and NO side-effecting
 * orchestration. It NEVER generates learning, optimization, awareness, or evolution, infers
 * facts, calculates confidence, recommends, ranks, prioritizes, approves, rejects, decides,
 * executes, plans, schedules, orchestrates external work, calls AI or an LLM, invokes an API,
 * persists, mutates memory, reasoning, organizational intelligence, any candidate set, any
 * binding, or the Director Briefing, or bypasses the Director. Every permitted capability is
 * read-only, validating, composing, or preserving. Every prohibited capability is explicitly
 * modelled so that closure can acquire none of them.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalRuntimeComposition,
  RuntimeComposition,
  RuntimeCompositionRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";
import {
  compositionIdentity,
  summarize,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-rules";
import { normalizeRuntimeComposition } from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-normalization";
import {
  validateRuntimeComposition,
  validateRuntimeCompositionRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-validation";

/** The things the composition pass MAY do. Read-only, validating, composing, or preserving only. */
export type RuntimeCompositionCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "consume-optimization-candidate-set"
  | "consume-awareness-candidate-set"
  | "consume-evolution-candidate-set"
  | "consume-binding-bundle"
  | "consume-director-briefing"
  | "validate-cross-phase-integrity"
  | "validate-lifecycle-consistency"
  | "validate-approval-consistency"
  | "validate-binding-completeness"
  | "validate-briefing-completeness"
  | "normalize"
  | "canonicalize"
  | "assemble-composition"
  | "freeze"
  | "expose-composition-summary"
  | "expose-integrity-status"
  | "prepare-closed-runtime-state";

/** The canonical, frozen set of composition pass capabilities. */
export const RUNTIME_COMPOSITION_CAPABILITIES: readonly RuntimeCompositionCapability[] =
  Object.freeze([
    "consume-runtime-bundle",
    "consume-learning-candidate-set",
    "consume-optimization-candidate-set",
    "consume-awareness-candidate-set",
    "consume-evolution-candidate-set",
    "consume-binding-bundle",
    "consume-director-briefing",
    "validate-cross-phase-integrity",
    "validate-lifecycle-consistency",
    "validate-approval-consistency",
    "validate-binding-completeness",
    "validate-briefing-completeness",
    "normalize",
    "canonicalize",
    "assemble-composition",
    "freeze",
    "expose-composition-summary",
    "expose-integrity-status",
    "prepare-closed-runtime-state",
  ]);

/** The things the composition pass MUST NEVER do or become. Every prohibition is explicit. */
export type RuntimeCompositionNonResponsibility =
  | "generate-learning"
  | "generate-optimization"
  | "generate-awareness"
  | "generate-evolution"
  | "perform-reasoning"
  | "infer-facts"
  | "calculate-confidence"
  | "recommend"
  | "rank"
  | "prioritize"
  | "approve"
  | "reject"
  | "decide"
  | "execute"
  | "plan"
  | "schedule"
  | "orchestrate-external-work"
  | "call-ai"
  | "call-llm"
  | "invoke-api"
  | "persist"
  | "mutate-memory"
  | "mutate-reasoning"
  | "mutate-organizational-intelligence"
  | "mutate-candidate-sets"
  | "mutate-bindings"
  | "mutate-director-briefing"
  | "bypass-director";

/** The canonical, frozen set of composition pass non-responsibilities. */
export const RUNTIME_COMPOSITION_NON_RESPONSIBILITIES: readonly RuntimeCompositionNonResponsibility[] =
  Object.freeze([
    "generate-learning",
    "generate-optimization",
    "generate-awareness",
    "generate-evolution",
    "perform-reasoning",
    "infer-facts",
    "calculate-confidence",
    "recommend",
    "rank",
    "prioritize",
    "approve",
    "reject",
    "decide",
    "execute",
    "plan",
    "schedule",
    "orchestrate-external-work",
    "call-ai",
    "call-llm",
    "invoke-api",
    "persist",
    "mutate-memory",
    "mutate-reasoning",
    "mutate-organizational-intelligence",
    "mutate-candidate-sets",
    "mutate-bindings",
    "mutate-director-briefing",
    "bypass-director",
  ]);

/** The approval marker every composition carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed composition pass entering the boundary. */
export interface RuntimeCompositionInput {
  readonly request: RuntimeCompositionRequest;
}

/** The result of composing the closed Runtime: canonical, or an explicit failure. */
export type RuntimeCompositionResult =
  | { readonly ok: true; readonly value: CanonicalRuntimeComposition }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates cross-phase integrity, composes, preserves, canonicalizes, and freezes the closed
 * Runtime state. Pure and deterministic: the same settled inputs always produce the same
 * result, and shuffled inputs produce an identical canonical composition. A validation failure
 * yields explicit issues and no composition. This is the only entry the composition pass
 * exposes, and it neither generates, reasons, calculates, recommends, decides, nor runs
 * anything: it composes already-settled Phase 1–8 outputs into one uniform, immutable closed
 * Runtime state, preserves every sub-output unchanged, and stops at the Director Approval
 * boundary.
 */
export function composeRuntime(input: RuntimeCompositionInput): RuntimeCompositionResult {
  const requestValidation = validateRuntimeCompositionRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const request = input.request;
  const composition: RuntimeComposition = {
    compositionId: compositionIdentity(request.bundle.bundleId, request.briefing.requestId),
    bundle: request.bundle,
    learningSet: request.learningSet,
    optimizationSet: request.optimizationSet,
    awarenessSet: request.awarenessSet,
    evolutionSet: request.evolutionSet,
    bindingBundle: request.bindingBundle,
    briefing: request.briefing,
    governance: request.briefing.governance,
    approval: PENDING_DIRECTOR_APPROVAL,
    lifecycle: request.briefing.items[0].lifecycle,
    summary: summarize(request),
    integrity: "verified",
  };

  const canonical = normalizeRuntimeComposition(composition);

  const compositionValidation = validateRuntimeComposition(canonical);
  if (!compositionValidation.ok) return { ok: false, issues: compositionValidation.issues };

  return { ok: true, value: canonical };
}
