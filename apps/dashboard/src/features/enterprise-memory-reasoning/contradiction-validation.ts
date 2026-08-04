/**
 * Enterprise Memory Reasoning — contradiction validation (Phase 4).
 *
 * Validates the STRUCTURAL integrity of classified contradictions against declared
 * evidence, relations, and implications: a non-empty statement, a span meeting the
 * type's minimum, every spanned reference declared, the required relation or
 * implication present when the type demands it, and every cited dependency existing.
 * This is a plain, deterministic structural check — NOT detection, NOT inference,
 * NOT reasoning.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { ClassifiedContradiction } from "@/features/enterprise-memory-reasoning/contradiction-types";
import {
  contradictionMinimumBetween,
  contradictionRequiresImplication,
  contradictionRequiresRelation,
} from "@/features/enterprise-memory-reasoning/contradiction-rules";

export type ContradictionValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateContradictionSet(
  contradictions: readonly ClassifiedContradiction[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
): ContradictionValidation {
  const declaredEvidence = new Set<string>();
  for (const item of evidence.items) declaredEvidence.add(evidenceKey(item.reference));
  const declaredRelations = new Set<string>();
  for (const relation of relations) declaredRelations.add(relation.relationId);
  const declaredImplications = new Set<string>();
  for (const implication of implications) declaredImplications.add(implication.implicationId);

  const issues: string[] = [];
  for (const classified of contradictions) {
    const { type, contradiction, dependencies } = classified;
    const id = contradiction.contradictionId;

    if (contradiction.statement.length === 0) {
      issues.push(`contradiction ${id} has an empty statement`);
    }
    if (contradiction.between.length < contradictionMinimumBetween(type)) {
      issues.push(`contradiction ${id} span is below the minimum for type "${type}"`);
    }
    for (const reference of contradiction.between) {
      if (!declaredEvidence.has(evidenceKey(reference))) {
        issues.push(`contradiction ${id} references undeclared evidence ${evidenceKey(reference)}`);
      }
    }
    if (contradictionRequiresRelation(type) && dependencies.relations.length === 0) {
      issues.push(`contradiction ${id} of type "${type}" must cite at least one relation`);
    }
    if (contradictionRequiresImplication(type) && dependencies.implications.length === 0) {
      issues.push(`contradiction ${id} of type "${type}" must cite at least one implication`);
    }
    for (const relationId of dependencies.relations) {
      if (!declaredRelations.has(relationId)) {
        issues.push(`contradiction ${id} cites undeclared relation ${relationId}`);
      }
    }
    for (const implicationId of dependencies.implications) {
      if (!declaredImplications.has(implicationId)) {
        issues.push(`contradiction ${id} cites undeclared implication ${implicationId}`);
      }
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
