/**
 * Enterprise Memory Reasoning — explainability normalization (Phase 6).
 *
 * Deterministically normalizes explanations into a canonical form:
 *   - each step's references are de-duplicated and put in a fixed total order,
 *   - exact-duplicate steps (same statement AND same reference set) collapse to one,
 *     while step order is otherwise preserved — the legible walk is not reordered,
 *   - duplicate explanation records (same subject and same canonical walk) collapse,
 *   - the resulting set is emitted in a fixed, total order.
 *
 * This is pure canonicalization — NO explanation generation, NO reasoning. Keys use
 * JSON encoding so they are unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import type {
  Explanation,
  ExplanationChain,
  ExplanationReference,
  ExplanationStep,
} from "@/features/enterprise-memory-reasoning/explainability-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** An unambiguous, text-safe key for one explanation reference. */
export function explanationReferenceKey(reference: ExplanationReference): string {
  return JSON.stringify([reference.referenceKind, reference.referenceId]);
}

/** De-duplicates and totally orders a step's references by canonical key. */
export function normalizeStep(step: ExplanationStep): ExplanationStep {
  const byKey = new Map<string, ExplanationReference>();
  for (const reference of step.references) {
    const key = explanationReferenceKey(reference);
    if (!byKey.has(key)) byKey.set(key, reference);
  }
  const references = [...byKey.keys()].sort(compareStrings).map((key) => {
    const reference = byKey.get(key);
    if (reference === undefined) throw new Error("normalizeStep: missing reference");
    return reference;
  });
  return { statement: step.statement, references };
}

/** A canonical key for one step: its statement plus its normalized reference keys. */
export function explanationStepKey(step: ExplanationStep): string {
  const normalized = normalizeStep(step);
  return JSON.stringify([normalized.statement, normalized.references.map(explanationReferenceKey)]);
}

/**
 * Normalizes a chain: each step's references canonicalized, then exact-duplicate
 * steps removed by step key while first-occurrence order is preserved. The walk is
 * never reordered — its sequence is the legible content.
 */
export function normalizeChain(chain: ExplanationChain): ExplanationChain {
  const seen = new Set<string>();
  const steps: ExplanationStep[] = [];
  for (const step of chain.steps) {
    const normalized = normalizeStep(step);
    const key = explanationStepKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(normalized);
  }
  return { steps };
}

/** Returns the explanation with its chain normalized. */
export function normalizeExplanation(explanation: Explanation): Explanation {
  return {
    explanationKind: explanation.explanationKind,
    subject: explanation.subject,
    chain: normalizeChain(explanation.chain),
  };
}

/**
 * A canonical key for an explanation record. Step order is significant (the walk),
 * so two records differing only in step order are distinct explanations.
 */
export function canonicalExplanationKey(explanation: Explanation): string {
  const normalized = normalizeExplanation(explanation);
  return JSON.stringify([
    normalized.explanationKind,
    normalized.subject.subjectKind,
    normalized.subject.subjectId,
    normalized.chain.steps.map(explanationStepKey),
  ]);
}

/**
 * Normalizes a set of explanations: canonical chains, duplicates removed by
 * canonical key, emitted in ascending key order. Deterministic and frozen.
 */
export function normalizeExplanations(explanations: readonly Explanation[]): readonly Explanation[] {
  const byKey = new Map<string, Explanation>();
  for (const explanation of explanations) {
    const normalized = normalizeExplanation(explanation);
    const key = canonicalExplanationKey(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return Object.freeze(
    [...byKey.keys()].sort(compareStrings).map((key) => {
      const explanation = byKey.get(key);
      if (explanation === undefined) throw new Error("normalizeExplanations: missing explanation");
      return explanation;
    }),
  );
}
