/**
 * Enterprise Memory Admission Engine — engine contracts.
 *
 * The engine executes the admission model defined by the published Phase 1 and
 * Phase 2 contracts. It is deterministic and pure: given the same input it always
 * produces the same result. It computes nothing probabilistic — no AI, no
 * reasoning, no scoring. The engine consumes an already-produced evaluation; it
 * never generates or rewrites one.
 */

import type { MemoryCandidate, MemoryTimestamp } from "@/features/enterprise-memory";
import type {
  AdmissionAuthority,
  AdmissionDecision,
  AdmissionPolicy,
  AdmissionPolicySet,
  MemoryEvaluation,
  ReviewerIdentity,
} from "@/features/enterprise-memory-admission";

/**
 * The complete, deterministic input to one admission run. The timestamp is
 * injected — the engine never reads a clock — so runs are reproducible.
 */
export interface AdmissionEngineInput {
  readonly candidate: MemoryCandidate;
  readonly evaluation: MemoryEvaluation;
  readonly authority: AdmissionAuthority;
  readonly policySet: AdmissionPolicySet;
  readonly reviewer: ReviewerIdentity;
  readonly evaluatedAt: MemoryTimestamp;
}

/** The outcome of validating a single policy. Immutable, reason-carrying. */
export interface PolicyCheck {
  readonly policy: AdmissionPolicy;
  readonly satisfied: boolean;
  readonly reason: string;
}

/** The outcome of validating the claimed authority against required-authority. */
export interface AuthorityCheck {
  readonly authority: AdmissionAuthority;
  readonly accepted: boolean;
  readonly reason: string;
}

/** The deterministic assessment derived from the supplied evaluation. */
export interface EvaluationAssessment {
  /** Dimensions required by policy that carry no assessment yet. */
  readonly unassessedRequired: readonly string[];
  /** Dimensions required by policy that fall below the required standing. */
  readonly insufficient: readonly string[];
}

/**
 * The immutable result of one admission run. It records every stage's finding so
 * the decision is fully explainable without re-running the engine.
 */
export interface MemoryAdmissionResult {
  readonly candidate: MemoryCandidate;
  readonly evaluation: MemoryEvaluation;
  readonly authority: AdmissionAuthority;
  readonly appliedPolicies: readonly AdmissionPolicy[];
  readonly assessment: EvaluationAssessment;
  readonly authorityCheck: AuthorityCheck;
  readonly policyChecks: readonly PolicyCheck[];
  readonly decision: AdmissionDecision;
  readonly reasons: readonly string[];
  readonly decidedAt: MemoryTimestamp;
}
