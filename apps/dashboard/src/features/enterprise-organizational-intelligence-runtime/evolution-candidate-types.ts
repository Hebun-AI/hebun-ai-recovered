/**
 * Enterprise Organizational Intelligence Runtime — Evolution Candidate ontology (Phase 6).
 *
 * Declares what an Evolution Candidate IS: the shapes through which the Runtime, over an
 * already-assembled Runtime Context (a Phase 2 bundle), the qualified Learning Candidates
 * of a Phase 3 set, the qualified Optimization Candidates of a Phase 4 set, and the
 * qualified Awareness Candidates of a Phase 5 set, together with a pool of eligible
 * governed evidence, identifies and preserves attributable Evolution Candidates — each an
 * evolution-readiness or evolution-pathway candidate carrying its supporting learning,
 * optimization, awareness, and evidence references, provenance, explainability,
 * confidence, and uncertainty, immutable and awaiting Director review.
 *
 * An Evolution Candidate is NOT a readiness assessment, NOT a transformation, NOT a
 * prediction, NOT a forecast, NOT a simulation, NOT a roadmap, NOT a plan, NOT a
 * recommendation, and NOT a decision. It is a non-authoritative Director-review artifact.
 * Phase 6 identifies and preserves; it never assesses readiness or transformation,
 * predicts, forecasts, simulates, plans work, generates a roadmap, recommends actions or
 * strategy, prioritizes, executes, runs a workflow, calls AI or an LLM, modifies memory,
 * reasoning, organization, learning, optimization, or awareness, persists, invokes an
 * API, approves, decides, or bypasses the Director. These shapes describe a candidate;
 * they run nothing, hold no state, and mutate nothing. They build only on the Phase 1
 * Runtime contracts and types, the Phase 2 assembly bundle, the Phase 3 learning
 * candidate shapes, the Phase 4 optimization candidate shapes, and the Phase 5 awareness
 * candidate shapes.
 */

import type {
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
import type {
  CanonicalLearningCandidateSet,
  LearningEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import type { CanonicalOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import type { CanonicalAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";

/**
 * The candidate kinds this phase produces: an evolution-readiness candidate or an
 * evolution-pathway candidate. Both are non-authoritative and evidence-grounded. Fixed —
 * Phase 6 forms these two kinds only. It never forms an assessment, a forecast, a
 * roadmap, or a plan: those are prohibited non-responsibilities of this phase.
 */
export type EvolutionCandidateKind = "evolution-readiness" | "evolution-pathway";

/**
 * A proposed evolution candidate awaiting formation: its identity, its declared kind, the
 * evolution it states, the qualified learning candidates, qualified optimization
 * candidates, qualified awareness candidates, and eligible evidence it is grounded in, its
 * bound provenance, explainability, and confidence, and the prior candidate it supersedes
 * (or null). A seed is untrusted proposal material — it is never accepted directly; it
 * becomes a candidate only by passing validation, learning, optimization, awareness, and
 * evidence grounding, and preservation at the boundary.
 */
export interface EvolutionCandidateSeed {
  readonly candidateId: RuntimeId;
  readonly candidateKind: EvolutionCandidateKind;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly optimizationRefs: readonly RuntimeId[];
  readonly awarenessRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * One prepared, immutable Evolution Candidate: its identity, its evolution kind, the
 * evolution it states, the supporting learning-candidate references, supporting
 * optimization-candidate references, supporting awareness-candidate references, and
 * supporting evidence references it is grounded in, and the preserved provenance,
 * explainability, and confidence it must always carry — plus the prior candidate it
 * supersedes (or null), so history is preserved and never rewritten. A candidate is
 * attributable, uncertainty-preserving, reviewable, and non-authoritative: never a
 * readiness assessment, a transformation, a forecast, a simulation, a roadmap, a plan, a
 * recommendation, a decision, an approval, or a command.
 */
export interface EvolutionCandidate {
  readonly candidateId: RuntimeId;
  readonly candidateKind: EvolutionCandidateKind;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly optimizationRefs: readonly RuntimeId[];
  readonly awarenessRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * The declared request for one evolution pass: an identity, the assembled Runtime Context
 * (a Phase 2 bundle) it is bound to, the qualified Learning Candidate set (a Phase 3 set),
 * qualified Optimization Candidate set (a Phase 4 set), and qualified Awareness Candidate
 * set (a Phase 5 set) its candidates may ground in, the pool of eligible evidence they may
 * ground in, and the proposed seeds to be formed into candidates. A request is a
 * declaration of intent and boundary — it identifies nothing on its own.
 */
export interface EvolutionCandidateRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly awarenessSet: CanonicalAwarenessCandidateSet;
  readonly evidence: readonly LearningEvidence[];
  readonly seeds: readonly EvolutionCandidateSeed[];
}

/**
 * The advisory deliverable of an evolution pass: the immutable Evolution Candidates it
 * prepared and the approval marker they carry — always pending a Director decision. A set
 * is attributable and non-authoritative; it terminates at the Director Approval boundary
 * and is never a Decision, a readiness assessment, a roadmap, a plan, or an execution
 * artifact.
 */
export interface EvolutionCandidateSet {
  readonly requestId: RuntimeId;
  readonly candidates: readonly EvolutionCandidate[];
  readonly approval: RuntimeApproval;
}

/**
 * A set that has passed through evolution normalization: candidates de-duplicated by
 * identity and canonically ordered, each candidate's learning, optimization, awareness,
 * and evidence references de-duplicated and totally ordered. Structurally an
 * {@link EvolutionCandidateSet}; the alias marks that canonical form has been applied.
 */
export type CanonicalEvolutionCandidateSet = EvolutionCandidateSet;
