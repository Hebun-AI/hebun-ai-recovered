/**
 * Enterprise Organizational Intelligence Runtime — Governance and Director Briefing
 * ontology (Phase 8).
 *
 * Declares what a Director Briefing IS: the single, uniform, immutable package into which
 * the Runtime ORGANIZES its already-bound intelligence — the Phase 7 Bound Runtime Artifacts
 * and, read-only, the Phase 2 assembly bundle and the Phase 3–6 candidate sets that grounded
 * them — for Director consideration and Heby explanation. Phase 8 organizes; it does not
 * decide.
 *
 * A Director Briefing is NOT a decision, NOT a recommendation, NOT a ranking, NOT a priority,
 * NOT an approval, and NOT a rejection. It is a preserved, attributable, uncertainty-bearing
 * arrangement of existing bound artifacts, each still awaiting a Director decision. Phase 8
 * organizes, describes governance state, validates, normalizes, canonicalizes, and freezes;
 * it never generates a candidate, never reasons, never calculates or suppresses confidence or
 * uncertainty, never prioritizes, ranks, recommends, approves, rejects, decides, executes,
 * schedules, assigns work, triggers a workflow, calls AI or an LLM, persists, invokes an API,
 * modifies memory, reasoning, organization, or any candidate set, performs a governance
 * decision, or bypasses the Director. These shapes describe a briefing; they run nothing,
 * hold no state, and mutate nothing. They build only on the Phase 1 contracts and types, the
 * Phase 2 assembly bundle, the Phase 3–6 candidate set shapes, and the Phase 7 binding bundle.
 */

import type {
  RuntimeCandidateKind,
  RuntimeId,
  RuntimeLifecycleState,
  RuntimeRestrictionKind,
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
import type { CanonicalRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";

/**
 * One briefing item: the uniform, immutable projection of a single Phase 7 bound artifact
 * into the briefing. It carries the source binding identity, the source candidate's kind and
 * identity, its statement, its preserved provenance, explainability, and confidence, its
 * supporting evidence, learning, optimization, awareness, and evolution references, the
 * explicitly exposed lifecycle it already carries, and the approval marker it must always
 * carry — always pending a Director decision. Nothing here is computed; every field is
 * carried through from the source bound artifact UNCHANGED. The lifecycle field exposes,
 * never advances, {@link RuntimeProvenance.lifecycle}.
 */
export interface DirectorBriefingItem {
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
  readonly lifecycle: RuntimeLifecycleState;
  readonly approval: RuntimeApproval;
}

/**
 * The applicable Governance and Security constraints a briefing pass consumes, held
 * immutable. Consumed read-only: the Runtime never approves, waives, enforces, or rewrites
 * them. Carries the constraint identities and the declared restrictions that ride with the
 * pass; a declaration only — it enforces nothing.
 */
export interface DirectorBriefingGovernanceInput {
  readonly constraints: readonly RuntimeId[];
  readonly heldImmutable: true;
  readonly restrictions: readonly RuntimeRestrictionKind[];
}

/**
 * The descriptive governance view the briefing exposes. It VALIDATES and EXPOSES governance
 * state only: the immutable constraints, the declared restrictions, the single approval
 * state, and the binding identities of the briefing items that await a Director decision. It
 * performs no governance decision — it never approves, rejects, waives, or enforces.
 */
export interface DirectorBriefingGovernance {
  readonly constraints: readonly RuntimeId[];
  readonly heldImmutable: true;
  readonly restrictions: readonly RuntimeRestrictionKind[];
  readonly approval: RuntimeApproval;
  readonly pendingDirectorDecisions: readonly RuntimeId[];
}

/**
 * The declared request for one briefing pass: an identity, the assembled Runtime Context (a
 * Phase 2 bundle) the briefing is bound to, the four qualified, canonical candidate sets the
 * bound artifacts ground in, the Phase 7 canonical binding bundle the briefing organizes, and
 * the applicable Governance and Security constraints — all consumed read-only. A request is a
 * declaration of intent and boundary; it organizes nothing on its own.
 */
export interface DirectorBriefingRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly awarenessSet: CanonicalAwarenessCandidateSet;
  readonly evolutionSet: CanonicalEvolutionCandidateSet;
  readonly bindingBundle: CanonicalRuntimeBindingBundle;
  readonly governance: DirectorBriefingGovernanceInput;
}

/**
 * The advisory deliverable of a briefing pass: every bound artifact organized into one
 * immutable briefing item, the descriptive governance view over them, and the approval
 * marker they carry — always pending a Director decision. A briefing is attributable and
 * non-authoritative; it terminates at the Director Approval boundary and is the settled input
 * the Director Workspace and the Heby Explanation Runtime consume. It is never a Decision, a
 * ranking, a priority, a recommendation, an approval, a rejection, or an execution artifact.
 */
export interface DirectorBriefing {
  readonly requestId: RuntimeId;
  readonly items: readonly DirectorBriefingItem[];
  readonly governance: DirectorBriefingGovernance;
  readonly approval: RuntimeApproval;
}

/**
 * A briefing that has passed through briefing normalization: items de-duplicated by binding
 * identity and canonically ordered, each item's reference lists de-duplicated and totally
 * ordered, the governance view's constraint, restriction, and pending-decision lists
 * de-duplicated and ordered. Structurally a {@link DirectorBriefing}; the alias marks that
 * canonical form has been applied.
 */
export type CanonicalDirectorBriefing = DirectorBriefing;
