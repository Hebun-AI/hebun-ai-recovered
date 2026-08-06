/**
 * Enterprise Organizational Intelligence Runtime — optimization candidate rules (Phase 4).
 *
 * Pure, deterministic lookups and projections over learning candidates, evidence, and
 * optimization candidates, and the deterministic identification of Optimization
 * Candidates from proposed seeds. These answer plain questions — does a candidate ground
 * in declared learning, does it ground in eligible evidence, which learning and evidence
 * does it resolve to — and form candidates from seeds by carrying every bound field
 * UNCHANGED. NO runtime behaviour, NO decision, NO prioritization, NO optimization
 * engine, NO AI, NO orchestration — only table reads, pure projections, and a total,
 * repeatable seed-to-candidate mapping.
 */

import { runtimeCandidateRequiresBasis } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalLearningCandidateSet,
  LearningCandidate,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import type {
  OptimizationCandidate,
  OptimizationCandidateRequest,
  OptimizationCandidateSeed,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";

// --- Learning-support lookups ------------------------------------------------

/** Indexes a Learning Candidate set by candidate identity. First occurrence wins. Read-only. */
export function learningSupportIndex(
  learningSet: CanonicalLearningCandidateSet,
): ReadonlyMap<RuntimeId, LearningCandidate> {
  const index = new Map<RuntimeId, LearningCandidate>();
  for (const candidate of learningSet.candidates) {
    if (!index.has(candidate.candidateId)) index.set(candidate.candidateId, candidate);
  }
  return index;
}

/** Whether an optimization candidate must be grounded in a basis. Always true. */
export function optimizationRequiresBasis(): boolean {
  return runtimeCandidateRequiresBasis("optimization");
}

/**
 * Resolves the learning candidates a candidate or seed grounds in against a learning
 * index, in declared reference order. Only references present in the index are resolved;
 * a missing reference resolves to nothing. Read-only projection.
 */
export function resolveSupportingLearning(
  candidate: Pick<OptimizationCandidate | OptimizationCandidateSeed, "learningRefs">,
  index: ReadonlyMap<RuntimeId, LearningCandidate>,
): readonly LearningCandidate[] {
  const resolved: LearningCandidate[] = [];
  for (const ref of candidate.learningRefs) {
    const item = index.get(ref);
    if (item !== undefined) resolved.push(item);
  }
  return resolved;
}

/**
 * True when a set of learning references is a non-empty, fully-grounded basis: every
 * reference resolves to a candidate in the qualified learning set. Fail-closed grounding
 * — a missing reference makes the basis invalid.
 */
export function groundsInDeclaredLearning(
  learningRefs: readonly RuntimeId[],
  index: ReadonlyMap<RuntimeId, LearningCandidate>,
): boolean {
  if (learningRefs.length === 0) return false;
  for (const ref of learningRefs) {
    if (!index.has(ref)) return false;
  }
  return true;
}

// --- Deterministic identification --------------------------------------------

/**
 * Forms one Optimization Candidate from a proposed seed. Deterministic and total: the
 * optimization kind is fixed to "optimization" and every bound field — statement,
 * learning references, evidence references, provenance, explainability, confidence,
 * supersession — is carried through UNCHANGED. Formation decides nothing, prioritizes
 * nothing, and admits nothing; it only fixes the kind.
 */
export function formOptimizationCandidate(seed: OptimizationCandidateSeed): OptimizationCandidate {
  return {
    candidateId: seed.candidateId,
    candidateKind: "optimization",
    statement: seed.statement,
    learningRefs: seed.learningRefs,
    evidenceRefs: seed.evidenceRefs,
    provenance: seed.provenance,
    explainability: seed.explainability,
    confidence: seed.confidence,
    supersedes: seed.supersedes,
  };
}

/**
 * Identifies the Optimization Candidates of a request by forming each declared seed into
 * a candidate, in declared order. Deterministic: the same seeds always yield the same
 * candidates. Identification forms and preserves; it never filters, ranks, orders by
 * value, decides, or fabricates — validation is what fails an unqualified request closed.
 */
export function identifyOptimizationCandidates(
  request: OptimizationCandidateRequest,
): readonly OptimizationCandidate[] {
  return request.seeds.map(formOptimizationCandidate);
}

// --- Projections -------------------------------------------------------------

/** The prior candidate this candidate supersedes, or null. Read-only projection. */
export function optimizationCandidateSupersedes(candidate: OptimizationCandidate): RuntimeId | null {
  return candidate.supersedes;
}
