/**
 * Enterprise Organizational Intelligence Runtime — evolution candidate boundary (Phase 6).
 *
 * The immutable boundary through which a proposed evolution request enters and a frozen
 * Evolution Candidate set leaves, and the canonical declaration of what the evolution pass
 * MAY do and what it MUST NEVER do. It validates a request, identifies candidates from the
 * assembled Runtime Context, the qualified Learning, Optimization, and Awareness Candidate
 * sets, and eligible evidence, preserves each candidate's supporting learning,
 * optimization, awareness, and evidence references, provenance, explainability, confidence,
 * and uncertainty, and freezes them into an immutable set awaiting Director review.
 *
 * It performs NO evolution readiness assessment, NO transformation assessment, NO
 * prediction, NO forecasting, NO simulation, NO work planning, NO roadmap generation, NO
 * action recommendation, NO strategy recommendation, NO prioritization, NO execution, NO
 * workflow, NO AI call, NO LLM call, NO memory change, NO reasoning change, NO organization
 * change, NO learning change, NO optimization change, NO awareness change, NO persistence,
 * NO API call, NO approval, NO decision, and it never bypasses the Director. Every
 * permitted capability is read-only, identifying, or preserving. Every prohibited
 * capability is explicitly modelled so that no later phase can quietly acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalEvolutionCandidateSet,
  EvolutionCandidateRequest,
  EvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";
import { identifyEvolutionCandidates } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-rules";
import { normalizeEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-normalization";
import {
  validateEvolutionCandidateRequest,
  validateEvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";

/** The things the evolution pass MAY do. Read-only, identifying, or preserving only. */
export type EvolutionCandidateCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "consume-optimization-candidate-set"
  | "consume-awareness-candidate-set"
  | "assemble-evidence"
  | "identify-candidate"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "preserve-learning-references"
  | "preserve-optimization-references"
  | "preserve-awareness-references"
  | "preserve-evidence-references"
  | "prepare-immutable-candidate"
  | "prepare-for-director"
  | "prepare-for-heby-explanation"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of evolution pass capabilities. */
export const EVOLUTION_CANDIDATE_CAPABILITIES: readonly EvolutionCandidateCapability[] =
  Object.freeze([
    "consume-runtime-bundle",
    "consume-learning-candidate-set",
    "consume-optimization-candidate-set",
    "consume-awareness-candidate-set",
    "assemble-evidence",
    "identify-candidate",
    "preserve-provenance",
    "preserve-explainability",
    "preserve-confidence",
    "preserve-uncertainty",
    "preserve-learning-references",
    "preserve-optimization-references",
    "preserve-awareness-references",
    "preserve-evidence-references",
    "prepare-immutable-candidate",
    "prepare-for-director",
    "prepare-for-heby-explanation",
    "validate",
    "normalize",
    "freeze",
  ]);

/** The things the evolution pass MUST NEVER do or become. Every prohibition is explicit. */
export type EvolutionCandidateNonResponsibility =
  | "assess-readiness"
  | "assess-transformation"
  | "predict"
  | "forecast"
  | "simulate"
  | "plan-work"
  | "generate-roadmap"
  | "recommend-actions"
  | "recommend-strategy"
  | "prioritize"
  | "execute"
  | "run-workflow"
  | "call-ai"
  | "call-llm"
  | "persist"
  | "invoke-api"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "modify-learning"
  | "modify-optimization"
  | "modify-awareness"
  | "approve"
  | "decide"
  | "bypass-director";

/** The canonical, frozen set of evolution pass non-responsibilities. */
export const EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES: readonly EvolutionCandidateNonResponsibility[] =
  Object.freeze([
    "assess-readiness",
    "assess-transformation",
    "predict",
    "forecast",
    "simulate",
    "plan-work",
    "generate-roadmap",
    "recommend-actions",
    "recommend-strategy",
    "prioritize",
    "execute",
    "run-workflow",
    "call-ai",
    "call-llm",
    "persist",
    "invoke-api",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "modify-learning",
    "modify-optimization",
    "modify-awareness",
    "approve",
    "decide",
    "bypass-director",
  ]);

/** The approval marker every prepared set carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed evolution pass entering the boundary. */
export interface EvolutionCandidateInput {
  readonly request: EvolutionCandidateRequest;
}

/** The result of preparing evolution candidates: canonical, or an explicit failure. */
export type EvolutionCandidateResult =
  | { readonly ok: true; readonly value: CanonicalEvolutionCandidateSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, identifies, preserves, and freezes an Evolution Candidate set. Pure and
 * deterministic: the same input always produces the same result. A validation failure
 * yields explicit issues and no set. This is the only entry the evolution pass exposes,
 * and it neither assesses, predicts, forecasts, simulates, plans, generates a roadmap,
 * recommends, prioritizes, nor runs anything: it identifies candidates from the assembled
 * context, the qualified learning, optimization, and awareness sets, and eligible
 * evidence, preserves their supporting references, provenance, explanation, confidence,
 * and uncertainty, and stops at the Director Approval boundary.
 */
export function prepareEvolutionCandidates(
  input: EvolutionCandidateInput,
): EvolutionCandidateResult {
  const requestValidation = validateEvolutionCandidateRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const set: EvolutionCandidateSet = {
    requestId: input.request.requestId,
    candidates: identifyEvolutionCandidates(input.request),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const setValidation = validateEvolutionCandidateSet(set);
  if (!setValidation.ok) return { ok: false, issues: setValidation.issues };

  return { ok: true, value: normalizeEvolutionCandidateSet(set) };
}
