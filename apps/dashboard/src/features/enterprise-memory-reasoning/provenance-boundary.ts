/**
 * Enterprise Memory Reasoning — provenance boundary (Phase 5).
 *
 * The boundary through which provenance records enter and leave the provenance
 * foundation. It validates a proposed set against declared evidence, relations,
 * implications, contradictions, and gaps, then normalizes it into a canonical,
 * immutable form. It performs NO provenance generation and traces NO chains of its
 * own — it only accepts, checks, and canonicalizes the records it is given.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { Provenance } from "@/features/enterprise-memory-reasoning/provenance-types";
import { normalizeProvenances } from "@/features/enterprise-memory-reasoning/provenance-normalization";
import { validateProvenanceSet } from "@/features/enterprise-memory-reasoning/provenance-validation";

/** A proposed set of provenance records entering the boundary. */
export interface ProvenanceSet {
  readonly provenances: readonly Provenance[];
}

/** A validated, normalized, immutable set of provenance records leaving the boundary. */
export interface NormalizedProvenanceSet {
  readonly provenances: readonly Provenance[];
}

/** The result of preparing a provenance set: normalized, or an explicit failure. */
export type ProvenanceSetResult =
  | { readonly ok: true; readonly value: NormalizedProvenanceSet }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then normalizes a provenance set against the declared evidence,
 * relations, implications, contradictions, and gaps. Pure and deterministic: the
 * same input always produces the same result. A validation failure yields explicit
 * issues and no normalized set.
 */
export function normalizeProvenanceSet(
  input: ProvenanceSet,
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
): ProvenanceSetResult {
  const validation = validateProvenanceSet(
    input.provenances,
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  );
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: Object.freeze({ provenances: normalizeProvenances(input.provenances) }) };
}
