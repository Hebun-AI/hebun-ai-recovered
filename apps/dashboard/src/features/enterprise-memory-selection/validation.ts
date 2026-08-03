/**
 * Enterprise Memory Selection — policy validation.
 *
 * Rejects malformed or contradictory selection policies before any selection
 * runs. Deterministic and total: the same policy always yields the same verdict.
 */

import type { SelectionPolicy } from "@/features/enterprise-memory-selection/contracts";

export type PolicyValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

export function validateSelectionPolicy(policy: SelectionPolicy): PolicyValidation {
  const issues: string[] = [];

  if (policy.limit !== undefined && (policy.limit < 0 || !Number.isInteger(policy.limit))) {
    issues.push("limit must be a non-negative integer");
  }
  if (policy.requireCurrent === true && policy.lifecycleState === "archived") {
    issues.push("requireCurrent conflicts with lifecycleState 'archived' (archived records are never current)");
  }
  if (policy.prioritize !== undefined) {
    if (policy.prioritize.includes("newest-stored-first") && policy.prioritize.includes("oldest-stored-first")) {
      issues.push("prioritize cannot include both newest-stored-first and oldest-stored-first");
    }
    if (policy.prioritize.includes("version-desc") && policy.prioritize.includes("version-asc")) {
      issues.push("prioritize cannot include both version-desc and version-asc");
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
