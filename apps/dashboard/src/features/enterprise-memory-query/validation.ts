/**
 * Enterprise Memory Query — query validation.
 *
 * Rejects contradictory or malformed queries explicitly before any execution.
 * Validation is deterministic and total: the same query always yields the same
 * verdict. It never repairs a query — it accepts or reports issues.
 */

import type { MemoryQuery } from "@/features/enterprise-memory-query/contracts";

export type QueryValidation = { readonly ok: true } | { readonly ok: false; readonly issues: readonly string[] };

export function validateQuery(query: MemoryQuery): QueryValidation {
  const issues: string[] = [];

  if (query.namespace.length === 0) {
    issues.push("namespace is required");
  }
  if (query.currentOnly === true && query.historical === true) {
    issues.push("currentOnly and historical are mutually exclusive");
  }
  if (query.approvedOnly === true && query.archivedOnly === true) {
    issues.push("approvedOnly and archivedOnly are mutually exclusive");
  }
  if (query.approvedOnly === true && query.lifecycleState === "archived") {
    issues.push("approvedOnly conflicts with lifecycleState 'archived'");
  }
  if (query.archivedOnly === true && query.lifecycleState === "approved") {
    issues.push("archivedOnly conflicts with lifecycleState 'approved'");
  }
  if (query.version !== undefined && query.version < 1) {
    issues.push("version must be a positive integer");
  }
  if (query.createdAfter !== undefined && query.createdBefore !== undefined && query.createdAfter > query.createdBefore) {
    issues.push("createdAfter must not be later than createdBefore");
  }
  if (query.storedAfter !== undefined && query.storedBefore !== undefined && query.storedAfter > query.storedBefore) {
    issues.push("storedAfter must not be later than storedBefore");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
