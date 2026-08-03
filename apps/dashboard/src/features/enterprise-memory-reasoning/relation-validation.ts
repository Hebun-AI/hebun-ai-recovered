/**
 * Enterprise Memory Reasoning — relation validation (Phase 2).
 *
 * Validates the STRUCTURAL integrity of explicit relations against a declared
 * evidence set: no self-relation, both endpoints declared, and one-to-one
 * cardinality respected where the type requires it. This is a plain, deterministic
 * structural check — NOT inference, NOT traversal, NOT graph execution. It never
 * derives new relations and never evaluates truth.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import { isOneToOne } from "@/features/enterprise-memory-reasoning/relation-rules";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";

export type RelationValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

/** Validates one relation in isolation: endpoints declared, not a self-relation. */
function validateSingle(relation: ReasoningRelation, declared: ReadonlySet<string>, issues: string[]): void {
  const fromKey = evidenceKey(relation.from);
  const toKey = evidenceKey(relation.to);
  if (fromKey === toKey) {
    issues.push(`relation ${relation.relationId} is a self-relation`);
  }
  if (!declared.has(fromKey)) issues.push(`relation ${relation.relationId} references undeclared evidence ${fromKey}`);
  if (!declared.has(toKey)) issues.push(`relation ${relation.relationId} references undeclared evidence ${toKey}`);
}

/** Validates a full relation set against the declared evidence and cardinality. */
export function validateRelationSet(
  relations: readonly ReasoningRelation[],
  evidence: EvidenceSet,
): RelationValidation {
  const declared = new Set<string>();
  for (const item of evidence.items) declared.add(evidenceKey(item.reference));

  const issues: string[] = [];
  for (const relation of relations) validateSingle(relation, declared, issues);

  // One-to-one cardinality: no endpoint may participate twice on the same side.
  const usedFrom = new Map<string, string>();
  const usedTo = new Map<string, string>();
  for (const relation of relations) {
    if (!isOneToOne(relation.type)) continue;
    const fromKey = `${relation.type} ${evidenceKey(relation.from)}`;
    const toKey = `${relation.type} ${evidenceKey(relation.to)}`;
    if (usedFrom.has(fromKey)) issues.push(`relation ${relation.relationId} violates one-to-one cardinality on its source`);
    if (usedTo.has(toKey)) issues.push(`relation ${relation.relationId} violates one-to-one cardinality on its target`);
    usedFrom.set(fromKey, relation.relationId);
    usedTo.set(toKey, relation.relationId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
