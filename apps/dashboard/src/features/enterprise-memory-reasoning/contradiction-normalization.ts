/**
 * Enterprise Memory Reasoning — contradiction normalization (Phase 4).
 *
 * Deterministically normalizes contradictions into a canonical form:
 *   - the evidence the contradiction stands between is de-duplicated and ordered,
 *   - the cited relation and implication dependencies are de-duplicated and ordered,
 *   - duplicate contradictions (same type, statement, span, and dependencies)
 *     collapse to one,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — no detection, no inference, no reasoning
 * execution. Keys use JSON encoding so they are unambiguous and text-safe.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type {
  ClassifiedContradiction,
  ContradictionDependencies,
} from "@/features/enterprise-memory-reasoning/contradiction-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and orders a set of evidence references by canonical key. */
function normalizeBetween(between: readonly EvidenceReference[]): readonly EvidenceReference[] {
  const byKey = new Map<string, EvidenceReference>();
  for (const reference of between) {
    const key = evidenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const reference = byKey.get(key);
    if (reference === undefined) throw new Error("normalizeBetween: missing reference");
    return reference;
  });
}

/** De-duplicates and orders a list of dependency ids. */
function normalizeIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)].sort(compareStrings);
}

/** Returns the dependencies with their relation and implication ids normalized. */
function normalizeDependencies(dependencies: ContradictionDependencies): ContradictionDependencies {
  return {
    relations: normalizeIds(dependencies.relations),
    implications: normalizeIds(dependencies.implications),
  };
}

/** Returns the contradiction with its span and dependencies normalized. */
export function normalizeContradiction(classified: ClassifiedContradiction): ClassifiedContradiction {
  return {
    type: classified.type,
    contradiction: {
      ...classified.contradiction,
      between: normalizeBetween(classified.contradiction.between),
    },
    dependencies: normalizeDependencies(classified.dependencies),
  };
}

/** A canonical key for a classified contradiction. Order-independent within the span. */
export function canonicalContradictionKey(classified: ClassifiedContradiction): string {
  const normalized = normalizeContradiction(classified);
  return JSON.stringify([
    normalized.type,
    normalized.contradiction.statement,
    normalized.contradiction.between.map(evidenceKey),
    [...normalized.dependencies.relations],
    [...normalized.dependencies.implications],
  ]);
}

/**
 * Normalizes a set of classified contradictions: canonical span and dependency
 * order, duplicates removed by canonical key, emitted in ascending key order.
 */
export function normalizeContradictions(
  contradictions: readonly ClassifiedContradiction[],
): readonly ClassifiedContradiction[] {
  const byKey = new Map<string, ClassifiedContradiction>();
  for (const classified of contradictions) {
    const normalized = normalizeContradiction(classified);
    const key = canonicalContradictionKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const classified = byKey.get(key);
      if (classified === undefined) throw new Error("normalizeContradictions: missing contradiction");
      return classified;
    }),
  );
}
