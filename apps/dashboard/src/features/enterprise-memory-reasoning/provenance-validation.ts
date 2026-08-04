/**
 * Enterprise Memory Reasoning — provenance validation (Phase 5).
 *
 * Validates the STRUCTURAL integrity of provenance records against declared
 * evidence, relations, implications, contradictions, and gaps: the artifact itself
 * is declared, the chain is non-empty, every reference cites a permitted source
 * kind, every reference is declared, no record cites itself, and the chain reaches
 * an evidence root when required. This is a plain, deterministic structural check —
 * NOT provenance generation, NOT inference, NOT reasoning.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { Provenance, ProvenanceSourceKind } from "@/features/enterprise-memory-reasoning/provenance-types";
import {
  provenanceArtifactPermits,
  provenanceRequiresEvidenceRoot,
} from "@/features/enterprise-memory-reasoning/provenance-rules";

export type ProvenanceValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateProvenanceSet(
  provenances: readonly Provenance[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
): ProvenanceValidation {
  const declared: Readonly<Record<ProvenanceSourceKind, ReadonlySet<string>>> = {
    evidence: new Set(evidence.items.map((item) => evidenceKey(item.reference))),
    relation: new Set(relations.map((relation) => relation.relationId)),
    implication: new Set(implications.map((implication) => implication.implicationId)),
    contradiction: new Set(contradictions.map((contradiction) => contradiction.contradictionId)),
    gap: new Set(gaps.map((gap) => gap.gapId)),
  };

  const issues: string[] = [];
  for (const provenance of provenances) {
    const { artifactKind, artifactId, chain } = provenance;

    if (!declared[artifactKind].has(artifactId)) {
      issues.push(`provenance for ${artifactKind} ${artifactId} names an undeclared artifact`);
    }
    if (chain.references.length === 0) {
      issues.push(`provenance for ${artifactKind} ${artifactId} has an empty chain`);
    }

    let hasEvidenceRoot = false;
    for (const reference of chain.references) {
      if (reference.sourceKind === "evidence") hasEvidenceRoot = true;

      if (!provenanceArtifactPermits(artifactKind, reference.sourceKind)) {
        issues.push(
          `provenance for ${artifactKind} ${artifactId} cites a forbidden source kind "${reference.sourceKind}"`,
        );
      }
      if (!declared[reference.sourceKind].has(reference.sourceId)) {
        issues.push(
          `provenance for ${artifactKind} ${artifactId} cites undeclared ${reference.sourceKind} ${reference.sourceId}`,
        );
      }
      if (reference.sourceKind === artifactKind && reference.sourceId === artifactId) {
        issues.push(`provenance for ${artifactKind} ${artifactId} cites itself`);
      }
    }

    if (provenanceRequiresEvidenceRoot(artifactKind) && !hasEvidenceRoot) {
      issues.push(`provenance for ${artifactKind} ${artifactId} never reaches an evidence root`);
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
