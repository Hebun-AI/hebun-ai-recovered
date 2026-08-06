/**
 * Enterprise Organizational Intelligence — organization optimization rules (Phase 4).
 *
 * Pure, deterministic lookups over the canonical optimization descriptors, a total
 * ordering over lifecycle states, and pure projections of an artifact's basis. These
 * answer plain questions — what order is this lifecycle state, is it terminal, what
 * does this basis rest on, does it reach a source. NO optimization analysis, NO
 * scoring, NO ranking computation, NO recommendation, NO inference; table reads and
 * pure projections only. The lifecycle "order" is an ordinal for total ordering, not a
 * progression trigger, and a priority rank is always a declared ordinal, never derived.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import type {
  OptimizationBasis,
  OptimizationLifecycleState,
  OptimizationLifecycleStateDescriptor,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import { OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";

export function optimizationLifecycleStateDescriptorOf(
  state: OptimizationLifecycleState,
): OptimizationLifecycleStateDescriptor {
  return OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS[state];
}

/** The ordinal order of a lifecycle state — for total ordering only, never a trigger. */
export function optimizationLifecycleOrderOf(state: OptimizationLifecycleState): number {
  return OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS[state].order;
}

/** True when the state ends the output's active lifecycle (history preserved). */
export function optimizationLifecycleIsTerminal(state: OptimizationLifecycleState): boolean {
  return OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS[state].isTerminal;
}

/** A deterministic total order over lifecycle states by ordinal. */
export function compareOptimizationLifecycle(
  left: OptimizationLifecycleState,
  right: OptimizationLifecycleState,
): number {
  return optimizationLifecycleOrderOf(left) - optimizationLifecycleOrderOf(right);
}

/** The read-only Phase 44 learnings a basis rests on, in declared order. */
export function optimizationBasisLearningsOf(basis: OptimizationBasis): readonly OrganizationLearningId[] {
  return basis.learnings;
}

/** The read-only memory evidence a basis rests on, in declared order. */
export function optimizationBasisEvidenceOf(basis: OptimizationBasis): readonly EvidenceReference[] {
  return basis.evidence;
}

/** True when the basis rests on at least one learning or one piece of memory evidence. */
export function optimizationBasisReachesSource(basis: OptimizationBasis): boolean {
  return basis.learnings.length > 0 || basis.evidence.length > 0;
}
