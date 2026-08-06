/**
 * Enterprise Organizational Intelligence Runtime — Learning Candidate ontology (Phase 3).
 *
 * Declares what a Learning Candidate IS: the shapes through which the Runtime, over an
 * already-assembled Runtime Context (a Phase 2 bundle) and a pool of eligible governed
 * evidence, identifies and preserves attributable Learning Candidates — each carrying
 * its evidence grounding, provenance, explainability, confidence, and uncertainty,
 * immutable and awaiting Director review.
 *
 * A Learning Candidate is NOT accepted knowledge, NOT memory, NOT a fact, NOT a
 * decision, and NOT an action. It is a non-authoritative proposal a human considers.
 * Phase 3 identifies and preserves; it never admits knowledge, creates facts, decides,
 * approves, executes, calls AI or an LLM, orchestrates, plans work, modifies memory or
 * organization state, or bypasses the Director. These shapes describe a candidate; they
 * run nothing, hold no state, and mutate nothing. They build only on the Phase 1
 * Runtime contracts and types and the Phase 2 assembly bundle.
 */

import type {
  RuntimeId,
  RuntimeStatement,
  RuntimeTimestamp,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  RuntimeApproval,
  RuntimeConfidence,
  RuntimeExplainability,
  RuntimeProvenance,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type { CanonicalRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";

/** The single candidate kind this phase produces. Fixed — Phase 3 forms learning only. */
export type LearningCandidateKind = "learning";

/**
 * One eligible, governed evidence item admitted read-only into a learning pass: its
 * identity, its source, what it states, its effective period, and whether governance
 * has marked it eligible. The Runtime consumes evidence read-only; it reads nothing
 * back, creates no fact, and admits nothing to memory.
 */
export interface LearningEvidence {
  readonly evidenceId: RuntimeId;
  readonly source: RuntimeStatement;
  readonly statement: RuntimeStatement;
  readonly effectivePeriod: RuntimeTimestamp;
  readonly eligible: boolean;
}

/**
 * A proposed learning awaiting formation into a candidate: its identity, the learning
 * it states, the evidence it is grounded in, its bound provenance, explainability, and
 * confidence, and the prior candidate it supersedes (or null). A seed is untrusted
 * proposal material — it is never accepted directly; it becomes a candidate only by
 * passing validation, evidence grounding, and preservation at the boundary.
 */
export interface LearningCandidateSeed {
  readonly candidateId: RuntimeId;
  readonly statement: RuntimeStatement;
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * One prepared, immutable Learning Candidate: its identity, its fixed learning kind,
 * the learning it states, the eligible evidence it is grounded in, and the preserved
 * provenance, explainability, and confidence it must always carry — plus the prior
 * candidate it supersedes (or null), so history is preserved and never rewritten. A
 * candidate is attributable, uncertainty-preserving, reviewable, and non-authoritative:
 * never knowledge, memory, a fact, a decision, an approval, or a command.
 */
export interface LearningCandidate {
  readonly candidateId: RuntimeId;
  readonly candidateKind: LearningCandidateKind;
  readonly statement: RuntimeStatement;
  readonly evidenceRefs: readonly RuntimeId[];
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
  readonly supersedes: RuntimeId | null;
}

/**
 * The declared request for one learning pass: an identity, the assembled Runtime
 * Context (a Phase 2 bundle) the learning is bound to, the pool of eligible evidence it
 * may ground in, and the proposed seeds to be formed into candidates. A request is a
 * declaration of intent and boundary — it identifies nothing on its own.
 */
export interface LearningCandidateRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly evidence: readonly LearningEvidence[];
  readonly seeds: readonly LearningCandidateSeed[];
}

/**
 * The advisory deliverable of a learning pass: the immutable Learning Candidates it
 * prepared and the approval marker they carry — always pending a Director decision. A
 * set is attributable and non-authoritative; it terminates at the Director Approval
 * boundary and is never a Decision, admission to memory, or execution artifact.
 */
export interface LearningCandidateSet {
  readonly requestId: RuntimeId;
  readonly candidates: readonly LearningCandidate[];
  readonly approval: RuntimeApproval;
}

/**
 * A set that has passed through learning normalization: candidates de-duplicated by
 * identity and canonically ordered, each candidate's evidence references de-duplicated
 * and totally ordered. Structurally a {@link LearningCandidateSet}; the alias marks
 * that canonical form has been applied.
 */
export type CanonicalLearningCandidateSet = LearningCandidateSet;
