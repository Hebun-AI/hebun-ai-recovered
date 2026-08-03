/**
 * Enterprise Memory Admission — evaluation contracts.
 *
 * Evaluation models the independent dimensions along which a candidate can be
 * assessed. Dimensions are orthogonal: each is assessed on its own and none is
 * derived from another. Scoring is NOT hardcoded — a dimension carries a
 * technology-neutral assessment shape only. No AI, no LLM, no computation, no
 * ranking logic lives here. Contracts only.
 */

import type { MemoryReference, MemoryTimestamp } from "@/features/enterprise-memory";

/** The orthogonal evaluation dimensions. */
export type EvaluationDimension =
  | "truth"
  | "relevance"
  | "business-value"
  | "strategic-importance"
  | "confidence"
  | "evidence"
  | "freshness"
  | "consistency"
  | "source-reliability";

/** A qualitative standing for a dimension. Neutral; no numeric scale is implied. */
export type EvaluationStanding =
  | "unassessed"
  | "insufficient"
  | "weak"
  | "adequate"
  | "strong";

/** A reference to evidence supporting an assessment. Reference only, no content. */
export interface EvidenceReference {
  readonly evidenceId: string;
  readonly describedBy: string;
  readonly memory?: MemoryReference;
}

/**
 * A single dimension's assessment. `measure` is an optional normalized 0..1
 * value; it is neutral data, not a computed score and not a decision input rule.
 */
export interface DimensionAssessment {
  readonly dimension: EvaluationDimension;
  readonly standing: EvaluationStanding;
  readonly measure?: number;
  readonly evidence: readonly EvidenceReference[];
}

/** The complete, immutable evaluation of a candidate across all dimensions. */
export interface MemoryEvaluation {
  readonly assessedAt: MemoryTimestamp;
  readonly dimensions: readonly DimensionAssessment[];
}
