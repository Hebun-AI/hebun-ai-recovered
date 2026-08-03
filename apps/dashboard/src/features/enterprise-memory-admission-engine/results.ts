/**
 * Enterprise Memory Admission Engine — decision derivation and result assembly.
 *
 * Derives the admission decision from the stage findings using a single explicit
 * precedence. The precedence is fixed and total: the same findings always yield
 * the same decision. No transition, no persistence, no automation — a decision is
 * a value, and the result is an immutable record of how it was reached.
 */

import type { MemoryCandidate, MemoryTimestamp } from "@/features/enterprise-memory";
import type {
  AdmissionAuthority,
  AdmissionDecision,
  AdmissionPolicy,
  AdmissionPolicyId,
  MemoryEvaluation,
} from "@/features/enterprise-memory-admission";
import type {
  AuthorityCheck,
  EvaluationAssessment,
  MemoryAdmissionResult,
  PolicyCheck,
} from "@/features/enterprise-memory-admission-engine/contracts";

const REQUIRED_POLICY_KINDS: ReadonlySet<AdmissionPolicy["kind"]> = new Set([
  "required-evidence",
  "required-authority",
  "required-confidence",
  "required-classification",
]);

export interface DecisionContext {
  readonly authorityCheck: AuthorityCheck;
  readonly assessment: EvaluationAssessment;
  readonly policyChecks: readonly PolicyCheck[];
  readonly authority: AdmissionAuthority;
  readonly policySetId: AdmissionPolicyId;
  readonly decidedAt: MemoryTimestamp;
}

/**
 * Derives the decision. Precedence, top to bottom:
 *   1. authority not accepted        → rejected
 *   2. required dimensions unassessed → deferred
 *   3. required policy unsatisfied    → rejected
 *   4. a review policy applies        → needs-review
 *   5. otherwise                      → approved
 */
export function deriveDecision(context: DecisionContext): AdmissionDecision {
  const decidedBy = context.authority.authorityId;
  const appliedPolicySet = context.policySetId;
  const decidedAt = context.decidedAt;

  if (!context.authorityCheck.accepted) {
    return Object.freeze({
      outcome: "rejected",
      decidedBy,
      decidedAt,
      appliedPolicySet,
      reason: context.authorityCheck.reason,
    });
  }

  if (context.assessment.unassessedRequired.length > 0) {
    return Object.freeze({
      outcome: "deferred",
      decidedBy,
      decidedAt,
      appliedPolicySet,
      pendingOn: context.assessment.unassessedRequired,
    });
  }

  const failedRequired = context.policyChecks.filter(
    (check) => REQUIRED_POLICY_KINDS.has(check.policy.kind) && !check.satisfied,
  );
  if (failedRequired.length > 0 || context.assessment.insufficient.length > 0) {
    const reason = [
      ...failedRequired.map((check) => check.reason),
      ...context.assessment.insufficient.map((dimension) => `dimension "${dimension}" below required standing`),
    ].join("; ");
    return Object.freeze({ outcome: "rejected", decidedBy, decidedAt, appliedPolicySet, reason });
  }

  const requiresReview = context.policyChecks.some((check) => check.policy.kind === "review");
  if (requiresReview) {
    return Object.freeze({
      outcome: "needs-review",
      decidedBy,
      decidedAt,
      appliedPolicySet,
      reviewNote: "a review policy applies to this admission",
    });
  }

  return Object.freeze({ outcome: "approved", decidedBy, decidedAt, appliedPolicySet });
}

export interface ResultAssembly {
  readonly candidate: MemoryCandidate;
  readonly evaluation: MemoryEvaluation;
  readonly authority: AdmissionAuthority;
  readonly appliedPolicies: readonly AdmissionPolicy[];
  readonly assessment: EvaluationAssessment;
  readonly authorityCheck: AuthorityCheck;
  readonly policyChecks: readonly PolicyCheck[];
  readonly decision: AdmissionDecision;
  readonly decidedAt: MemoryTimestamp;
}

/** Collects the human-readable reasons that explain the decision. */
function collectReasons(assembly: ResultAssembly): readonly string[] {
  const reasons: string[] = [assembly.authorityCheck.reason];
  for (const check of assembly.policyChecks) reasons.push(check.reason);
  for (const dimension of assembly.assessment.unassessedRequired) reasons.push(`"${dimension}" unassessed`);
  for (const dimension of assembly.assessment.insufficient) reasons.push(`"${dimension}" insufficient`);
  return Object.freeze(reasons);
}

export function buildResult(assembly: ResultAssembly): MemoryAdmissionResult {
  return Object.freeze({
    candidate: assembly.candidate,
    evaluation: assembly.evaluation,
    authority: assembly.authority,
    appliedPolicies: assembly.appliedPolicies,
    assessment: assembly.assessment,
    authorityCheck: assembly.authorityCheck,
    policyChecks: assembly.policyChecks,
    decision: assembly.decision,
    reasons: collectReasons(assembly),
    decidedAt: assembly.decidedAt,
  });
}
