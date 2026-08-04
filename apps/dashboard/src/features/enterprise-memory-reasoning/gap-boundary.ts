/**
 * Enterprise Memory Reasoning — gap boundary (Phase 4).
 *
 * The boundary through which classified gaps enter and leave the gap foundation.
 * It validates a proposed gap set against declared evidence, relations,
 * implications, and contradictions, then normalizes it into a canonical, immutable
 * form. It performs NO detection and marks NO gaps of its own — it only accepts,
 * checks, and canonicalizes the gaps it is given, and never fills them.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ClassifiedGap } from "@/features/enterprise-memory-reasoning/gap-types";
import { normalizeGaps } from "@/features/enterprise-memory-reasoning/gap-normalization";
import { validateGapSet } from "@/features/enterprise-memory-reasoning/gap-validation";

/** A proposed set of classified gaps entering the boundary. */
export interface GapSet {
  readonly gaps: readonly ClassifiedGap[];
}

/** A validated, normalized, immutable set of gaps leaving the boundary. */
export interface NormalizedGapSet {
  readonly gaps: readonly ClassifiedGap[];
}

/** The result of preparing a gap set: normalized, or an explicit failure. */
export type GapSetResult =
  | { readonly ok: true; readonly value: NormalizedGapSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes a gap set against the declared evidence, relations,
 * implications, and contradictions. Pure and deterministic: the same input always
 * produces the same result. A validation failure yields explicit issues and no
 * normalized set.
 */
export function normalizeGapSet(
  input: GapSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
): GapSetResult {
  const validation = validateGapSet(input.gaps, evidence, relations, implications, contradictions);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ gaps: normalizeGaps(input.gaps) }) };
}
