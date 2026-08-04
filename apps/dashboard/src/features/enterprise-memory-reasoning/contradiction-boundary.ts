/**
 * Enterprise Memory Reasoning — contradiction boundary (Phase 4).
 *
 * The boundary through which classified contradictions enter and leave the
 * contradiction foundation. It validates a proposed contradiction set against
 * declared evidence, relations, and implications, then normalizes it into a
 * canonical, immutable form. It performs NO detection and surfaces NO
 * contradictions — it only accepts, checks, and canonicalizes what it is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ClassifiedContradiction } from "@/features/enterprise-memory-reasoning/contradiction-types";
import { normalizeContradictions } from "@/features/enterprise-memory-reasoning/contradiction-normalization";
import { validateContradictionSet } from "@/features/enterprise-memory-reasoning/contradiction-validation";

/** A proposed set of classified contradictions entering the boundary. */
export interface ContradictionSet {
  readonly contradictions: readonly ClassifiedContradiction[];
}

/** A validated, normalized, immutable set of contradictions leaving the boundary. */
export interface NormalizedContradictionSet {
  readonly contradictions: readonly ClassifiedContradiction[];
}

/** The result of preparing a contradiction set: normalized, or an explicit failure. */
export type ContradictionSetResult =
  | { readonly ok: true; readonly value: NormalizedContradictionSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes a contradiction set against the declared evidence,
 * relations, and implications. Pure and deterministic: the same input always
 * produces the same result. A validation failure yields explicit issues and no
 * normalized set.
 */
export function normalizeContradictionSet(
  input: ContradictionSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
): ContradictionSetResult {
  const validation = validateContradictionSet(input.contradictions, evidence, relations, implications);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return {
    ok: true,
    value: Object.freeze({ contradictions: normalizeContradictions(input.contradictions) }),
  };
}
