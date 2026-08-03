/**
 * Enterprise Memory Reasoning — implication validation (Phase 3).
 *
 * Validates the STRUCTURAL integrity of classified implications against declared
 * evidence and declared relations: a non-empty statement, a basis meeting the
 * type's minimum, every basis reference declared, the required relation present
 * when the type demands it, and every cited dependency existing. This is a plain,
 * deterministic structural check — NOT inference, NOT derivation, NOT reasoning.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { ClassifiedImplication } from "@/features/enterprise-memory-reasoning/implication-types";
import {
  implicationMinimumBasis,
  implicationRequiresRelation,
} from "@/features/enterprise-memory-reasoning/implication-rules";

export type ImplicationValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

export function validateImplicationSet(
  implications: readonly ClassifiedImplication[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
): ImplicationValidation {
  const declaredEvidence = new Set<string>();
  for (const item of evidence.items) declaredEvidence.add(evidenceKey(item.reference));
  const declaredRelations = new Set<string>();
  for (const relation of relations) declaredRelations.add(relation.relationId);

  const issues: string[] = [];
  for (const classified of implications) {
    const { type, implication } = classified;
    const id = implication.implicationId;

    if (implication.statement.length === 0) {
      issues.push(`implication ${id} has an empty statement`);
    }
    if (implication.basis.length < implicationMinimumBasis(type)) {
      issues.push(`implication ${id} basis is below the minimum for type "${type}"`);
    }
    for (const reference of implication.basis) {
      if (!declaredEvidence.has(evidenceKey(reference))) {
        issues.push(`implication ${id} references undeclared evidence ${evidenceKey(reference)}`);
      }
    }
    if (implicationRequiresRelation(type) && implication.derivedFrom.length === 0) {
      issues.push(`implication ${id} of type "${type}" must derive from at least one relation`);
    }
    for (const relationId of implication.derivedFrom) {
      if (!declaredRelations.has(relationId)) {
        issues.push(`implication ${id} cites undeclared relation ${relationId}`);
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
