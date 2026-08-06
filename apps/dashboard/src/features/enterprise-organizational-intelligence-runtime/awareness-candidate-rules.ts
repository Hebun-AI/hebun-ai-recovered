/**
 * Enterprise Organizational Intelligence Runtime — awareness candidate rules (Phase 5).
 *
 * Pure, deterministic lookups and projections over learning candidates, optimization
 * candidates, evidence, and awareness candidates, and the deterministic identification of
 * Awareness Candidates from proposed seeds. These answer plain questions — does a
 * candidate ground in declared learning, does it ground in declared optimization, does it
 * ground in eligible evidence, which optimization does it resolve to — and form candidates
 * from seeds by carrying every bound field UNCHANGED. NO runtime behaviour, NO assessment,
 * NO monitoring, NO scoring, NO recommendation, NO alerting, NO prioritization, NO AI, NO
 * orchestration — only table reads, pure projections, and a total, repeatable
 * seed-to-candidate mapping.
 */

import { runtimeCandidateRequiresBasis } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalOptimizationCandidateSet,
  OptimizationCandidate,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import type {
  AwarenessCandidate,
  AwarenessCandidateRequest,
  AwarenessCandidateSeed,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";

// --- Optimization-support lookups --------------------------------------------

/** Indexes an Optimization Candidate set by candidate identity. First occurrence wins. Read-only. */
export function optimizationSupportIndex(
  optimizationSet: CanonicalOptimizationCandidateSet,
): ReadonlyMap<RuntimeId, OptimizationCandidate> {
  const index = new Map<RuntimeId, OptimizationCandidate>();
  for (const candidate of optimizationSet.candidates) {
    if (!index.has(candidate.candidateId)) index.set(candidate.candidateId, candidate);
  }
  return index;
}

/** Whether an awareness candidate must be grounded in a basis. Always true. */
export function awarenessRequiresBasis(): boolean {
  return runtimeCandidateRequiresBasis("awareness-signal");
}

/**
 * Resolves the optimization candidates a candidate or seed grounds in against an
 * optimization index, in declared reference order. Only references present in the index
 * are resolved; a missing reference resolves to nothing. Read-only projection.
 */
export function resolveSupportingOptimization(
  candidate: Pick<AwarenessCandidate | AwarenessCandidateSeed, "optimizationRefs">,
  index: ReadonlyMap<RuntimeId, OptimizationCandidate>,
): readonly OptimizationCandidate[] {
  const resolved: OptimizationCandidate[] = [];
  for (const ref of candidate.optimizationRefs) {
    const item = index.get(ref);
    if (item !== undefined) resolved.push(item);
  }
  return resolved;
}

/**
 * True when a set of optimization references is a non-empty, fully-grounded basis: every
 * reference resolves to a candidate in the qualified optimization set. Fail-closed
 * grounding — a missing reference makes the basis invalid.
 */
export function groundsInDeclaredOptimization(
  optimizationRefs: readonly RuntimeId[],
  index: ReadonlyMap<RuntimeId, OptimizationCandidate>,
): boolean {
  if (optimizationRefs.length === 0) return false;
  for (const ref of optimizationRefs) {
    if (!index.has(ref)) return false;
  }
  return true;
}

// --- Deterministic identification --------------------------------------------

/**
 * Forms one Awareness Candidate from a proposed seed. Deterministic and total: the
 * awareness kind is fixed to "awareness-signal" and every bound field — statement,
 * learning references, optimization references, evidence references, provenance,
 * explainability, confidence, supersession — is carried through UNCHANGED. Formation
 * decides nothing, assesses nothing, scores nothing, and admits nothing; it only fixes
 * the kind.
 */
export function formAwarenessCandidate(seed: AwarenessCandidateSeed): AwarenessCandidate {
  return {
    candidateId: seed.candidateId,
    candidateKind: "awareness-signal",
    statement: seed.statement,
    learningRefs: seed.learningRefs,
    optimizationRefs: seed.optimizationRefs,
    evidenceRefs: seed.evidenceRefs,
    provenance: seed.provenance,
    explainability: seed.explainability,
    confidence: seed.confidence,
    supersedes: seed.supersedes,
  };
}

/**
 * Identifies the Awareness Candidates of a request by forming each declared seed into a
 * candidate, in declared order. Deterministic: the same seeds always yield the same
 * candidates. Identification forms and preserves; it never filters, ranks, orders by
 * value, assesses, decides, or fabricates — validation is what fails an unqualified
 * request closed.
 */
export function identifyAwarenessCandidates(
  request: AwarenessCandidateRequest,
): readonly AwarenessCandidate[] {
  return request.seeds.map(formAwarenessCandidate);
}

// --- Projections -------------------------------------------------------------

/** The prior candidate this candidate supersedes, or null. Read-only projection. */
export function awarenessCandidateSupersedes(candidate: AwarenessCandidate): RuntimeId | null {
  return candidate.supersedes;
}
