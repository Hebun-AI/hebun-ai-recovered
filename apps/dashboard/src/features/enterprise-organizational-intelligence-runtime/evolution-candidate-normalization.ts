/**
 * Enterprise Organizational Intelligence Runtime — evolution candidate normalization (Phase 6).
 *
 * Deterministically canonicalizes an Evolution Candidate set:
 *   - each candidate's learning references, optimization references, awareness references,
 *     and evidence references are de-duplicated and totally ordered,
 *   - candidates are de-duplicated by identity and ordered by canonical identity,
 *   - provenance, explainability, confidence, and uncertainty are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole set is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO readiness assessment, NO
 * forecasting, NO simulation, NO roadmap generation, NO prioritization, NO mutation of any
 * preserved value. Ordering and de-duplication happen by canonical key only. Keys use JSON
 * encoding so they are unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalEvolutionCandidateSet,
  EvolutionCandidate,
  EvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";

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

/** An unambiguous, text-safe key for one evolution candidate. */
export function evolutionCandidateKey(candidate: EvolutionCandidate): string {
  return JSON.stringify([
    candidate.candidateId,
    candidate.candidateKind,
    candidate.statement,
    normalizeReferenceIds(candidate.learningRefs),
    normalizeReferenceIds(candidate.optimizationRefs),
    normalizeReferenceIds(candidate.awarenessRefs),
    normalizeReferenceIds(candidate.evidenceRefs),
    candidate.provenance.version,
    candidate.provenance.lifecycle,
    candidate.confidence.level,
    candidate.supersedes,
  ]);
}

/**
 * Canonicalizes a candidate: its learning, optimization, awareness, and evidence
 * references de-duplicated and ordered, every other field — kind, statement, provenance,
 * explainability, confidence, supersession — carried UNCHANGED. Frozen.
 */
export function normalizeEvolutionCandidate(candidate: EvolutionCandidate): EvolutionCandidate {
  return Object.freeze({
    candidateId: candidate.candidateId,
    candidateKind: candidate.candidateKind,
    statement: candidate.statement,
    learningRefs: normalizeReferenceIds(candidate.learningRefs),
    optimizationRefs: normalizeReferenceIds(candidate.optimizationRefs),
    awarenessRefs: normalizeReferenceIds(candidate.awarenessRefs),
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
export function normalizeEvolutionCandidates(
  candidates: readonly EvolutionCandidate[],
): readonly EvolutionCandidate[] {
  const byId = new Map<RuntimeId, EvolutionCandidate>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.candidateId)) byId.set(candidate.candidateId, candidate);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.candidateId, right.candidateId))
    .map(normalizeEvolutionCandidate);
}

/** A canonical key for a set: its request identity, approval state, and ordered candidate keys. */
export function canonicalEvolutionCandidateSetKey(set: CanonicalEvolutionCandidateSet): string {
  return JSON.stringify([
    set.requestId,
    set.approval.state,
    set.candidates.map(evolutionCandidateKey),
  ]);
}

/**
 * Canonicalizes an Evolution Candidate set into an immutable, frozen form. Deterministic:
 * the same input always produces the same canonical set. Candidates are canonicalized and
 * ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeEvolutionCandidateSet(
  set: EvolutionCandidateSet,
): CanonicalEvolutionCandidateSet {
  return Object.freeze({
    requestId: set.requestId,
    candidates: Object.freeze(normalizeEvolutionCandidates(set.candidates)),
    approval: set.approval,
  });
}
