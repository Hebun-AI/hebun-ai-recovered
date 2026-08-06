/**
 * Enterprise Organizational Intelligence Runtime — learning candidate rules (Phase 3).
 *
 * Pure, deterministic lookups and projections over evidence and learning candidates,
 * and the deterministic identification of Learning Candidates from proposed seeds. These
 * answer plain questions — is this evidence eligible, does a candidate ground in
 * eligible evidence, which evidence does a candidate resolve to — and form candidates
 * from seeds by carrying every bound field UNCHANGED. NO runtime behaviour, NO
 * knowledge admission, NO fact creation, NO decision, NO AI, NO orchestration — only
 * table reads, pure projections, and a total, repeatable seed-to-candidate mapping.
 */

import { runtimeCandidateRequiresBasis } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  LearningCandidate,
  LearningCandidateRequest,
  LearningCandidateSeed,
  LearningEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";

// --- Evidence lookups --------------------------------------------------------

/** Indexes an evidence pool by identity. First occurrence of an id wins. Read-only. */
export function learningEvidenceIndex(
  evidence: readonly LearningEvidence[],
): ReadonlyMap<RuntimeId, LearningEvidence> {
  const index = new Map<RuntimeId, LearningEvidence>();
  for (const item of evidence) {
    if (!index.has(item.evidenceId)) index.set(item.evidenceId, item);
  }
  return index;
}

/** True when governance has marked an evidence item eligible for grounding. */
export function isLearningEvidenceEligible(evidence: LearningEvidence): boolean {
  return evidence.eligible === true;
}

/** Whether a learning candidate must be grounded in an evidence basis. Always true. */
export function learningRequiresBasis(): boolean {
  return runtimeCandidateRequiresBasis("learning");
}

/**
 * Resolves the evidence a candidate or seed grounds in against an evidence index, in
 * the candidate's declared reference order. Only references present in the index are
 * resolved; a missing reference resolves to nothing. Read-only projection.
 */
export function resolveCandidateEvidence(
  candidate: Pick<LearningCandidate | LearningCandidateSeed, "evidenceRefs">,
  index: ReadonlyMap<RuntimeId, LearningEvidence>,
): readonly LearningEvidence[] {
  const resolved: LearningEvidence[] = [];
  for (const ref of candidate.evidenceRefs) {
    const item = index.get(ref);
    if (item !== undefined) resolved.push(item);
  }
  return resolved;
}

/**
 * True when a set of evidence references is a non-empty, fully-grounded basis: every
 * reference is present in the index and eligible. Fail-closed grounding — a missing or
 * ineligible reference makes the basis invalid.
 */
export function groundsInEligibleEvidence(
  evidenceRefs: readonly RuntimeId[],
  index: ReadonlyMap<RuntimeId, LearningEvidence>,
): boolean {
  if (evidenceRefs.length === 0) return false;
  for (const ref of evidenceRefs) {
    const item = index.get(ref);
    if (item === undefined || !isLearningEvidenceEligible(item)) return false;
  }
  return true;
}

// --- Deterministic identification --------------------------------------------

/**
 * Forms one Learning Candidate from a proposed seed. Deterministic and total: the
 * learning kind is fixed to "learning" and every bound field — statement, evidence
 * references, provenance, explainability, confidence, supersession — is carried through
 * UNCHANGED. Formation creates no fact and admits nothing; it only fixes the kind.
 */
export function formLearningCandidate(seed: LearningCandidateSeed): LearningCandidate {
  return {
    candidateId: seed.candidateId,
    candidateKind: "learning",
    statement: seed.statement,
    evidenceRefs: seed.evidenceRefs,
    provenance: seed.provenance,
    explainability: seed.explainability,
    confidence: seed.confidence,
    supersedes: seed.supersedes,
  };
}

/**
 * Identifies the Learning Candidates of a request by forming each declared seed into a
 * candidate, in declared order. Deterministic: the same seeds always yield the same
 * candidates. Identification forms and preserves; it never filters, ranks, decides, or
 * fabricates — validation is what fails an unqualified request closed.
 */
export function identifyLearningCandidates(
  request: LearningCandidateRequest,
): readonly LearningCandidate[] {
  return request.seeds.map(formLearningCandidate);
}

// --- Projections -------------------------------------------------------------

/** The prior candidate this candidate supersedes, or null. Read-only projection. */
export function learningCandidateSupersedes(candidate: LearningCandidate): RuntimeId | null {
  return candidate.supersedes;
}
