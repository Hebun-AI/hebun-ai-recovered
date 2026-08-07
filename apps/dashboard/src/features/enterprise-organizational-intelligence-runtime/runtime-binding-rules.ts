/**
 * Enterprise Organizational Intelligence Runtime — binding rules (Phase 7).
 *
 * Pure, deterministic projection of already-produced candidates into uniform Bound Runtime
 * Artifacts, and the deterministic derivation of a binding identity. These carry every
 * bound field — provenance, explainability, confidence, uncertainty, and every supporting
 * reference — through UNCHANGED, fixing only the source kind and the derived binding
 * identity. NO runtime behaviour, NO candidate creation, NO fact creation, NO reasoning, NO
 * confidence calculation, NO uncertainty suppression, NO scoring, NO recommendation, NO AI,
 * NO orchestration — only a total, repeatable candidate-to-artifact mapping and pure
 * projections.
 */

import type {
  RuntimeCandidateKind,
  RuntimeId,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { LearningCandidate } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import type { OptimizationCandidate } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import type { AwarenessCandidate } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import type { EvolutionCandidate } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";
import type {
  BoundRuntimeArtifact,
  RuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";

/** The approval marker every bound artifact carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL = Object.freeze({ state: "pending-director" } as const);

/**
 * The deterministic binding identity of a source candidate: its kind and identity joined
 * by a fixed, unambiguous separator. Total and repeatable — the same source always yields
 * the same identity, and distinct sources never collide because kind and id are both
 * carried. This derives an identity; it generates nothing random and mints no UUID.
 */
export function bindingIdentity(kind: RuntimeCandidateKind, candidateId: RuntimeId): RuntimeId {
  return `${kind}::${candidateId}`;
}

/**
 * Binds one Learning Candidate into a uniform artifact. Evidence is preserved; the
 * cross-candidate reference lists are empty because a learning candidate declares none.
 * Every carried field is UNCHANGED.
 */
export function bindLearningCandidate(candidate: LearningCandidate): BoundRuntimeArtifact {
  return {
    bindingId: bindingIdentity(candidate.candidateKind, candidate.candidateId),
    sourceKind: candidate.candidateKind,
    sourceCandidateId: candidate.candidateId,
    statement: candidate.statement,
    provenance: candidate.provenance,
    explainability: candidate.explainability,
    confidence: candidate.confidence,
    evidenceRefs: candidate.evidenceRefs,
    learningRefs: [],
    optimizationRefs: [],
    awarenessRefs: [],
    evolutionRefs: [],
    approval: PENDING_DIRECTOR_APPROVAL,
  };
}

/** Binds one Optimization Candidate into a uniform artifact. Learning and evidence preserved. */
export function bindOptimizationCandidate(candidate: OptimizationCandidate): BoundRuntimeArtifact {
  return {
    bindingId: bindingIdentity(candidate.candidateKind, candidate.candidateId),
    sourceKind: candidate.candidateKind,
    sourceCandidateId: candidate.candidateId,
    statement: candidate.statement,
    provenance: candidate.provenance,
    explainability: candidate.explainability,
    confidence: candidate.confidence,
    evidenceRefs: candidate.evidenceRefs,
    learningRefs: candidate.learningRefs,
    optimizationRefs: [],
    awarenessRefs: [],
    evolutionRefs: [],
    approval: PENDING_DIRECTOR_APPROVAL,
  };
}

/** Binds one Awareness Candidate into a uniform artifact. Learning, optimization, evidence preserved. */
export function bindAwarenessCandidate(candidate: AwarenessCandidate): BoundRuntimeArtifact {
  return {
    bindingId: bindingIdentity(candidate.candidateKind, candidate.candidateId),
    sourceKind: candidate.candidateKind,
    sourceCandidateId: candidate.candidateId,
    statement: candidate.statement,
    provenance: candidate.provenance,
    explainability: candidate.explainability,
    confidence: candidate.confidence,
    evidenceRefs: candidate.evidenceRefs,
    learningRefs: candidate.learningRefs,
    optimizationRefs: candidate.optimizationRefs,
    awarenessRefs: [],
    evolutionRefs: [],
    approval: PENDING_DIRECTOR_APPROVAL,
  };
}

/** Binds one Evolution Candidate into a uniform artifact. Learning, optimization, awareness, evidence preserved. */
export function bindEvolutionCandidate(candidate: EvolutionCandidate): BoundRuntimeArtifact {
  return {
    bindingId: bindingIdentity(candidate.candidateKind, candidate.candidateId),
    sourceKind: candidate.candidateKind,
    sourceCandidateId: candidate.candidateId,
    statement: candidate.statement,
    provenance: candidate.provenance,
    explainability: candidate.explainability,
    confidence: candidate.confidence,
    evidenceRefs: candidate.evidenceRefs,
    learningRefs: candidate.learningRefs,
    optimizationRefs: candidate.optimizationRefs,
    awarenessRefs: candidate.awarenessRefs,
    evolutionRefs: [],
    approval: PENDING_DIRECTOR_APPROVAL,
  };
}

/**
 * Binds every candidate of a request into uniform artifacts, in the fixed kind order
 * learning → optimization → awareness → evolution, preserving each set's own candidate
 * order. Deterministic: the same request always yields the same artifacts. Binding forms
 * and preserves; it never filters, ranks, decides, or fabricates — validation is what fails
 * an unqualified request closed, and normalization is what imposes canonical order.
 */
export function bindCandidateSets(request: RuntimeBindingRequest): readonly BoundRuntimeArtifact[] {
  return [
    ...request.learningSet.candidates.map(bindLearningCandidate),
    ...request.optimizationSet.candidates.map(bindOptimizationCandidate),
    ...request.awarenessSet.candidates.map(bindAwarenessCandidate),
    ...request.evolutionSet.candidates.map(bindEvolutionCandidate),
  ];
}

// --- Projections -------------------------------------------------------------

/** The source candidate identity a bound artifact projects. Read-only projection. */
export function boundArtifactSource(artifact: BoundRuntimeArtifact): {
  readonly kind: RuntimeCandidateKind;
  readonly candidateId: RuntimeId;
} {
  return { kind: artifact.sourceKind, candidateId: artifact.sourceCandidateId };
}
