/**
 * Enterprise Memory Selection — deterministic selection engine.
 *
 * Pipeline: validate policy → filter candidates → prioritize → bound by limit →
 * explain. Pure: no randomness, no hidden state, no cache, no singleton, no
 * reflection, no global mutable state. Identical candidates and policy always
 * produce an identical, immutable bounded context.
 */

import type { PersistedMemoryRecord } from "@/features/enterprise-memory-persistence";
import type {
  SelectedMemoryContext,
  SelectionPolicy,
  SelectionReason,
  SelectionResult,
} from "@/features/enterprise-memory-selection/contracts";
import { buildSelectionPredicates, selectionMatches } from "@/features/enterprise-memory-selection/filters";
import { buildComparator } from "@/features/enterprise-memory-selection/priorities";
import { validateSelectionPolicy } from "@/features/enterprise-memory-selection/validation";

/** Builds the explainable reasons a record was included, at its bounded rank. */
function reasonsFor(record: PersistedMemoryRecord, policy: SelectionPolicy, rank: number): SelectionReason {
  const reasons: string[] = [`selected at rank ${rank}`];
  if (policy.requireCurrent === true) reasons.push("current version required and satisfied");
  if (policy.lifecycleState !== undefined) reasons.push(`lifecycle is ${record.record.lifecycle.state}`);
  if (policy.minConfidenceLevel !== undefined) {
    reasons.push(`confidence ${record.record.confidence.level} meets minimum ${policy.minConfidenceLevel}`);
  }
  if (policy.sensitivity !== undefined) reasons.push(`sensitivity is ${record.record.classification.sensitivity}`);
  if (policy.category !== undefined) reasons.push(`category is ${record.record.classification.category}`);
  if (policy.prioritize !== undefined && policy.prioritize.length > 0) {
    reasons.push(`prioritized by ${policy.prioritize.join(", ")}`);
  }
  return Object.freeze({
    memoryId: record.writeIdentity.memoryId,
    version: record.writeIdentity.version,
    reasons: Object.freeze(reasons),
  });
}

/** Selects from an already-queried candidate set. Pure and deterministic. */
export function selectFromRecords(
  candidates: readonly PersistedMemoryRecord[],
  policy: SelectionPolicy,
): SelectionResult {
  const validation = validateSelectionPolicy(policy);
  if (!validation.ok) {
    return { status: "ValidationFailure", issues: validation.issues };
  }

  const predicates = buildSelectionPredicates(policy);
  const filtered = candidates.filter((record) => selectionMatches(record, predicates));

  const prioritized = [...filtered].sort(buildComparator(policy.prioritize));
  const bounded = policy.limit === undefined ? prioritized : prioritized.slice(0, policy.limit);

  const reasons = bounded.map((record, index) => reasonsFor(record, policy, index + 1));

  const context: SelectedMemoryContext = {
    selected: Object.freeze(bounded),
    reasons: Object.freeze(reasons),
    totalConsidered: candidates.length,
    appliedPolicy: policy,
  };
  return { status: "Success", value: Object.freeze(context) };
}
