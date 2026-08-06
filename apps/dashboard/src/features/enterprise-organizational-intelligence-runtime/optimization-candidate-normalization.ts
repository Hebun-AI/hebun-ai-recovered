/**
 * Enterprise Organizational Intelligence Runtime — optimization candidate normalization (Phase 4).
 *
 * Deterministically canonicalizes an Optimization Candidate set:
 *   - each candidate's learning references and evidence references are de-duplicated and
 *     totally ordered,
 *   - candidates are de-duplicated by identity and ordered by canonical identity,
 *   - provenance, explainability, confidence, and uncertainty are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole set is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO decision, NO
 * prioritization, NO mutation of any preserved value. Ordering and de-duplication happen
 * by canonical key only. Keys use JSON encoding so they are unambiguous, text-safe,
 * UTF-8 stable, and NUL-safe.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalOptimizationCandidateSet,
  OptimizationCandidate,
  OptimizationCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of references. */
export function normalizeReferenceIds(refs: readonly RuntimeId[]): readonly RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** An unambiguous, text-safe key for one optimization candidate. */
export function optimizationCandidateKey(candidate: OptimizationCandidate): string {
  return JSON.stringify([
    candidate.candidateId,
    candidate.candidateKind,
    candidate.statement,
    normalizeReferenceIds(candidate.learningRefs),
    normalizeReferenceIds(candidate.evidenceRefs),
    candidate.provenance.version,
    candidate.provenance.lifecycle,
    candidate.confidence.level,
    candidate.supersedes,
  ]);
}

/**
 * Canonicalizes a candidate: its learning and evidence references de-duplicated and
 * ordered, every other field — statement, provenance, explainability, confidence,
 * supersession — carried UNCHANGED. Frozen.
 */
export function normalizeOptimizationCandidate(candidate: OptimizationCandidate): OptimizationCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    candidateKind: candidate.candidateKind,
    statement: candidate.statement,
    learningRefs: normalizeReferenceIds(candidate.learningRefs),
    evidenceRefs: normalizeReferenceIds(candidate.evidenceRefs),
    provenance: candidate.provenance,
    explainability: candidate.explainability,
    confidence: candidate.confidence,
    supersedes: candidate.supersedes,
  });
}

/**
 * De-duplicates candidates by identity (first occurrence wins) and orders them by
 * canonical identity. Each candidate is canonicalized. Deterministic.
 */
export function normalizeOptimizationCandidates(
  candidates: readonly OptimizationCandidate[],
): readonly OptimizationCandidate[] {
  const byId = new Map<RuntimeId, OptimizationCandidate>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.candidateId)) byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId))
    .map(normalizeOptimizationCandidate);
}

/** A canonical key for a set: its request identity and ordered candidate keys. */
export function canonicalOptimizationCandidateSetKey(set: CanonicalOptimizationCandidateSet): string {
  return JSON.stringify([
    set.requestId,
    set.approval.state,
    set.candidates.map(optimizationCandidateKey),
  ]);
}

/**
 * Canonicalizes an Optimization Candidate set into an immutable, frozen form.
 * Deterministic: the same input always produces the same canonical set. Candidates are
 * canonicalized and ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeOptimizationCandidateSet(
  set: OptimizationCandidateSet,
): CanonicalOptimizationCandidateSet {
  return Object.freeze({
    requestId: set.requestId,
    candidates: Object.freeze(normalizeOptimizationCandidates(set.candidates)),
    approval: set.approval,
  });
}
