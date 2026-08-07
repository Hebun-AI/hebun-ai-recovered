/**
 * Enterprise Organizational Intelligence Runtime — Runtime Composition ontology (Phase 9).
 *
 * Declares what a Runtime Composition IS: the single, uniform, immutable package into which
 * the Runtime CLOSES its own directional pass — the Phase 2 assembled Runtime Context, the
 * Phase 3–6 candidate sets, the Phase 7 binding bundle, and the Phase 8 Director Briefing —
 * composed into one settled, attributable, end-to-end result for downstream consumers. Phase 9
 * composes; it introduces no intelligence.
 *
 * A Runtime Composition is NOT new intelligence, NOT a new candidate, NOT reasoning, NOT a
 * decision, NOT an approval, and NOT an execution artifact. It is a preserved, attributable,
 * cross-phase-verified arrangement of already-settled Phase 1–8 outputs, still awaiting a
 * Director decision. Phase 9 composes, validates cross-phase integrity, normalizes,
 * canonicalizes, and freezes; it never generates learning, optimization, awareness, or
 * evolution, never reasons, never infers facts, never calculates confidence, never recommends,
 * ranks, prioritizes, approves, rejects, decides, executes, plans, schedules, orchestrates
 * external work, calls AI or an LLM, invokes an API, persists, mutates memory, reasoning,
 * organizational intelligence, any candidate set, any binding, or the Director Briefing, and
 * never bypasses the Director. These shapes describe a composition; they run nothing, hold no
 * state, and mutate nothing. They build only on the Phase 1 contracts and types, the Phase 2
 * assembly bundle, the Phase 3–6 candidate set shapes, the Phase 7 binding bundle, and the
 * Phase 8 Director Briefing.
 */

import type {
  RuntimeId,
  RuntimeLifecycleState,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type { CanonicalRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import type { CanonicalLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import type { CanonicalOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import type { CanonicalAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import type { CanonicalEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";
import type { CanonicalRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
import type {
  CanonicalDirectorBriefing,
  DirectorBriefingGovernance,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";

/**
 * The integrity status a composition may carry. The Runtime can only ever represent a
 * cross-phase-verified, closed composition: composition is fail-closed, so a composition that
 * does not pass every cross-phase check is never produced. This is why the set has exactly one
 * member and no "partial", "degraded", or "unverified" state exists here.
 */
export type RuntimeCompositionIntegrity = "verified";

/**
 * A deterministic per-phase tally of the composed Runtime. Counted, never judged: no count is
 * a score, a ranking, a priority, or a threshold. It records how many artifacts each phase
 * contributed so a downstream consumer can see the shape of the closed Runtime at a glance.
 */
export interface RuntimeCompositionSummary {
  readonly learningCount: number;
  readonly optimizationCount: number;
  readonly awarenessCount: number;
  readonly evolutionCount: number;
  readonly candidateTotal: number;
  readonly boundArtifactCount: number;
  readonly briefingItemCount: number;
  readonly pendingDirectorDecisionCount: number;
}

/**
 * The declared request for one composition pass: an identity and the seven settled Phase 1–8
 * outputs it closes — the assembled Runtime Context bundle, the four qualified candidate sets,
 * the binding bundle, and the Director Briefing — all consumed read-only. A request is a
 * declaration of intent and boundary; it composes nothing on its own.
 */
export interface RuntimeCompositionRequest {
  readonly requestId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly awarenessSet: CanonicalAwarenessCandidateSet;
  readonly evolutionSet: CanonicalEvolutionCandidateSet;
  readonly bindingBundle: CanonicalRuntimeBindingBundle;
  readonly briefing: CanonicalDirectorBriefing;
}

/**
 * The closed Runtime state: one immutable composition of every settled Phase 1–8 output, its
 * derived composition identity, the descriptive governance view carried from the briefing, the
 * approval marker it must always carry — always pending a Director decision — the shared
 * lifecycle its intelligence rests in, the deterministic per-phase summary, and the verified
 * integrity status. Every carried sub-output is preserved UNCHANGED; nothing is computed but
 * the identity, the summary tally, and the integrity marker. A composition is attributable and
 * non-authoritative; it terminates at the Director Approval boundary and is the settled input a
 * downstream consumer reads. It is never a Decision, a recommendation, a ranking, an approval,
 * a rejection, or an execution artifact.
 */
export interface RuntimeComposition {
  readonly compositionId: RuntimeId;
  readonly bundle: CanonicalRuntimeBundle;
  readonly learningSet: CanonicalLearningCandidateSet;
  readonly optimizationSet: CanonicalOptimizationCandidateSet;
  readonly awarenessSet: CanonicalAwarenessCandidateSet;
  readonly evolutionSet: CanonicalEvolutionCandidateSet;
  readonly bindingBundle: CanonicalRuntimeBindingBundle;
  readonly briefing: CanonicalDirectorBriefing;
  readonly governance: DirectorBriefingGovernance;
  readonly approval: RuntimeApproval;
  readonly lifecycle: RuntimeLifecycleState;
  readonly summary: RuntimeCompositionSummary;
  readonly integrity: RuntimeCompositionIntegrity;
}

/**
 * A composition that has passed through composition normalization: its summary frozen and the
 * whole composition emitted immutable and frozen over its already-canonical sub-outputs.
 * Structurally a {@link RuntimeComposition}; the alias marks that canonical form has been
 * applied.
 */
export type CanonicalRuntimeComposition = RuntimeComposition;
