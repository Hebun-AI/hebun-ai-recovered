/**
 * Enterprise Memory Reasoning — confidence & uncertainty normalization (Phase 7).
 *
 * Deterministically normalizes a confidence assessment into a canonical form:
 *   - chain references are de-duplicated and put in a fixed total order,
 *   - factors, assumptions, and limitations are de-duplicated and totally ordered,
 *   - uncertainties (and each uncertainty's sources) are de-duplicated and totally
 *     ordered by canonical key,
 *   - duplicate confidence records (same subject and same canonical body) collapse,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — NO confidence calculation, NO scoring, NO ranking
 * of conclusions. Keys use JSON encoding so they are unambiguous, text-safe, UTF-8
 * stable, and NUL-safe. The declared level is carried through untouched.
 */

import type {
  Confidence,
  ConfidenceAssumption,
  ConfidenceChain,
  ConfidenceFactorKind,
  ConfidenceLimitation,
  ConfidenceReference,
  Uncertainty,
  UncertaintySource,
} from "@/features/enterprise-memory-reasoning/confidence-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a list of items by a canonical key. */
function canonicalize<T>(items: readonly T[], keyOf: (item: T) => string): readonly T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const item = byKey.get(key);
    if (item === undefined) throw new Error("canonicalize: missing item");
    return item;
  });
}

/** An unambiguous, text-safe key for one confidence reference. */
export function confidenceReferenceKey(reference: ConfidenceReference): string {
  return JSON.stringify([reference.sourceKind, reference.referenceId]);
}

/** An unambiguous, text-safe key for one uncertainty source. */
export function uncertaintySourceKey(source: UncertaintySource): string {
  return JSON.stringify([source.sourceKind, source.sourceId]);
}

/** A canonical key for one uncertainty: its category, reason, and ordered sources. */
export function uncertaintyKey(uncertainty: Uncertainty): string {
  const sources = canonicalize(uncertainty.sources, uncertaintySourceKey).map(uncertaintySourceKey);
  return JSON.stringify([uncertainty.category, uncertainty.reason.statement, sources]);
}

/** De-duplicates and totally orders a chain's references by canonical key. */
export function normalizeChain(chain: ConfidenceChain): ConfidenceChain {
  return { references: canonicalize(chain.references, confidenceReferenceKey) };
}

/** De-duplicates and totally orders a factor list. */
export function normalizeFactors(factors: readonly ConfidenceFactorKind[]): readonly ConfidenceFactorKind[] {
  return canonicalize(factors, (factor) => factor);
}

/** De-duplicates and totally orders an assumption list by statement. */
export function normalizeAssumptions(assumptions: readonly ConfidenceAssumption[]): readonly ConfidenceAssumption[] {
  return canonicalize(assumptions, (assumption) => JSON.stringify(assumption.statement));
}

/** De-duplicates and totally orders a limitation list by statement. */
export function normalizeLimitations(limitations: readonly ConfidenceLimitation[]): readonly ConfidenceLimitation[] {
  return canonicalize(limitations, (limitation) => JSON.stringify(limitation.statement));
}

/** De-duplicates and totally orders an uncertainty (and its sources) list. */
export function normalizeUncertainties(uncertainties: readonly Uncertainty[]): readonly Uncertainty[] {
  const normalized = uncertainties.map((uncertainty) => ({
    category: uncertainty.category,
    reason: uncertainty.reason,
    sources: canonicalize(uncertainty.sources, uncertaintySourceKey),
  }));
  return canonicalize(normalized, uncertaintyKey);
}

/** Returns the confidence with chain, factors, assumptions, limitations, and uncertainties canonicalized. */
export function normalizeConfidence(confidence: Confidence): Confidence {
  return {
    subject: confidence.subject,
    level: confidence.level,
    chain: normalizeChain(confidence.chain),
    factors: normalizeFactors(confidence.factors),
    assumptions: normalizeAssumptions(confidence.assumptions),
    limitations: normalizeLimitations(confidence.limitations),
    uncertainties: normalizeUncertainties(confidence.uncertainties),
  };
}

/** A canonical key for a confidence record. Order-independent within each set. */
export function canonicalConfidenceKey(confidence: Confidence): string {
  const normalized = normalizeConfidence(confidence);
  return JSON.stringify([
    normalized.subject.subjectKind,
    normalized.subject.subjectId,
    normalized.level,
    normalized.chain.references.map(confidenceReferenceKey),
    normalized.factors,
    normalized.assumptions.map((assumption) => assumption.statement),
    normalized.limitations.map((limitation) => limitation.statement),
    normalized.uncertainties.map(uncertaintyKey),
  ]);
}

/**
 * Normalizes a set of confidence records: canonical bodies, duplicates removed by
 * canonical key, emitted in ascending key order. Deterministic and frozen.
 */
export function normalizeConfidences(confidences: readonly Confidence[]): readonly Confidence[] {
  const byKey = new Map<string, Confidence>();
  for (const confidence of confidences) {
    const normalized = normalizeConfidence(confidence);
    const key = canonicalConfidenceKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const confidence = byKey.get(key);
      if (confidence === undefined) throw new Error("normalizeConfidences: missing confidence");
      return confidence;
    }),
  );
}
