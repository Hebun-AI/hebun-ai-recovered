/**
 * Enterprise Memory Admission Engine — evaluation assessment.
 *
 * Consumes the published MemoryEvaluation and checks deterministic contract
 * conditions only. It never calculates confidence, never uses AI, and never
 * rewrites the evaluation. Standings are compared using a fixed ordinal ordering
 * — an explicit total order over the published enums, not a computed score.
 */

import type {
  AdmissionPolicy,
  DimensionAssessment,
  EvaluationStanding,
  MemoryEvaluation,
} from "@/features/enterprise-memory-admission";
import type { EvaluationAssessment } from "@/features/enterprise-memory-admission-engine/contracts";

/** Fixed total order over the published standing enum. Not a score. */
const STANDING_ORDER: Readonly<Record<EvaluationStanding, number>> = Object.freeze({
  unassessed: 0,
  insufficient: 1,
  weak: 2,
  adequate: 3,
  strong: 4,
});

export function standingRank(standing: EvaluationStanding): number {
  return STANDING_ORDER[standing];
}

function findAssessment(
  evaluation: MemoryEvaluation,
  dimension: string,
): DimensionAssessment | undefined {
  return evaluation.dimensions.find((assessment) => assessment.dimension === dimension);
}

/** The minimum standing an evaluated dimension must reach to count as sufficient. */
const REQUIRED_STANDING: EvaluationStanding = "adequate";

/**
 * Determines, for the dimensions named by required policies, which are still
 * unassessed and which are assessed but below the required standing.
 */
export function assessEvaluation(
  evaluation: MemoryEvaluation,
  policies: readonly AdmissionPolicy[],
): EvaluationAssessment {
  const requiredDimensions = new Set<string>();
  for (const policy of policies) {
    if (policy.kind === "required-evidence") {
      for (const dimension of policy.dimensions) requiredDimensions.add(dimension);
    }
    if (policy.kind === "required-confidence") {
      requiredDimensions.add("confidence");
    }
  }

  const unassessedRequired: string[] = [];
  const insufficient: string[] = [];
  for (const dimension of requiredDimensions) {
    const assessment = findAssessment(evaluation, dimension);
    if (assessment === undefined || assessment.standing === "unassessed") {
      unassessedRequired.push(dimension);
      continue;
    }
    if (standingRank(assessment.standing) < standingRank(REQUIRED_STANDING)) {
      insufficient.push(dimension);
    }
  }

  return Object.freeze({
    unassessedRequired: Object.freeze([...unassessedRequired].sort()),
    insufficient: Object.freeze([...insufficient].sort()),
  });
}
