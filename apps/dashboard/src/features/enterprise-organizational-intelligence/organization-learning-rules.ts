/**
 * Enterprise Organizational Intelligence — organization learning rules (Phase 3).
 *
 * Pure, deterministic lookups over the canonical learning descriptors, a total
 * ordering over lifecycle states, and pure projections of a learning. These answer
 * plain questions — what order is this lifecycle state, is it terminal, is this
 * relationship symmetric, does this learning reach a memory basis. NO learning
 * identification, NO generation, NO inference, NO computation; table reads and pure
 * projections only. Lifecycle "order" is an ordinal for total ordering, not a
 * progression trigger.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type {
  LearningLifecycleState,
  LearningLifecycleStateDescriptor,
  LearningRelationshipKind,
  LearningRelationshipKindDescriptor,
  OrganizationLearning,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import {
  LEARNING_LIFECYCLE_STATE_DESCRIPTORS,
  LEARNING_RELATIONSHIP_KIND_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";

export function learningLifecycleStateDescriptorOf(state: LearningLifecycleState): LearningLifecycleStateDescriptor {
  return LEARNING_LIFECYCLE_STATE_DESCRIPTORS[state];
}

/** The ordinal order of a lifecycle state — for total ordering only, never a trigger. */
export function learningLifecycleOrderOf(state: LearningLifecycleState): number {
  return LEARNING_LIFECYCLE_STATE_DESCRIPTORS[state].order;
}

/** True when the state ends the learning's active lifecycle (history preserved). */
export function learningLifecycleIsTerminal(state: LearningLifecycleState): boolean {
  return LEARNING_LIFECYCLE_STATE_DESCRIPTORS[state].isTerminal;
}

/** A deterministic total order over lifecycle states by ordinal. */
export function compareLearningLifecycle(left: LearningLifecycleState, right: LearningLifecycleState): number {
  return learningLifecycleOrderOf(left) - learningLifecycleOrderOf(right);
}

export function learningRelationshipKindDescriptorOf(kind: LearningRelationshipKind): LearningRelationshipKindDescriptor {
  return LEARNING_RELATIONSHIP_KIND_DESCRIPTORS[kind];
}

/** True when the relationship holds equally in both directions (contradiction). */
export function learningRelationshipIsSymmetric(kind: LearningRelationshipKind): boolean {
  return LEARNING_RELATIONSHIP_KIND_DESCRIPTORS[kind].isSymmetric;
}

/** The read-only memory evidence a learning derives from, in declared order. */
export function learningBasisEvidenceOf(learning: OrganizationLearning): readonly EvidenceReference[] {
  return learning.basis.evidence;
}

/** True when the learning rests on at least one piece of memory evidence. */
export function learningReachesEvidenceRoot(learning: OrganizationLearning): boolean {
  return learning.basis.evidence.length > 0;
}
