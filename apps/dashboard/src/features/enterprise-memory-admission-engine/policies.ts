/**
 * Enterprise Memory Admission Engine — policy evaluation.
 *
 * Evaluates each published policy deterministically against the candidate and its
 * evaluation. There is no scoring, no ranking, no heuristic, and no probabilistic
 * step: every check is a plain, total predicate over contract data.
 */

import type { MemoryCandidate, MemoryConfidenceLevel } from "@/features/enterprise-memory";
import type {
  AdmissionAuthority,
  AdmissionPolicy,
  MemoryEvaluation,
} from "@/features/enterprise-memory-admission";
import type { PolicyCheck } from "@/features/enterprise-memory-admission-engine/contracts";
import { standingRank } from "@/features/enterprise-memory-admission-engine/evaluator";

/** Fixed total order over the published confidence enum. Not a score. */
const CONFIDENCE_ORDER: Readonly<Record<MemoryConfidenceLevel, number>> = Object.freeze({
  low: 0,
  medium: 1,
  high: 2,
  verified: 3,
});

function frozenCheck(policy: AdmissionPolicy, satisfied: boolean, reason: string): PolicyCheck {
  return Object.freeze({ policy, satisfied, reason });
}

function countEvidence(evaluation: MemoryEvaluation, dimensions: readonly string[]): number {
  let count = 0;
  for (const assessment of evaluation.dimensions) {
    if (dimensions.includes(assessment.dimension)) count += assessment.evidence.length;
  }
  return count;
}

/** Evaluates a single policy. The order of returned checks mirrors policy order. */
export function evaluatePolicy(
  policy: AdmissionPolicy,
  candidate: MemoryCandidate,
  evaluation: MemoryEvaluation,
  authority: AdmissionAuthority,
): PolicyCheck {
  switch (policy.kind) {
    case "required-evidence": {
      const count = countEvidence(evaluation, policy.dimensions);
      const satisfied = count >= policy.minimumCount;
      return frozenCheck(policy, satisfied, `evidence ${count}/${policy.minimumCount} on required dimensions`);
    }
    case "required-authority": {
      const satisfied = policy.acceptedAuthorities.includes(authority.kind);
      return frozenCheck(policy, satisfied, `authority "${authority.kind}" ${satisfied ? "accepted" : "not accepted"}`);
    }
    case "required-confidence": {
      const levelOk = CONFIDENCE_ORDER[candidate.confidence.level] >= CONFIDENCE_ORDER[policy.minimumLevel];
      const dimension = evaluation.dimensions.find((entry) => entry.dimension === "confidence");
      const standingOk = dimension !== undefined && standingRank(dimension.standing) >= standingRank(policy.minimumStanding);
      const satisfied = levelOk && standingOk;
      return frozenCheck(policy, satisfied, `confidence level ${levelOk ? "meets" : "below"} / standing ${standingOk ? "meets" : "below"}`);
    }
    case "required-classification": {
      const sensitivityOk = policy.acceptedSensitivities.includes(candidate.classification.sensitivity);
      const categoryOk = policy.requiredCategory === undefined || policy.requiredCategory === candidate.classification.category;
      const satisfied = sensitivityOk && categoryOk;
      return frozenCheck(policy, satisfied, `classification sensitivity ${sensitivityOk ? "ok" : "rejected"}, category ${categoryOk ? "ok" : "mismatch"}`);
    }
    case "expiration": {
      // Declarative: governs post-admission validity, never blocks admission.
      return frozenCheck(policy, true, `declarative expiration of ${policy.validForDays} days`);
    }
    case "review": {
      // Declarative: presence requires human review; handled at the decision stage.
      return frozenCheck(policy, true, `review required every ${policy.reviewEveryDays} days`);
    }
  }
}

/** Evaluates every policy in a stable order (input order preserved). */
export function evaluatePolicies(
  policies: readonly AdmissionPolicy[],
  candidate: MemoryCandidate,
  evaluation: MemoryEvaluation,
  authority: AdmissionAuthority,
): readonly PolicyCheck[] {
  return Object.freeze(policies.map((policy) => evaluatePolicy(policy, candidate, evaluation, authority)));
}
