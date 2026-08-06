/**
 * Enterprise Organizational Intelligence Runtime — awareness candidate normalization (Phase 5).
 *
 * Deterministically canonicalizes an Awareness Candidate set:
 *   - each candidate's learning references, optimization references, and evidence
 *     references are de-duplicated and totally ordered,
 *   - candidates are de-duplicated by identity and ordered by canonical identity,
 *   - provenance, explainability, confidence, and uncertainty are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole set is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO assessment, NO scoring,
 * NO prioritization, NO mutation of any preserved value. Ordering and de-duplication
 * happen by canonical key only. Keys use JSON encoding so they are unambiguous, text-safe,
 * UTF-8 stable, and NUL-safe.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  AwarenessCandidate,
  AwarenessCandidateSet,
  CanonicalAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";

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

/** An unambiguous, text-safe key for one awareness candidate. */
export function awarenessCandidateKey(candidate: AwarenessCandidate): string {
  return JSON.stringify([
    candidate.candidateId,
    candidate.candidateKind,
    candidate.statement,
    normalizeReferenceIds(candidate.learningRefs),
    normalizeReferenceIds(candidate.optimizationRefs),
    normalizeReferenceIds(candidate.evidenceRefs),
    candidate.provenance.version,
    candidate.provenance.lifecycle,
    candidate.confidence.level,
    candidate.supersedes,
  ]);
}

/**
 * Canonicalizes a candidate: its learning, optimization, and evidence references
 * de-duplicated and ordered, every other field — statement, provenance, explainability,
 * confidence, supersession — carried UNCHANGED. Frozen.
 */
export function normalizeAwarenessCandidate(candidate: AwarenessCandidate): AwarenessCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    candidateKind: candidate.candidateKind,
    statement: candidate.statement,
    learningRefs: normalizeReferenceIds(candidate.learningRefs),
    optimizationRefs: normalizeReferenceIds(candidate.optimizationRefs),
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
export function normalizeAwarenessCandidates(
  candidates: readonly AwarenessCandidate[],
): readonly AwarenessCandidate[] {
  const byId = new Map<RuntimeId, AwarenessCandidate>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.candidateId)) byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId))
    .map(normalizeAwarenessCandidate);
}

/** A canonical key for a set: its request identity, approval state, and ordered candidate keys. */
export function canonicalAwarenessCandidateSetKey(set: CanonicalAwarenessCandidateSet): string {
  return JSON.stringify([
    set.requestId,
    set.approval.state,
    set.candidates.map(awarenessCandidateKey),
  ]);
}

/**
 * Canonicalizes an Awareness Candidate set into an immutable, frozen form. Deterministic:
 * the same input always produces the same canonical set. Candidates are canonicalized and
 * ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeAwarenessCandidateSet(
  set: AwarenessCandidateSet,
): CanonicalAwarenessCandidateSet {
  return Object.freeze({
    requestId: set.requestId,
    candidates: Object.freeze(normalizeAwarenessCandidates(set.candidates)),
    approval: set.approval,
  });
}
