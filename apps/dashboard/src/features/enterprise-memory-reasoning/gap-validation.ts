/**
 * Enterprise Memory Reasoning — gap validation (Phase 4).
 *
 * Validates the STRUCTURAL integrity of classified gaps against declared evidence,
 * relations, implications, and contradictions: a non-empty statement, a span
 * meeting the type's minimum, every related reference declared, a reference present
 * when the type demands it, and every cited dependency existing. This is a plain,
 * deterministic structural check — NOT detection, NOT inference, NOT reasoning, and
 * it never fills or invents the missing piece.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { ClassifiedGap } from "@/features/enterprise-memory-reasoning/gap-types";
import { gapMinimumRelated, gapRequiresReference } from "@/features/enterprise-memory-reasoning/gap-rules";

export type GapValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

export function validateGapSet(
  gaps: readonly ClassifiedGap[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
): GapValidation {
  const declaredEvidence = new Set<string>();
  for (const item of evidence.items) declaredEvidence.add(evidenceKey(item.reference));
  const declaredRelations = new Set<string>();
  for (const relation of relations) declaredRelations.add(relation.relationId);
  const declaredImplications = new Set<string>();
  for (const implication of implications) declaredImplications.add(implication.implicationId);
  const declaredContradictions = new Set<string>();
  for (const contradiction of contradictions) declaredContradictions.add(contradiction.contradictionId);

  const issues: string[] = [];
  for (const classified of gaps) {
    const { type, gap, dependencies } = classified;
    const id = gap.gapId;

    if (gap.statement.length === 0) {
      issues.push(`gap ${id} has an empty statement`);
    }
    if (gap.relatedTo.length < gapMinimumRelated(type)) {
      issues.push(`gap ${id} span is below the minimum for type "${type}"`);
    }
    if (gapRequiresReference(type) && gap.relatedTo.length === 0) {
      issues.push(`gap ${id} of type "${type}" must relate to at least one fact`);
    }
    for (const reference of gap.relatedTo) {
      if (!declaredEvidence.has(evidenceKey(reference))) {
        issues.push(`gap ${id} references undeclared evidence ${evidenceKey(reference)}`);
      }
    }
    for (const relationId of dependencies.relations) {
      if (!declaredRelations.has(relationId)) {
        issues.push(`gap ${id} cites undeclared relation ${relationId}`);
      }
    }
    for (const implicationId of dependencies.implications) {
      if (!declaredImplications.has(implicationId)) {
        issues.push(`gap ${id} cites undeclared implication ${implicationId}`);
      }
    }
    for (const contradictionId of dependencies.contradictions) {
      if (!declaredContradictions.has(contradictionId)) {
        issues.push(`gap ${id} cites undeclared contradiction ${contradictionId}`);
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
