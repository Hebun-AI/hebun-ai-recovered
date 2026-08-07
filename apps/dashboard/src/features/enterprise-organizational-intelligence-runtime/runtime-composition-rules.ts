/**
 * Enterprise Organizational Intelligence Runtime — Runtime Composition rules (Phase 9).
 *
 * Pure, deterministic derivations over already-settled Phase 1–8 outputs: the composition
 * identity, the expected binding identity of every candidate, the per-phase summary tally, and
 * the shared lifecycle of the composed intelligence. These read and count; they carry every
 * settled sub-output through UNCHANGED. NO runtime behaviour, NO candidate creation, NO fact
 * inference, NO reasoning, NO confidence calculation, NO recommendation, NO ranking, NO
 * prioritization, NO AI, NO orchestration — only total, repeatable projections.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { bindingIdentity } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-rules";
import type { RuntimeCompositionRequest } from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";
import type { RuntimeCompositionSummary } from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";

/** The approval marker every composition carries: always pending a Director decision. */
export const PENDING_DIRECTOR_APPROVAL = Object.freeze({ state: "pending-director" } as const);

/**
 * The deterministic composition identity: the assembled Runtime Context bundle identity and
 * the Director Briefing request identity joined by a fixed, unambiguous separator. Total and
 * repeatable — the same closed Runtime always yields the same identity. This derives an
 * identity; it generates nothing random and mints no UUID.
 */
export function compositionIdentity(bundleId: RuntimeId, briefingRequestId: RuntimeId): RuntimeId {
  return `${bundleId}::${briefingRequestId}`;
}

/**
 * The expected binding identity of every candidate across the four qualified sets, in the
 * fixed kind order learning → optimization → awareness → evolution, preserving each set's own
 * candidate order. Each identity is derived exactly as Phase 7 derives it, so a candidate and
 * its bound artifact share one identity. Deterministic; it fabricates nothing.
 */
export function candidateBindingIds(request: RuntimeCompositionRequest): readonly RuntimeId[] {
  return [
    ...request.learningSet.candidates.map((candidate) =>
      bindingIdentity(candidate.candidateKind, candidate.candidateId),
    ),
    ...request.optimizationSet.candidates.map((candidate) =>
      bindingIdentity(candidate.candidateKind, candidate.candidateId),
    ),
    ...request.awarenessSet.candidates.map((candidate) =>
      bindingIdentity(candidate.candidateKind, candidate.candidateId),
    ),
    ...request.evolutionSet.candidates.map((candidate) =>
      bindingIdentity(candidate.candidateKind, candidate.candidateId),
    ),
  ];
}

/**
 * The deterministic per-phase summary of a composition request: one count per candidate phase,
 * the candidate total, the bound-artifact count, the briefing-item count, and the count of
 * pending Director decisions the briefing exposes. Counted, never judged — no count is a score,
 * a ranking, or a threshold. Frozen.
 */
export function summarize(request: RuntimeCompositionRequest): RuntimeCompositionSummary {
  const learningCount = request.learningSet.candidates.length;
  const optimizationCount = request.optimizationSet.candidates.length;
  const awarenessCount = request.awarenessSet.candidates.length;
  const evolutionCount = request.evolutionSet.candidates.length;
  return Object.freeze({
    learningCount,
    optimizationCount,
    awarenessCount,
    evolutionCount,
    candidateTotal: learningCount + optimizationCount + awarenessCount + evolutionCount,
    boundArtifactCount: request.bindingBundle.artifacts.length,
    briefingItemCount: request.briefing.items.length,
    pendingDirectorDecisionCount: request.briefing.governance.pendingDirectorDecisions.length,
  });
}
