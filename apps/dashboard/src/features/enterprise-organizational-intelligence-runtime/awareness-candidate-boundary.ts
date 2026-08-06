/**
 * Enterprise Organizational Intelligence Runtime — awareness candidate boundary (Phase 5).
 *
 * The immutable boundary through which a proposed awareness request enters and a frozen
 * Awareness Candidate set leaves, and the canonical declaration of what the awareness pass
 * MAY do and what it MUST NEVER do. It validates a request, identifies candidates from the
 * assembled Runtime Context, the qualified Learning Candidate set, the qualified
 * Optimization Candidate set, and eligible evidence, preserves each candidate's supporting
 * learning, optimization, and evidence references, provenance, explainability, confidence,
 * and uncertainty, and freezes them into an immutable set awaiting Director review.
 *
 * It performs NO awareness assessment, NO monitoring, NO scoring, NO recommendation, NO
 * alerting, NO prioritization, NO work planning, NO work execution, NO workflow, NO AI
 * call, NO LLM call, NO memory change, NO reasoning change, NO organization change, NO
 * optimization change, NO learning change, NO persistence, NO API call, NO approval, NO
 * decision, and it never bypasses the Director. Every permitted capability is read-only,
 * identifying, or preserving. Every prohibited capability is explicitly modelled so that
 * no later phase can quietly acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  AwarenessCandidateRequest,
  AwarenessCandidateSet,
  CanonicalAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import { identifyAwarenessCandidates } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";
import { normalizeAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-normalization";
import {
  validateAwarenessCandidateRequest,
  validateAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";

/** The things the awareness pass MAY do. Read-only, identifying, or preserving only. */
export type AwarenessCandidateCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "consume-optimization-candidate-set"
  | "assemble-evidence"
  | "identify-candidate"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "preserve-learning-references"
  | "preserve-optimization-references"
  | "preserve-evidence-references"
  | "prepare-immutable-candidate"
  | "prepare-for-director"
  | "prepare-for-heby-explanation"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of awareness pass capabilities. */
export const AWARENESS_CANDIDATE_CAPABILITIES: readonly AwarenessCandidateCapability[] =
  Object.freeze([
    "consume-runtime-bundle",
    "consume-learning-candidate-set",
    "consume-optimization-candidate-set",
    "assemble-evidence",
    "identify-candidate",
    "preserve-provenance",
    "preserve-explainability",
    "preserve-confidence",
    "preserve-uncertainty",
    "preserve-learning-references",
    "preserve-optimization-references",
    "preserve-evidence-references",
    "prepare-immutable-candidate",
    "prepare-for-director",
    "prepare-for-heby-explanation",
    "validate",
    "normalize",
    "freeze",
  ]);

/** The things the awareness pass MUST NEVER do or become. Every prohibition is explicit. */
export type AwarenessCandidateNonResponsibility =
  | "assess"
  | "monitor"
  | "score"
  | "recommend"
  | "alert"
  | "prioritize"
  | "plan-work"
  | "execute-work"
  | "run-workflow"
  | "call-ai"
  | "call-llm"
  | "persist"
  | "invoke-api"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "modify-optimization"
  | "change-learning"
  | "approve"
  | "decide"
  | "execute"
  | "bypass-director";

/** The canonical, frozen set of awareness pass non-responsibilities. */
export const AWARENESS_CANDIDATE_NON_RESPONSIBILITIES: readonly AwarenessCandidateNonResponsibility[] =
  Object.freeze([
    "assess",
    "monitor",
    "score",
    "recommend",
    "alert",
    "prioritize",
    "plan-work",
    "execute-work",
    "run-workflow",
    "call-ai",
    "call-llm",
    "persist",
    "invoke-api",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "modify-optimization",
    "change-learning",
    "approve",
    "decide",
    "execute",
    "bypass-director",
  ]);

/** The approval marker every prepared set carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed awareness pass entering the boundary. */
export interface AwarenessCandidateInput {
  readonly request: AwarenessCandidateRequest;
}

/** The result of preparing awareness candidates: canonical, or an explicit failure. */
export type AwarenessCandidateResult =
  | { readonly ok: true; readonly value: CanonicalAwarenessCandidateSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, identifies, preserves, and freezes an Awareness Candidate set. Pure and
 * deterministic: the same input always produces the same result. A validation failure
 * yields explicit issues and no set. This is the only entry the awareness pass exposes,
 * and it neither assesses, monitors, scores, recommends, alerts, prioritizes, nor runs
 * anything: it identifies candidates from the assembled context, the qualified learning
 * set, the qualified optimization set, and eligible evidence, preserves their supporting
 * references, provenance, explanation, confidence, and uncertainty, and stops at the
 * Director Approval boundary.
 */
export function prepareAwarenessCandidates(
  input: AwarenessCandidateInput,
): AwarenessCandidateResult {
  const requestValidation = validateAwarenessCandidateRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const set: AwarenessCandidateSet = {
    requestId: input.request.requestId,
    candidates: identifyAwarenessCandidates(input.request),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const setValidation = validateAwarenessCandidateSet(set);
  if (!setValidation.ok) return { ok: false, issues: setValidation.issues };

  return { ok: true, value: normalizeAwarenessCandidateSet(set) };
}
