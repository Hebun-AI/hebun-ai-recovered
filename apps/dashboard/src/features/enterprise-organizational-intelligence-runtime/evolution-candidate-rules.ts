/**
 * Enterprise Organizational Intelligence Runtime — evolution candidate rules (Phase 6).
 *
 * Pure, deterministic lookups and projections over learning candidates, optimization
 * candidates, awareness candidates, evidence, and evolution candidates, and the
 * deterministic identification of Evolution Candidates from proposed seeds. These answer
 * plain questions — does a candidate ground in declared awareness, which awareness does it
 * resolve to — and form candidates from seeds by carrying every bound field UNCHANGED. NO
 * runtime behaviour, NO readiness assessment, NO transformation assessment, NO prediction,
 * NO forecasting, NO simulation, NO roadmap generation, NO planning, NO recommendation, NO
 * prioritization, NO AI, NO orchestration — only table reads, pure projections, and a
 * total, repeatable seed-to-candidate mapping.
 */

import { runtimeCandidateRequiresBasis } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  AwarenessCandidate,
  CanonicalAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import type {
  EvolutionCandidate,
  EvolutionCandidateKind,
  EvolutionCandidateRequest,
  EvolutionCandidateSeed,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";

/** The frozen, canonical set of evolution candidate kinds this phase forms. */
export const EVOLUTION_CANDIDATE_KINDS: readonly EvolutionCandidateKind[] = Object.freeze([
  "evolution-readiness",
  "evolution-pathway",
]);

// --- Awareness-support lookups -----------------------------------------------

/** Indexes an Awareness Candidate set by candidate identity. First occurrence wins. Read-only. */
export function awarenessSupportIndex(
  awarenessSet: CanonicalAwarenessCandidateSet,
): ReadonlyMap<RuntimeId, AwarenessCandidate> {
  const index = new Map<RuntimeId, AwarenessCandidate>();
  for (const candidate of awarenessSet.candidates) {
    if (!index.has(candidate.candidateId)) index.set(candidate.candidateId, candidate);
  }
  return index;
}

/** Whether an evolution candidate of the given kind must be grounded in a basis. Always true. */
export function evolutionRequiresBasis(kind: EvolutionCandidateKind): boolean {
  return runtimeCandidateRequiresBasis(kind);
}

/** Whether a kind is one of the two evolution kinds this phase forms. */
export function isEvolutionCandidateKind(kind: string): kind is EvolutionCandidateKind {
  return kind === "evolution-readiness" || kind === "evolution-pathway";
}

/**
 * Resolves the awareness candidates a candidate or seed grounds in against an awareness
 * index, in declared reference order. Only references present in the index are resolved;
 * a missing reference resolves to nothing. Read-only projection.
 */
export function resolveSupportingAwareness(
  candidate: Pick<EvolutionCandidate | EvolutionCandidateSeed, "awarenessRefs">,
  index: ReadonlyMap<RuntimeId, AwarenessCandidate>,
): readonly AwarenessCandidate[] {
  const resolved: AwarenessCandidate[] = [];
  for (const ref of candidate.awarenessRefs) {
    const item = index.get(ref);
    if (item !== undefined) resolved.push(item);
  }
  return resolved;
}

/**
 * True when a set of awareness references is a non-empty, fully-grounded basis: every
 * reference resolves to a candidate in the qualified awareness set. Fail-closed grounding
 * — a missing reference makes the basis invalid.
 */
export function groundsInDeclaredAwareness(
  awarenessRefs: readonly RuntimeId[],
  index: ReadonlyMap<RuntimeId, AwarenessCandidate>,
): boolean {
  if (awarenessRefs.length === 0) return false;
  for (const ref of awarenessRefs) {
    if (!index.has(ref)) return false;
  }
  return true;
}

// --- Deterministic identification --------------------------------------------

/**
 * Forms one Evolution Candidate from a proposed seed. Deterministic and total: every
 * bound field — kind, statement, learning references, optimization references, awareness
 * references, evidence references, provenance, explainability, confidence, supersession —
 * is carried through UNCHANGED. Formation assesses nothing, predicts nothing, forecasts
 * nothing, simulates nothing, plans nothing, and admits nothing; it carries the seed
 * forward.
 */
export function formEvolutionCandidate(seed: EvolutionCandidateSeed): EvolutionCandidate {
  return {
    candidateId: seed.candidateId,
    candidateKind: seed.candidateKind,
    statement: seed.statement,
    learningRefs: seed.learningRefs,
    optimizationRefs: seed.optimizationRefs,
    awarenessRefs: seed.awarenessRefs,
    evidenceRefs: seed.evidenceRefs,
    provenance: seed.provenance,
    explainability: seed.explainability,
    confidence: seed.confidence,
    supersedes: seed.supersedes,
  };
}

/**
 * Identifies the Evolution Candidates of a request by forming each declared seed into a
 * candidate, in declared order. Deterministic: the same seeds always yield the same
 * candidates. Identification forms and preserves; it never filters, ranks, orders by
 * value, assesses, predicts, decides, or fabricates — validation is what fails an
 * unqualified request closed.
 */
export function identifyEvolutionCandidates(
  request: EvolutionCandidateRequest,
): readonly EvolutionCandidate[] {
  return request.seeds.map(formEvolutionCandidate);
}

// --- Projections -------------------------------------------------------------

/** The prior candidate this candidate supersedes, or null. Read-only projection. */
export function evolutionCandidateSupersedes(candidate: EvolutionCandidate): RuntimeId | null {
  return candidate.supersedes;
}
