/**
 * Heby Core — approval rules (Phase 6, Approval Preparation and Director Boundary).
 *
 * Pure, deterministic lookups and projections over the preparation-kind table, the
 * decision-state table, and the grounded routing a prepared item may concern. These answer
 * plain questions — is this a known kind, is this kind distinct from advice, must it state
 * consequences, is this decision state admissible, do these subjects stay within the intent's
 * grounded routing — and never call a model, trust model output, reason, decide, approve, or
 * mutate anything. Only table reads and pure, repeatable projections. Ordinals order kinds and
 * states for stable arrangement only; they are never a rank, score, priority, or recommendation.
 */

import {
  HEBY_DECISION_STATE_DESCRIPTORS,
  HEBY_PREPARATION_KIND_DESCRIPTORS,
  type HebyDecisionState,
  type HebyDecisionStateDescriptor,
  type HebyPreparationKind,
  type HebyPreparationKindDescriptor,
} from "@/features/heby-core/heby-approval-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared preparation kind. Read-only table check. */
export function isHebyPreparationKind(value: string): value is HebyPreparationKind {
  return Object.prototype.hasOwnProperty.call(HEBY_PREPARATION_KIND_DESCRIPTORS, value);
}

/** True when a string is a declared decision state. Read-only table check. */
export function isHebyDecisionState(value: string): value is HebyDecisionState {
  return Object.prototype.hasOwnProperty.call(HEBY_DECISION_STATE_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a preparation kind. Read-only projection. */
export function hebyPreparationKindDescriptorOf(kind: HebyPreparationKind): HebyPreparationKindDescriptor {
  return HEBY_PREPARATION_KIND_DESCRIPTORS[kind];
}

/** The fixed canonical order of a preparation kind. Ordinal only — not a rank. */
export function hebyPreparationKindOrder(kind: HebyPreparationKind): number {
  return HEBY_PREPARATION_KIND_DESCRIPTORS[kind].order;
}

/** The canonical descriptor for a decision state. Read-only projection. */
export function hebyDecisionStateDescriptorOf(state: HebyDecisionState): HebyDecisionStateDescriptor {
  return HEBY_DECISION_STATE_DESCRIPTORS[state];
}

/** The fixed canonical order of a decision state. Ordinal only — not a rank. */
export function hebyDecisionStateOrder(state: HebyDecisionState): number {
  return HEBY_DECISION_STATE_DESCRIPTORS[state].order;
}

// --- Kind projections --------------------------------------------------------

/** True when a preparation kind is visibly distinct from plain advice (review and approval). */
export function hebyKindDistinctFromAdvice(kind: HebyPreparationKind): boolean {
  return HEBY_PREPARATION_KIND_DESCRIPTORS[kind].distinctFromAdvice;
}

/** True when a preparation kind must state consequences before a human confirmation. */
export function hebyKindRequiresConsequences(kind: HebyPreparationKind): boolean {
  return HEBY_PREPARATION_KIND_DESCRIPTORS[kind].requiresConsequences;
}

// --- Decision-state boundary -------------------------------------------------

/**
 * True when a decision state is one Heby may produce — only "pending" is admissible. A
 * "resolved" (completed-decision) state is never admissible: Heby prepares, it never decides.
 */
export function isHebyDecisionStateAdmissible(state: HebyDecisionState): boolean {
  return HEBY_DECISION_STATE_DESCRIPTORS[state].admissible;
}

// --- Grounded routing containment --------------------------------------------

/**
 * True when every subject reference stays within the intent's grounded routing — a prepared
 * item may concern only the grounded elements the interpreted intent already routed to.
 * Fail-closed: an empty subject set, or any subject outside the routing, is not contained.
 */
export function hebySubjectsWithinRouting(
  subjectRefs: readonly HebyId[],
  routedElementRefs: readonly HebyId[],
): boolean {
  if (subjectRefs.length === 0) return false;
  const routed = new Set<HebyId>(routedElementRefs);
  for (const ref of subjectRefs) {
    if (!routed.has(ref)) return false;
  }
  return true;
}

// --- Complete canonical lists ------------------------------------------------

/** Every declared preparation kind, in canonical order. Deterministic. */
export function allHebyPreparationKinds(): readonly HebyPreparationKind[] {
  return (Object.keys(HEBY_PREPARATION_KIND_DESCRIPTORS) as HebyPreparationKind[]).sort(
    (left, right) => hebyPreparationKindOrder(left) - hebyPreparationKindOrder(right),
  );
}

/** Every declared decision state, in canonical order. Deterministic. */
export function allHebyDecisionStates(): readonly HebyDecisionState[] {
  return (Object.keys(HEBY_DECISION_STATE_DESCRIPTORS) as HebyDecisionState[]).sort(
    (left, right) => hebyDecisionStateOrder(left) - hebyDecisionStateOrder(right),
  );
}
