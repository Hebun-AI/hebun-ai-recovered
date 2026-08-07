/**
 * Heby Core — composition rules (Phase 9, Integration and Composition Closure).
 *
 * Pure, deterministic lookups and projections over the composition-phase table and the ordered
 * stage ledger that proves the composed pass. These answer plain questions — is this a known
 * phase, what stages did the composition run, in what order — and never decide, approve, resolve,
 * invent, or mutate anything. Only table reads and pure, repeatable projections. Ordinals order
 * the phases for the fixed boundary order only; they are never a rank, score, priority, or
 * recommendation.
 */

import {
  HEBY_COMPOSITION_PHASE_DESCRIPTORS,
  type HebyCompositionPhase,
  type HebyCompositionPhaseDescriptor,
  type HebyCompositionStage,
} from "@/features/heby-core/heby-composition-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyContextBinding } from "@/features/heby-core/heby-input-context-types";
import type { HebyPresentation } from "@/features/heby-core/heby-presentation-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";
import type { HebyRoutedIntent } from "@/features/heby-core/heby-intent-types";
import type { HebyPreparedApproval } from "@/features/heby-core/heby-approval-types";
import type { HebyGatedPresentation } from "@/features/heby-core/heby-governance-types";
import type { HebyDirectorBriefing } from "@/features/heby-core/heby-briefing-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared composition phase. Read-only table check. */
export function isHebyCompositionPhase(value: string): value is HebyCompositionPhase {
  return Object.prototype.hasOwnProperty.call(HEBY_COMPOSITION_PHASE_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a composition phase. Read-only projection. */
export function hebyCompositionPhaseDescriptorOf(phase: HebyCompositionPhase): HebyCompositionPhaseDescriptor {
  return HEBY_COMPOSITION_PHASE_DESCRIPTORS[phase];
}

/** The fixed canonical order of a composition phase. Ordinal only — not a rank. */
export function hebyCompositionPhaseOrder(phase: HebyCompositionPhase): number {
  return HEBY_COMPOSITION_PHASE_DESCRIPTORS[phase].order;
}

// --- Stage ledger ------------------------------------------------------------

/**
 * The ordered stage ledger over the composed pass: one entry per phase, each recording the
 * identity of the artifact that phase produced. Deterministic enumeration in fixed boundary order
 * — it records the path Heby composed, invents nothing, and confers no authority. This is the
 * replay proof that the full path ran from identity to Director briefing.
 */
export function hebyBuildStageLedger(
  identity: CanonicalHebyIdentity,
  binding: HebyContextBinding,
  presentation: HebyPresentation,
  grounded: HebyGroundedPresentation,
  routed: HebyRoutedIntent,
  prepared: HebyPreparedApproval,
  gated: HebyGatedPresentation,
  briefing: HebyDirectorBriefing,
): readonly HebyCompositionStage[] {
  return [
    { phase: "identity", artifactId: identity.identity },
    { phase: "context", artifactId: binding.context.contextId },
    { phase: "presentation", artifactId: presentation.presentationId },
    { phase: "grounding", artifactId: grounded.presentationId },
    { phase: "intent", artifactId: routed.intentId },
    { phase: "approval", artifactId: prepared.intentId },
    { phase: "governance", artifactId: gated.presentationId },
    { phase: "briefing", artifactId: briefing.presentationId },
  ];
}

// --- Complete canonical list -------------------------------------------------

/** Every declared composition phase, in canonical order. Deterministic. */
export function allHebyCompositionPhases(): readonly HebyCompositionPhase[] {
  return (Object.keys(HEBY_COMPOSITION_PHASE_DESCRIPTORS) as HebyCompositionPhase[]).sort(
    (left, right) => hebyCompositionPhaseOrder(left) - hebyCompositionPhaseOrder(right),
  );
}
