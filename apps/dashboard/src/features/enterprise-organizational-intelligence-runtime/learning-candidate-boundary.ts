/**
 * Enterprise Organizational Intelligence Runtime — learning candidate boundary (Phase 3).
 *
 * The immutable boundary through which a proposed learning request enters and a frozen
 * Learning Candidate set leaves, and the canonical declaration of what the learning
 * pass MAY do and what it MUST NEVER do. It validates a request, identifies candidates
 * from the assembled Runtime Context and its eligible evidence, preserves each
 * candidate's provenance, explainability, confidence, and uncertainty, and freezes them
 * into an immutable set awaiting Director review.
 *
 * It performs NO knowledge admission, NO memory modification, NO fact creation, NO
 * decision, NO approval, NO workflow execution, NO AI call, NO LLM call, NO
 * orchestration, NO work planning, NO action, NO organization-state change, and it never
 * bypasses the Director. Every permitted capability is read-only, identifying, or
 * preserving. Every prohibited capability is explicitly modelled so that no later phase
 * can quietly acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalLearningCandidateSet,
  LearningCandidateRequest,
  LearningCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import { identifyLearningCandidates } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-rules";
import { normalizeLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-normalization";
import {
  validateLearningCandidateRequest,
  validateLearningCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";

/** The things the learning pass MAY do. Read-only, identifying, or preserving only. */
export type LearningCandidateCapability =
  | "assemble-evidence"
  | "assemble-reasoning"
  | "assemble-organization-context"
  | "identify-candidate"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "prepare-immutable-candidate"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of learning pass capabilities. */
export const LEARNING_CANDIDATE_CAPABILITIES: readonly LearningCandidateCapability[] = Object.freeze([
  "assemble-evidence",
  "assemble-reasoning",
  "assemble-organization-context",
  "identify-candidate",
  "preserve-provenance",
  "preserve-explainability",
  "preserve-confidence",
  "preserve-uncertainty",
  "prepare-immutable-candidate",
  "validate",
  "normalize",
  "freeze",
]);

/** The things the learning pass MUST NEVER do or become. Every prohibition is explicit. */
export type LearningCandidateNonResponsibility =
  | "modify-memory"
  | "admit-knowledge"
  | "create-fact"
  | "decide"
  | "approve-candidate"
  | "execute-workflow"
  | "call-ai"
  | "call-llm"
  | "orchestrate"
  | "plan-work"
  | "execute-action"
  | "modify-organization"
  | "bypass-director";

/** The canonical, frozen set of learning pass non-responsibilities. */
export const LEARNING_CANDIDATE_NON_RESPONSIBILITIES: readonly LearningCandidateNonResponsibility[] =
  Object.freeze([
    "modify-memory",
    "admit-knowledge",
    "create-fact",
    "decide",
    "approve-candidate",
    "execute-workflow",
    "call-ai",
    "call-llm",
    "orchestrate",
    "plan-work",
    "execute-action",
    "modify-organization",
    "bypass-director",
  ]);

/** The approval marker every prepared set carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed learning pass entering the boundary. */
export interface LearningCandidateInput {
  readonly request: LearningCandidateRequest;
}

/** The result of preparing learning candidates: canonical, or an explicit failure. */
export type LearningCandidateResult =
  | { readonly ok: true; readonly value: CanonicalLearningCandidateSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, identifies, preserves, and freezes a Learning Candidate set. Pure and
 * deterministic: the same input always produces the same result. A validation failure
 * yields explicit issues and no set. This is the only entry the learning pass exposes,
 * and it neither admits knowledge, creates facts, decides, approves, nor runs anything:
 * it identifies candidates from the assembled context and its eligible evidence,
 * preserves their provenance, explanation, confidence, and uncertainty, and stops at
 * the Director Approval boundary.
 */
export function prepareLearningCandidates(input: LearningCandidateInput): LearningCandidateResult {
  const requestValidation = validateLearningCandidateRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const set: LearningCandidateSet = {
    requestId: input.request.requestId,
    candidates: identifyLearningCandidates(input.request),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const setValidation = validateLearningCandidateSet(set);
  if (!setValidation.ok) return { ok: false, issues: setValidation.issues };

  return { ok: true, value: normalizeLearningCandidateSet(set) };
}
