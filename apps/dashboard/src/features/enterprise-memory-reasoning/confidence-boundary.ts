/**
 * Enterprise Memory Reasoning — confidence & uncertainty boundary (Phase 7).
 *
 * The boundary through which confidence assessments enter and leave the confidence
 * foundation. It validates a proposed set against the declared evidence, relations,
 * implications, contradictions, and gaps, then normalizes it into a canonical,
 * immutable form. It performs NO confidence calculation, NO scoring, and NO ranking
 * — it only accepts, checks, and canonicalizes the assessments it is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { Confidence } from "@/features/enterprise-memory-reasoning/confidence-types";
import { normalizeConfidences } from "@/features/enterprise-memory-reasoning/confidence-normalization";
import { validateConfidenceSet } from "@/features/enterprise-memory-reasoning/confidence-validation";

/** A proposed set of confidence assessments entering the boundary. */
export interface ConfidenceSet {
  readonly confidences: readonly Confidence[];
}

/** A validated, normalized, immutable set of confidence assessments leaving the boundary. */
export interface NormalizedConfidenceSet {
  readonly confidences: readonly Confidence[];
}

/** The result of preparing a confidence set: normalized, or an explicit failure. */
export type ConfidenceSetResult =
  | { readonly ok: true; readonly value: NormalizedConfidenceSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes a confidence set against the declared evidence,
 * relations, implications, contradictions, and gaps. Pure and deterministic: the
 * same input always produces the same result. A validation failure yields explicit
 * issues and no normalized set.
 */
export function normalizeConfidenceSet(
  input: ConfidenceSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
): ConfidenceSetResult {
  const validation = validateConfidenceSet(input.confidences, evidence, relations, implications, contradictions, gaps);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ confidences: normalizeConfidences(input.confidences) }) };
}
