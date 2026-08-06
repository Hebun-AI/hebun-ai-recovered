/**
 * Enterprise Organizational Intelligence Runtime — learning candidate normalization (Phase 3).
 *
 * Deterministically canonicalizes a Learning Candidate set:
 *   - each candidate's evidence references are de-duplicated and totally ordered,
 *   - candidates are de-duplicated by identity and ordered by canonical identity,
 *   - provenance, explainability, confidence, and uncertainty are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole set is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO knowledge admission,
 * NO fact creation, NO mutation of any preserved value. Ordering and de-duplication
 * happen by canonical key only. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalLearningCandidateSet,
  LearningCandidate,
  LearningCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of evidence references. */
export function normalizeEvidenceRefs(refs: readonly RuntimeId[]): readonly RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** An unambiguous, text-safe key for one learning candidate. */
export function learningCandidateKey(candidate: LearningCandidate): string {
  return JSON.stringify([
    candidate.candidateId,
    candidate.candidateKind,
    candidate.statement,
    normalizeEvidenceRefs(candidate.evidenceRefs),
    candidate.provenance.version,
    candidate.provenance.lifecycle,
    candidate.confidence.level,
    candidate.supersedes,
  ]);
}

/**
 * Canonicalizes a candidate: its evidence references de-duplicated and ordered, every
 * other field — statement, provenance, explainability, confidence, supersession —
 * carried UNCHANGED. Frozen.
 */
export function normalizeLearningCandidate(candidate: LearningCandidate): LearningCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    candidateKind: candidate.candidateKind,
    statement: candidate.statement,
    evidenceRefs: normalizeEvidenceRefs(candidate.evidenceRefs),
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
export function normalizeLearningCandidates(
  candidates: readonly LearningCandidate[],
): readonly LearningCandidate[] {
  const byId = new Map<RuntimeId, LearningCandidate>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.candidateId)) byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId))
    .map(normalizeLearningCandidate);
}

/** A canonical key for a set: its request identity and ordered candidate keys. */
export function canonicalLearningCandidateSetKey(set: CanonicalLearningCandidateSet): string {
  return JSON.stringify([
    set.requestId,
    set.approval.state,
    set.candidates.map(learningCandidateKey),
  ]);
}

/**
 * Canonicalizes a Learning Candidate set into an immutable, frozen form. Deterministic:
 * the same input always produces the same canonical set. Candidates are canonicalized
 * and ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeLearningCandidateSet(
  set: LearningCandidateSet,
): CanonicalLearningCandidateSet {
  return Object.freeze({
    requestId: set.requestId,
    candidates: Object.freeze(normalizeLearningCandidates(set.candidates)),
    approval: set.approval,
  });
}
