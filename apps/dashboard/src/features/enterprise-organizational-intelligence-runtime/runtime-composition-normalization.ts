/**
 * Enterprise Organizational Intelligence Runtime — Runtime Composition normalization (Phase 9).
 *
 * Deterministically canonicalizes a Runtime Composition: its already-canonical Phase 2–8
 * sub-outputs are carried through UNCHANGED — each phase imposed its own canonical order and
 * froze its own result — and the composition wrapper and its summary are emitted immutable and
 * frozen. The canonical key is composed from every sub-output's own canonical key plus the
 * composition's identity, approval, lifecycle, integrity, and summary, so the key is a total,
 * unambiguous, text-safe, UTF-8-stable, NUL-safe fingerprint of the whole closed Runtime.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO reasoning, NO confidence
 * calculation, NO ranking, NO re-ordering of any preserved sub-output, NO mutation of any
 * preserved value. Determinism is inherited from the canonical sub-outputs; identical settled
 * inputs always produce an identical canonical composition and an identical key.
 */

import { canonicalRuntimeBundleKey } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-normalization";
import { canonicalLearningCandidateSetKey } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-normalization";
import { canonicalOptimizationCandidateSetKey } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-normalization";
import { canonicalAwarenessCandidateSetKey } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-normalization";
import { canonicalEvolutionCandidateSetKey } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-normalization";
import { canonicalRuntimeBindingBundleKey } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-normalization";
import { canonicalDirectorBriefingKey } from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-normalization";
import type {
  CanonicalRuntimeComposition,
  RuntimeComposition,
  RuntimeCompositionSummary,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";

/** A canonical, text-safe key for the summary tally. */
function summaryKey(summary: RuntimeCompositionSummary): readonly number[] {
  return [
    summary.learningCount,
    summary.optimizationCount,
    summary.awarenessCount,
    summary.evolutionCount,
    summary.candidateTotal,
    summary.boundArtifactCount,
    summary.briefingItemCount,
    summary.pendingDirectorDecisionCount,
  ];
}

/**
 * A canonical key for a whole composition: its identity, approval, lifecycle, integrity, and
 * summary, followed by the canonical key of every settled sub-output in phase order. Two
 * compositions with the same closed Runtime state always produce the same key.
 */
export function runtimeCompositionKey(composition: CanonicalRuntimeComposition): string {
  return JSON.stringify([
    composition.compositionId,
    composition.approval.state,
    composition.lifecycle,
    composition.integrity,
    composition.governance.constraints,
    composition.governance.restrictions,
    composition.governance.pendingDirectorDecisions,
    summaryKey(composition.summary),
    canonicalRuntimeBundleKey(composition.bundle),
    canonicalLearningCandidateSetKey(composition.learningSet),
    canonicalOptimizationCandidateSetKey(composition.optimizationSet),
    canonicalAwarenessCandidateSetKey(composition.awarenessSet),
    canonicalEvolutionCandidateSetKey(composition.evolutionSet),
    canonicalRuntimeBindingBundleKey(composition.bindingBundle),
    canonicalDirectorBriefingKey(composition.briefing),
  ]);
}

/**
 * Canonicalizes a Runtime Composition into an immutable, frozen form. Deterministic: the same
 * input always produces the same canonical composition. The summary is frozen and the whole
 * composition is frozen; every already-canonical sub-output is carried through unchanged.
 */
export function normalizeRuntimeComposition(
  composition: RuntimeComposition,
): CanonicalRuntimeComposition {
  return Object.freeze({
    compositionId: composition.compositionId,
    bundle: composition.bundle,
    learningSet: composition.learningSet,
    optimizationSet: composition.optimizationSet,
    awarenessSet: composition.awarenessSet,
    evolutionSet: composition.evolutionSet,
    bindingBundle: composition.bindingBundle,
    briefing: composition.briefing,
    governance: composition.governance,
    approval: composition.approval,
    lifecycle: composition.lifecycle,
    summary: Object.freeze(composition.summary),
    integrity: composition.integrity,
  });
}
