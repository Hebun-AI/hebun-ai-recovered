/**
 * Enterprise Memory Reasoning — confidence contracts.
 *
 * Confidence states how far a conclusion can be trusted, and uncertainty states
 * what it does not know. These are contract shapes only — Phase 1 declares what a
 * confidence assessment IS; it computes none. There is no probabilistic scoring,
 * no AI, and no model here — confidence is a plainly declared, explainable level.
 */

import type { ReasoningId, ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

/** A plainly declared confidence level. Ordinal in meaning, not a computed score. */
export type ReasoningConfidenceLevel = "low" | "medium" | "high" | "verified";

/** An explicitly stated thing a conclusion does not know. */
export interface ReasoningUncertainty {
  readonly statement: ReasoningStatement;
}

/** A declared confidence assessment with its rationale and stated uncertainties. */
export interface ReasoningConfidence {
  readonly assessmentId: ReasoningId;
  readonly level: ReasoningConfidenceLevel;
  readonly rationale: ReasoningStatement;
  readonly uncertainties: readonly ReasoningUncertainty[];
}
