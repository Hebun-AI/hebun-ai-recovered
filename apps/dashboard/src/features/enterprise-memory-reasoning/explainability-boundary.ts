/**
 * Enterprise Memory Reasoning — explainability boundary (Phase 6).
 *
 * The boundary through which explanations enter and leave the explainability
 * foundation. It validates a proposed set against the declared evidence, relations,
 * implications, contradictions, gaps, and provenance, then normalizes it into a
 * canonical, immutable form. It performs NO explanation generation and composes NO
 * walk of its own — it only accepts, checks, and canonicalizes the explanations it
 * is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { Provenance } from "@/features/enterprise-memory-reasoning/provenance-types";
import type { Explanation } from "@/features/enterprise-memory-reasoning/explainability-types";
import { normalizeExplanations } from "@/features/enterprise-memory-reasoning/explainability-normalization";
import { validateExplanationSet } from "@/features/enterprise-memory-reasoning/explainability-validation";

/** A proposed set of explanations entering the boundary. */
export interface ExplanationSet {
  readonly explanations: readonly Explanation[];
}

/** A validated, normalized, immutable set of explanations leaving the boundary. */
export interface NormalizedExplanationSet {
  readonly explanations: readonly Explanation[];
}

/** The result of preparing an explanation set: normalized, or an explicit failure. */
export type ExplanationSetResult =
  | { readonly ok: true; readonly value: NormalizedExplanationSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes an explanation set against the declared evidence,
 * relations, implications, contradictions, gaps, and provenance. Pure and
 * deterministic: the same input always produces the same result. A validation
 * failure yields explicit issues and no normalized set.
 */
export function normalizeExplanationSet(
  input: ExplanationSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
  provenances: readonly Provenance[],
): ExplanationSetResult {
  const validation = validateExplanationSet(
    input.explanations,
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  );
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ explanations: normalizeExplanations(input.explanations) }) };
}
