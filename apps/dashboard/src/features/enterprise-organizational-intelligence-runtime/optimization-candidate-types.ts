/**
 * Enterprise Organizational Intelligence Runtime — Optimization Candidate ontology (Phase 4).
 *
 * Declares what an Optimization Candidate IS: the shapes through which the Runtime, over
 * an already-assembled Runtime Context (a Phase 2 bundle) and the qualified Learning
 * Candidates of a Phase 3 set, together with a pool of eligible governed evidence,
 * identifies and preserves attributable Optimization Candidates — each carrying its
 * supporting learning references, supporting evidence references, provenance,
 * explainability, confidence, and uncertainty, immutable and awaiting Director review.
 *
 * An Optimization Candidate is NOT a decision, NOT a priority, NOT a plan, and NOT a
 * workflow. It is a non-authoritative Director-review artifact. Phase 4 identifies and
 * preserves; it never decides, prioritizes, plans, orchestrates, reorganizes, reassigns
 * work, executes, calls AI or an LLM, modifies memory or organization state, runs an
 * optimization engine or a prioritization algorithm, or bypasses the Director. These
 * shapes describe a candidate; they run nothing, hold no state, and mutate nothing. They
 * build only on the Phase 1 Runtime contracts and types, the Phase 2 assembly bundle,
 * and the Phase 3 learning candidate shapes.
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

/** The single candidate kind this phase produces. Fixed — Phase 4 forms optimization only. */
export type OptimizationCandidateKind = "optimization";

/**
 * A proposed optimization awaiting formation into a candidate: its identity, the
 * optimization it states, the qualified learning candidates and eligible evidence it is
 * grounded in, its bound provenance, explainability, and confidence, and the prior
 * candidate it supersedes (or null). A seed is untrusted proposal material — it is never
 * accepted directly; it becomes a candidate only by passing validation, learning and
 * evidence grounding, and preservation at the boundary.
 */
export interface OptimizationCandidateSeed {
  readonly candidateId: RuntimeId;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * One prepared, immutable Optimization Candidate: its identity, its fixed optimization
 * kind, the optimization it states, the supporting learning-candidate references and
 * supporting evidence references it is grounded in, and the preserved provenance,
 * explainability, and confidence it must always carry — plus the prior candidate it
 * supersedes (or null), so history is preserved and never rewritten. A candidate is
 * attributable, uncertainty-preserving, reviewable, and non-authoritative: never a
 * decision, a priority, a plan, a workflow, an approval, or a command.
 */
export interface OptimizationCandidate {
  readonly candidateId: RuntimeId;
  readonly candidateKind: OptimizationCandidateKind;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * The declared request for one optimization pass: an identity, the assembled Runtime
 * Context (a Phase 2 bundle) it is bound to, the qualified Learning Candidate set (a
 * Phase 3 set) its candidates may ground in, the pool of eligible evidence they may
 * ground in, and the proposed seeds to be formed into candidates. A request is a
 * declaration of intent and boundary — it identifies nothing on its own.
 */
export interface OptimizationCandidateRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly evidence: readonly LearningEvidence[];
  readonly seeds: readonly OptimizationCandidateSeed[];
}

/**
 * The advisory deliverable of an optimization pass: the immutable Optimization
 * Candidates it prepared and the approval marker they carry — always pending a Director
 * decision. A set is attributable and non-authoritative; it terminates at the Director
 * Approval boundary and is never a Decision, a priority order, a plan, or an execution
 * artifact.
 */
export interface OptimizationCandidateSet {
  readonly requestId: RuntimeId;
  readonly candidates: readonly OptimizationCandidate[];
  readonly approval: RuntimeApproval;
}

/**
 * A set that has passed through optimization normalization: candidates de-duplicated by
 * identity and canonically ordered, each candidate's learning and evidence references
 * de-duplicated and totally ordered. Structurally an {@link OptimizationCandidateSet};
 * the alias marks that canonical form has been applied.
 */
export type CanonicalOptimizationCandidateSet = OptimizationCandidateSet;
