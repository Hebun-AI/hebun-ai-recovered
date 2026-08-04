/**
 * Enterprise Memory Reasoning — gap normalization (Phase 4).
 *
 * Deterministically normalizes gaps into a canonical form:
 *   - the facts the gap relates to are de-duplicated and ordered,
 *   - the cited relation, implication, and contradiction dependencies are
 *     de-duplicated and ordered,
 *   - duplicate gaps (same type, statement, span, and dependencies) collapse to one,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — no detection, no inference, no reasoning
 * execution, and never any invention of the missing information. Keys use JSON
 * encoding so they are unambiguous and text-safe.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type {
  ClassifiedGap,
  GapDependencies,
} from "@/features/enterprise-memory-reasoning/gap-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and orders a set of evidence references by canonical key. */
function normalizeRelatedTo(relatedTo: readonly EvidenceReference[]): readonly EvidenceReference[] {
  const byKey = new Map<string, EvidenceReference>();
  for (const reference of relatedTo) {
    const key = evidenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const reference = byKey.get(key);
    if (reference === undefined) throw new Error("normalizeRelatedTo: missing reference");
    return reference;
  });
}

/** De-duplicates and orders a list of dependency ids. */
function normalizeIds(ids: readonly string[]): readonly string[] {
  return [...new Set(ids)].sort(compareStrings);
}

/** Returns the dependencies with their id lists normalized. */
function normalizeDependencies(dependencies: GapDependencies): GapDependencies {
  return {
    relations: normalizeIds(dependencies.relations),
    implications: normalizeIds(dependencies.implications),
    contradictions: normalizeIds(dependencies.contradictions),
  };
}

/** Returns the gap with its span and dependencies normalized. */
export function normalizeGap(classified: ClassifiedGap): ClassifiedGap {
  return {
    type: classified.type,
    gap: {
      ...classified.gap,
      relatedTo: normalizeRelatedTo(classified.gap.relatedTo),
    },
    dependencies: normalizeDependencies(classified.dependencies),
  };
}

/** A canonical key for a classified gap. Order-independent within the span. */
export function canonicalGapKey(classified: ClassifiedGap): string {
  const normalized = normalizeGap(classified);
  return JSON.stringify([
    normalized.type,
    normalized.gap.statement,
    normalized.gap.relatedTo.map(evidenceKey),
    [...normalized.dependencies.relations],
    [...normalized.dependencies.implications],
    [...normalized.dependencies.contradictions],
  ]);
}

/**
 * Normalizes a set of classified gaps: canonical span and dependency order,
 * duplicates removed by canonical key, emitted in ascending key order.
 */
export function normalizeGaps(gaps: readonly ClassifiedGap[]): readonly ClassifiedGap[] {
  const byKey = new Map<string, ClassifiedGap>();
  for (const classified of gaps) {
    const normalized = normalizeGap(classified);
    const key = canonicalGapKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const classified = byKey.get(key);
      if (classified === undefined) throw new Error("normalizeGaps: missing gap");
      return classified;
    }),
  );
}
