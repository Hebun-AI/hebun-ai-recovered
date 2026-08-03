/**
 * Enterprise Memory Reasoning — relation boundary (Phase 2).
 *
 * The boundary through which explicit relations enter and leave the relation
 * foundation. It validates a proposed relation set against declared evidence, then
 * normalizes it into a canonical, immutable form. It performs NO inference, NO
 * traversal, NO graph execution, and derives NO new relations — it only accepts,
 * checks, and canonicalizes the explicit relations it is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import { normalizeRelations } from "@/features/enterprise-memory-reasoning/relation-normalization";
import { validateRelationSet } from "@/features/enterprise-memory-reasoning/relation-validation";

/** A proposed set of explicit relations entering the boundary. */
export interface RelationSet {
  readonly relations: readonly ReasoningRelation[];
}

/** A validated, normalized, immutable set of relations leaving the boundary. */
export interface NormalizedRelationSet {
  readonly relations: readonly ReasoningRelation[];
}

/** The result of preparing a relation set: normalized, or an explicit failure. */
export type RelationSetResult =
  | { readonly ok: true; readonly value: NormalizedRelationSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes a relation set against the declared evidence. Pure and
 * deterministic: the same input always produces the same result. A validation
 * failure yields explicit issues and no normalized set.
 */
export function normalizeRelationSet(input: RelationSet, evidence: EvidenceSet): RelationSetResult {
  const validation = validateRelationSet(input.relations, evidence);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ relations: normalizeRelations(input.relations) }) };
}
