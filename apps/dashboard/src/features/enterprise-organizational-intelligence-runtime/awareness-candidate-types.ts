/**
 * Enterprise Organizational Intelligence Runtime — Awareness Candidate ontology (Phase 5).
 *
 * Declares what an Awareness Candidate IS: the shapes through which the Runtime, over an
 * already-assembled Runtime Context (a Phase 2 bundle), the qualified Learning Candidates
 * of a Phase 3 set, and the qualified Optimization Candidates of a Phase 4 set, together
 * with a pool of eligible governed evidence, identifies and preserves attributable
 * Awareness Candidates — each carrying its supporting learning references, supporting
 * optimization references, supporting evidence references, provenance, explainability,
 * confidence, and uncertainty, immutable and awaiting Director review.
 *
 * An Awareness Candidate is NOT an assessment, NOT a score, NOT a recommendation, NOT an
 * alert, NOT a priority, NOT a decision, and NOT monitoring. It is a non-authoritative
 * Director-review artifact. Phase 5 identifies and preserves; it never assesses, monitors,
 * scores, recommends, alerts, prioritizes, plans or executes work, runs a workflow, calls
 * AI or an LLM, modifies memory, reasoning, organization, optimization, or learning,
 * persists, invokes an API, approves, decides, or bypasses the Director. These shapes
 * describe a candidate; they run nothing, hold no state, and mutate nothing. They build
 * only on the Phase 1 Runtime contracts and types, the Phase 2 assembly bundle, the Phase
 * 3 learning candidate shapes, and the Phase 4 optimization candidate shapes.
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

/**
 * The single candidate kind this phase produces. Fixed — Phase 5 forms awareness signals
 * only. It never forms an awareness assessment: performing awareness assessment is a
 * prohibited non-responsibility of this phase.
 */
export type AwarenessCandidateKind = "awareness-signal";

/**
 * A proposed awareness signal awaiting formation into a candidate: its identity, the
 * signal it states, the qualified learning candidates, qualified optimization candidates,
 * and eligible evidence it is grounded in, its bound provenance, explainability, and
 * confidence, and the prior candidate it supersedes (or null). A seed is untrusted
 * proposal material — it is never accepted directly; it becomes a candidate only by
 * passing validation, learning, optimization and evidence grounding, and preservation at
 * the boundary.
 */
export interface AwarenessCandidateSeed {
  readonly candidateId: RuntimeId;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly optimizationRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * One prepared, immutable Awareness Candidate: its identity, its fixed awareness-signal
 * kind, the signal it states, the supporting learning-candidate references, supporting
 * optimization-candidate references, and supporting evidence references it is grounded in,
 * and the preserved provenance, explainability, and confidence it must always carry —
 * plus the prior candidate it supersedes (or null), so history is preserved and never
 * rewritten. A candidate is attributable, uncertainty-preserving, reviewable, and
 * non-authoritative: never an assessment, a score, a recommendation, an alert, a priority,
 * a decision, an approval, or a command.
 */
export interface AwarenessCandidate {
  readonly candidateId: RuntimeId;
  readonly candidateKind: AwarenessCandidateKind;
  readonly statement: RuntimeStatement;
  readonly learningRefs: readonly RuntimeId[];
  readonly optimizationRefs: readonly RuntimeId[];
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * The declared request for one awareness pass: an identity, the assembled Runtime Context
 * (a Phase 2 bundle) it is bound to, the qualified Learning Candidate set (a Phase 3 set)
 * and qualified Optimization Candidate set (a Phase 4 set) its candidates may ground in,
 * the pool of eligible evidence they may ground in, and the proposed seeds to be formed
 * into candidates. A request is a declaration of intent and boundary — it identifies
 * nothing on its own.
 */
export interface AwarenessCandidateRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly evidence: readonly LearningEvidence[];
  readonly seeds: readonly AwarenessCandidateSeed[];
}

/**
 * The advisory deliverable of an awareness pass: the immutable Awareness Candidates it
 * prepared and the approval marker they carry — always pending a Director decision. A set
 * is attributable and non-authoritative; it terminates at the Director Approval boundary
 * and is never a Decision, an assessment, an alert, a priority order, or an execution
 * artifact.
 */
export interface AwarenessCandidateSet {
  readonly requestId: RuntimeId;
  readonly candidates: readonly AwarenessCandidate[];
  readonly approval: RuntimeApproval;
}

/**
 * A set that has passed through awareness normalization: candidates de-duplicated by
 * identity and canonically ordered, each candidate's learning, optimization, and evidence
 * references de-duplicated and totally ordered. Structurally an {@link AwarenessCandidateSet};
 * the alias marks that canonical form has been applied.
 */
export type CanonicalAwarenessCandidateSet = AwarenessCandidateSet;
