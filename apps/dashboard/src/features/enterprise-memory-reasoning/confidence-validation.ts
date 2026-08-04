/**
 * Enterprise Memory Reasoning — confidence & uncertainty validation (Phase 7).
 *
 * Validates the STRUCTURAL integrity of confidence records against the declared
 * evidence, relations, implications, contradictions, and gaps: the subject is
 * declared, the chain is non-empty and reaches an evidence root when required, every
 * reference cites a permitted and declared source, no record rests on itself, weak
 * levels state at least one uncertainty, and every uncertainty carries a non-empty
 * reason and only declared sources. This is a plain, deterministic structural check
 * — NOT confidence calculation, NOT probability, NOT scoring, NOT ranking.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { Confidence, ConfidenceSourceKind } from "@/features/enterprise-memory-reasoning/confidence-types";
import {
  confidenceRequiresEvidenceRoot,
  confidenceRequiresUncertainty,
  confidenceSubjectPermits,
} from "@/features/enterprise-memory-reasoning/confidence-rules";

export type ConfidenceValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateConfidenceSet(
  confidences: readonly Confidence[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
): ConfidenceValidation {
  const evidenceIds = new Set(evidence.items.map((item) => evidenceKey(item.reference)));
  const relationIds = new Set(relations.map((relation) => relation.relationId));
  const implicationIds = new Set(implications.map((implication) => implication.implicationId));
  const contradictionIds = new Set(contradictions.map((contradiction) => contradiction.contradictionId));
  const gapIds = new Set(gaps.map((gap) => gap.gapId));

  // Source and subject kinds address the reasoning graph directly.
  const declared: Readonly<Record<ConfidenceSourceKind, ReadonlySet<string>>> = {
    evidence: evidenceIds,
    relation: relationIds,
    implication: implicationIds,
    contradiction: contradictionIds,
    gap: gapIds,
  };

  const issues: string[] = [];
  for (const confidence of confidences) {
    const { subject, chain, level, uncertainties } = confidence;

    if (!declared[subject.subjectKind].has(subject.subjectId)) {
      issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} names an undeclared subject`);
    }
    if (chain.references.length === 0) {
      issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} has an empty chain`);
    }

    let hasEvidenceRoot = false;
    for (const reference of chain.references) {
      if (reference.sourceKind === "evidence") hasEvidenceRoot = true;

      if (!confidenceSubjectPermits(subject.subjectKind, reference.sourceKind)) {
        issues.push(
          `confidence for ${subject.subjectKind} ${subject.subjectId} cites a forbidden source kind "${reference.sourceKind}"`,
        );
      }
      if (!declared[reference.sourceKind].has(reference.referenceId)) {
        issues.push(
          `confidence for ${subject.subjectKind} ${subject.subjectId} cites undeclared ${reference.sourceKind} ${reference.referenceId}`,
        );
      }
      if (reference.sourceKind === subject.subjectKind && reference.referenceId === subject.subjectId) {
        issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} rests on itself`);
      }
    }

    if (confidenceRequiresEvidenceRoot(subject.subjectKind) && !hasEvidenceRoot) {
      issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} never reaches an evidence root`);
    }
    if (confidenceRequiresUncertainty(level) && uncertainties.length === 0) {
      issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} is "${level}" but states no uncertainty`);
    }

    for (const uncertainty of uncertainties) {
      if (uncertainty.reason.statement.length === 0) {
        issues.push(`confidence for ${subject.subjectKind} ${subject.subjectId} has an uncertainty with an empty reason`);
      }
      for (const source of uncertainty.sources) {
        if (!declared[source.sourceKind].has(source.sourceId)) {
          issues.push(
            `confidence for ${subject.subjectKind} ${subject.subjectId} has an uncertainty citing undeclared ${source.sourceKind} ${source.sourceId}`,
          );
        }
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
