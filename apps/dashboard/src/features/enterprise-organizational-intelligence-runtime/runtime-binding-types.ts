/**
 * Enterprise Organizational Intelligence Runtime — Provenance/Explainability/Confidence
 * Binding ontology (Phase 7).
 *
 * Declares what a Bound Runtime Artifact IS: the single, uniform shape into which the
 * Runtime consolidates every already-produced candidate — a Phase 3 Learning Candidate, a
 * Phase 4 Optimization Candidate, a Phase 5 Awareness Candidate, or a Phase 6 Evolution
 * Candidate — so that provenance, evidence, explanation, confidence, and uncertainty are
 * carried uniformly and hardened across all kinds. Phase 7 binds; it does not re-derive.
 *
 * A Bound Runtime Artifact is NOT a new candidate, NOT a new fact, NOT a score, NOT a
 * recommendation, and NOT a decision. It is a preserved, attributable, uncertainty-bearing
 * projection of an existing candidate, awaiting Director review and Heby explanation.
 * Phase 7 binds, validates, normalizes, canonicalizes, and freezes; it never creates
 * learning, optimization, awareness, or evolution, never reasons, never calculates or
 * suppresses confidence or uncertainty, never recommends, prioritizes, decides, approves,
 * executes, plans, orchestrates, calls AI or an LLM, persists, invokes an API, modifies
 * memory, reasoning, organization, or any candidate set, and never bypasses the Director.
 * These shapes describe a bound artifact; they run nothing, hold no state, and mutate
 * nothing. They build only on the Phase 1 contracts and types, the Phase 2 assembly
 * bundle, and the Phase 3–6 candidate set shapes.
 */

import type {
  RuntimeCandidateKind,
  RuntimeId,
  RuntimeStatement,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  RuntimeApproval,
  RuntimeConfidence,
  RuntimeExplainability,
  RuntimeProvenance,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type { CanonicalRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import type { CanonicalLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import type { CanonicalOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import type { CanonicalAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import type { CanonicalEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";

/**
 * One bound artifact: the uniform, immutable projection of a single source candidate. It
 * carries a deterministic binding identity, the source candidate's kind and identity, its
 * statement, its preserved provenance, explainability, and confidence, its supporting
 * evidence, learning, optimization, awareness, and evolution references (each present only
 * where the source kind declares it, empty otherwise), and the approval marker it must
 * always carry — always pending a Director decision. Nothing here is computed; every field
 * is carried through from the source candidate UNCHANGED.
 */
export interface BoundRuntimeArtifact {
  readonly bindingId: RuntimeId;
  readonly sourceKind: RuntimeCandidateKind;
  readonly sourceCandidateId: RuntimeId;
  readonly statement: RuntimeStatement;
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly evidenceRefs: readonly RuntimeId[];
  readonly learningRefs: readonly RuntimeId[];
  readonly optimizationRefs: readonly RuntimeId[];
  readonly awarenessRefs: readonly RuntimeId[];
  readonly evolutionRefs: readonly RuntimeId[];
  readonly approval: RuntimeApproval;
}

/**
 * The declared request for one binding pass: an identity, the assembled Runtime Context (a
 * Phase 2 bundle) the binding is bound to, and the four qualified, canonical candidate sets
 * it consolidates read-only. A request is a declaration of intent and boundary — it binds
 * nothing on its own; it names the settled inputs a binding pass consumes.
 */
export interface RuntimeBindingRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly awarenessSet: CanonicalAwarenessCandidateSet;
  readonly evolutionSet: CanonicalEvolutionCandidateSet;
}

/**
 * The advisory deliverable of a binding pass: every source candidate bound into one
 * immutable, uniform artifact, and the approval marker they carry — always pending a
 * Director decision. A binding bundle is attributable and non-authoritative; it terminates
 * at the Director Approval boundary and is the settled input consumed later by the Director
 * Briefing Runtime, the Heby Explanation Runtime, and the Governance Runtime. It is never a
 * Decision, a score, a recommendation, or an execution artifact.
 */
export interface RuntimeBindingBundle {
  readonly requestId: RuntimeId;
  readonly artifacts: readonly BoundRuntimeArtifact[];
  readonly approval: RuntimeApproval;
}

/**
 * A binding bundle that has passed through binding normalization: artifacts de-duplicated
 * by binding identity and canonically ordered, each artifact's reference lists
 * de-duplicated and totally ordered. Structurally a {@link RuntimeBindingBundle}; the alias
 * marks that canonical form has been applied.
 */
export type CanonicalRuntimeBindingBundle = RuntimeBindingBundle;
