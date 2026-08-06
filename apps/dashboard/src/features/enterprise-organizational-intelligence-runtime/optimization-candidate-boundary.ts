/**
 * Enterprise Organizational Intelligence Runtime — optimization candidate boundary (Phase 4).
 *
 * The immutable boundary through which a proposed optimization request enters and a
 * frozen Optimization Candidate set leaves, and the canonical declaration of what the
 * optimization pass MAY do and what it MUST NEVER do. It validates a request, identifies
 * candidates from the assembled Runtime Context, the qualified Learning Candidate set,
 * and eligible evidence, preserves each candidate's supporting learning and evidence
 * references, provenance, explainability, confidence, and uncertainty, and freezes them
 * into an immutable set awaiting Director review.
 *
 * It performs NO decision, NO prioritization, NO planning, NO workflow orchestration, NO
 * reorganization, NO work reassignment, NO execution, NO AI call, NO LLM call, NO memory
 * or organization-state change, NO optimization engine, NO prioritization algorithm, NO
 * persistence, NO API call, NO UI, and it never bypasses the Director. Every permitted
 * capability is read-only, identifying, or preserving. Every prohibited capability is
 * explicitly modelled so that no later phase can quietly acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalOptimizationCandidateSet,
  OptimizationCandidateRequest,
  OptimizationCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import { identifyOptimizationCandidates } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-rules";
import { normalizeOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-normalization";
import {
  validateOptimizationCandidateRequest,
  validateOptimizationCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";

/** The things the optimization pass MAY do. Read-only, identifying, or preserving only. */
export type OptimizationCandidateCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "assemble-evidence"
  | "identify-candidate"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "preserve-learning-references"
  | "preserve-evidence-references"
  | "prepare-immutable-candidate"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of optimization pass capabilities. */
export const OPTIMIZATION_CANDIDATE_CAPABILITIES: readonly OptimizationCandidateCapability[] =
  Object.freeze([
    "consume-runtime-bundle",
    "consume-learning-candidate-set",
    "assemble-evidence",
    "identify-candidate",
    "preserve-provenance",
    "preserve-explainability",
    "preserve-confidence",
    "preserve-uncertainty",
    "preserve-learning-references",
    "preserve-evidence-references",
    "prepare-immutable-candidate",
    "validate",
    "normalize",
    "freeze",
  ]);

/** The things the optimization pass MUST NEVER do or become. Every prohibition is explicit. */
export type OptimizationCandidateNonResponsibility =
  | "decide"
  | "prioritize"
  | "plan"
  | "orchestrate-workflow"
  | "reorganize"
  | "reassign-work"
  | "execute"
  | "call-ai"
  | "call-llm"
  | "modify-memory"
  | "admit-knowledge"
  | "modify-organization"
  | "run-optimization-engine"
  | "run-prioritization-algorithm"
  | "persist"
  | "invoke-api"
  | "control-ui"
  | "bypass-director";

/** The canonical, frozen set of optimization pass non-responsibilities. */
export const OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES: readonly OptimizationCandidateNonResponsibility[] =
  Object.freeze([
    "decide",
    "prioritize",
    "plan",
    "orchestrate-workflow",
    "reorganize",
    "reassign-work",
    "execute",
    "call-ai",
    "call-llm",
    "modify-memory",
    "admit-knowledge",
    "modify-organization",
    "run-optimization-engine",
    "run-prioritization-algorithm",
    "persist",
    "invoke-api",
    "control-ui",
    "bypass-director",
  ]);

/** The approval marker every prepared set carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed optimization pass entering the boundary. */
export interface OptimizationCandidateInput {
  readonly request: OptimizationCandidateRequest;
}

/** The result of preparing optimization candidates: canonical, or an explicit failure. */
export type OptimizationCandidateResult =
  | { readonly ok: true; readonly value: CanonicalOptimizationCandidateSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, identifies, preserves, and freezes an Optimization Candidate set. Pure and
 * deterministic: the same input always produces the same result. A validation failure
 * yields explicit issues and no set. This is the only entry the optimization pass
 * exposes, and it neither decides, prioritizes, plans, orchestrates, nor runs anything:
 * it identifies candidates from the assembled context, the qualified learning set, and
 * eligible evidence, preserves their supporting references, provenance, explanation,
 * confidence, and uncertainty, and stops at the Director Approval boundary.
 */
export function prepareOptimizationCandidates(
  input: OptimizationCandidateInput,
): OptimizationCandidateResult {
  const requestValidation = validateOptimizationCandidateRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const set: OptimizationCandidateSet = {
    requestId: input.request.requestId,
    candidates: identifyOptimizationCandidates(input.request),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const setValidation = validateOptimizationCandidateSet(set);
  if (!setValidation.ok) return { ok: false, issues: setValidation.issues };

  return { ok: true, value: normalizeOptimizationCandidateSet(set) };
}
