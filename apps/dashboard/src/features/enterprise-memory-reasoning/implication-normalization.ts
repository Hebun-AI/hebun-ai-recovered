/**
 * Enterprise Memory Reasoning — implication normalization (Phase 3).
 *
 * Deterministically normalizes implications into a canonical form:
 *   - the evidence basis is de-duplicated and ordered,
 *   - the cited relation dependencies are de-duplicated and ordered,
 *   - duplicate implications (same type, statement, basis, and dependencies)
 *     collapse to one,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — no inference, no derivation, no reasoning
 * execution. Keys use JSON encoding so they are unambiguous and text-safe.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { ClassifiedImplication } from "@/features/enterprise-memory-reasoning/implication-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and orders a set of evidence references by canonical key. */
function normalizeBasis(basis: readonly EvidenceReference[]): readonly EvidenceReference[] {
  const byKey = new Map<string, EvidenceReference>();
  for (const reference of basis) {
    const key = evidenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const reference = byKey.get(key);
    if (reference === undefined) throw new Error("normalizeBasis: missing reference");
    return reference;
  });
}

/** De-duplicates and orders relation dependency ids. */
function normalizeDependencies(dependencies: readonly string[]): readonly string[] {
  return [...new Set(dependencies)].sort(compareStrings);
}

/** Returns the implication with its basis and dependencies normalized. */
export function normalizeImplication(classified: ClassifiedImplication): ClassifiedImplication {
  return {
    type: classified.type,
    implication: {
      ...classified.implication,
      basis: normalizeBasis(classified.implication.basis),
      derivedFrom: normalizeDependencies(classified.implication.derivedFrom),
    },
  };
}

/** A canonical key for a classified implication. Order-independent within basis. */
export function canonicalImplicationKey(classified: ClassifiedImplication): string {
  const normalized = normalizeImplication(classified);
  return JSON.stringify([
    normalized.type,
    normalized.implication.statement,
    normalized.implication.basis.map(evidenceKey),
    [...normalized.implication.derivedFrom],
  ]);
}

/**
 * Normalizes a set of classified implications: canonical basis and dependency
 * order, duplicates removed by canonical key, emitted in ascending key order.
 */
export function normalizeImplications(
  implications: readonly ClassifiedImplication[],
): readonly ClassifiedImplication[] {
  const byKey = new Map<string, ClassifiedImplication>();
  for (const classified of implications) {
    const normalized = normalizeImplication(classified);
    const key = canonicalImplicationKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const classified = byKey.get(key);
      if (classified === undefined) throw new Error("normalizeImplications: missing implication");
      return classified;
    }),
  );
}
