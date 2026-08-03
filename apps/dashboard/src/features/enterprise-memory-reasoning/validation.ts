/**
 * Enterprise Memory Reasoning — structural validation.
 *
 * Validates the STRUCTURAL integrity of a reasoning understanding: that every
 * piece of evidence a relation, implication, contradiction, or gap refers to is
 * actually declared in the understanding's evidence set. This is a plain,
 * deterministic referential check — NOT reasoning, NOT inference, NOT a decision.
 * It never evaluates truth, only whether references are internally consistent.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningUnderstanding } from "@/features/enterprise-memory-reasoning/understanding";

export type ReasoningValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

function evidenceKey(reference: EvidenceReference): string {
  return `${reference.namespace} ${reference.memoryId} ${reference.version}`;
}

/** Structurally validates that every referenced evidence is declared. */
export function validateUnderstanding(understanding: ReasoningUnderstanding): ReasoningValidation {
  const declared = new Set<string>();
  for (const item of understanding.evidence.items) declared.add(evidenceKey(item.reference));

  const issues: string[] = [];
  const requireDeclared = (reference: EvidenceReference, context: string): void => {
    if (!declared.has(evidenceKey(reference))) {
      issues.push(`${context} references undeclared evidence ${evidenceKey(reference)}`);
    }
  };

  for (const relation of understanding.relations) {
    requireDeclared(relation.from, `relation ${relation.relationId}`);
    requireDeclared(relation.to, `relation ${relation.relationId}`);
  }
  for (const implication of understanding.implications) {
    for (const reference of implication.basis) requireDeclared(reference, `implication ${implication.implicationId}`);
  }
  for (const contradiction of understanding.contradictions) {
    for (const reference of contradiction.between) requireDeclared(reference, `contradiction ${contradiction.contradictionId}`);
  }
  for (const gap of understanding.gaps) {
    for (const reference of gap.relatedTo) requireDeclared(reference, `gap ${gap.gapId}`);
  }
  if (understanding.confidence.rationale.length === 0) {
    issues.push("confidence rationale must not be empty");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
