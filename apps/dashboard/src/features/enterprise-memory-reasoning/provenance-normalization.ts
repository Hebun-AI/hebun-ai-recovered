/**
 * Enterprise Memory Reasoning — provenance normalization (Phase 5).
 *
 * Deterministically normalizes provenance into a canonical form:
 *   - a chain's references are de-duplicated and put in a fixed total order,
 *   - duplicate provenance records (same artifact and same chain) collapse to one,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — no provenance generation, no inference. Keys use
 * JSON encoding so they are unambiguous, text-safe, and NUL-safe.
 */

import type {
  Provenance,
  ProvenanceChain,
  ProvenanceReference,
} from "@/features/enterprise-memory-reasoning/provenance-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** An unambiguous, text-safe key for one provenance reference. */
export function provenanceReferenceKey(reference: ProvenanceReference): string {
  return JSON.stringify([reference.sourceKind, reference.sourceId]);
}

/** De-duplicates and totally orders a chain's references by canonical key. */
export function normalizeChain(chain: ProvenanceChain): ProvenanceChain {
  const byKey = new Map<string, ProvenanceReference>();
  for (const reference of chain.references) {
    const key = provenanceReferenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  const references = [...byKey.keys()].sort(compareStrings).map((key) => {
    const reference = byKey.get(key);
    if (reference === undefined) throw new Error("normalizeChain: missing reference");
    return reference;
  });
  return { references };
}

/** Returns the provenance with its chain normalized. */
export function normalizeProvenance(provenance: Provenance): Provenance {
  return {
    artifactKind: provenance.artifactKind,
    artifactId: provenance.artifactId,
    chain: normalizeChain(provenance.chain),
  };
}

/** A canonical key for a provenance record. Order-independent within the chain. */
export function canonicalProvenanceKey(provenance: Provenance): string {
  const normalized = normalizeProvenance(provenance);
  return JSON.stringify([
    normalized.artifactKind,
    normalized.artifactId,
    normalized.chain.references.map(provenanceReferenceKey),
  ]);
}

/**
 * Normalizes a set of provenance records: canonical chain order, duplicates removed
 * by canonical key, emitted in ascending key order. Deterministic and frozen.
 */
export function normalizeProvenances(provenances: readonly Provenance[]): readonly Provenance[] {
  const byKey = new Map<string, Provenance>();
  for (const provenance of provenances) {
    const normalized = normalizeProvenance(provenance);
    const key = canonicalProvenanceKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const provenance = byKey.get(key);
      if (provenance === undefined) throw new Error("normalizeProvenances: missing provenance");
      return provenance;
    }),
  );
}
