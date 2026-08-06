/**
 * Enterprise Organizational Intelligence — organization awareness rules (Phase 5).
 *
 * Pure, deterministic lookups over the canonical awareness descriptors, a total
 * ordering over lifecycle states, and pure projections of an awareness basis. These
 * answer plain questions — what order is this dimension or lifecycle state, is it
 * terminal, what does this basis rest on, does it reach a source. NO awareness
 * detection, NO assessment, NO scoring, NO self-evaluation, NO inference; table reads
 * and pure projections only. The "order" is an ordinal for total ordering, never an
 * index, threshold, or progression trigger.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import type { OptimizationOpportunityId } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import type {
  AwarenessBasis,
  AwarenessLifecycleState,
  AwarenessLifecycleStateDescriptor,
  StrategicDimension,
  StrategicDimensionDescriptor,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
import {
  AWARENESS_LIFECYCLE_STATE_DESCRIPTORS,
  STRATEGIC_DIMENSION_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";

export function strategicDimensionDescriptorOf(dimension: StrategicDimension): StrategicDimensionDescriptor {
  return STRATEGIC_DIMENSION_DESCRIPTORS[dimension];
}

/** The ordinal order of a strategic dimension — for total ordering only. */
export function strategicDimensionOrderOf(dimension: StrategicDimension): number {
  return STRATEGIC_DIMENSION_DESCRIPTORS[dimension].order;
}

export function awarenessLifecycleStateDescriptorOf(
  state: AwarenessLifecycleState,
): AwarenessLifecycleStateDescriptor {
  return AWARENESS_LIFECYCLE_STATE_DESCRIPTORS[state];
}

/** The ordinal order of a lifecycle state — for total ordering only, never a trigger. */
export function awarenessLifecycleOrderOf(state: AwarenessLifecycleState): number {
  return AWARENESS_LIFECYCLE_STATE_DESCRIPTORS[state].order;
}

/** True when the state ends the output's active lifecycle (history preserved). */
export function awarenessLifecycleIsTerminal(state: AwarenessLifecycleState): boolean {
  return AWARENESS_LIFECYCLE_STATE_DESCRIPTORS[state].isTerminal;
}

/** A deterministic total order over lifecycle states by ordinal. */
export function compareAwarenessLifecycle(left: AwarenessLifecycleState, right: AwarenessLifecycleState): number {
  return awarenessLifecycleOrderOf(left) - awarenessLifecycleOrderOf(right);
}

/** The read-only Phase 44 learnings a basis rests on, in declared order. */
export function awarenessBasisLearningsOf(basis: AwarenessBasis): readonly OrganizationLearningId[] {
  return basis.learnings;
}

/** The read-only Phase 45 optimization opportunities a basis rests on, in declared order. */
export function awarenessBasisOpportunitiesOf(basis: AwarenessBasis): readonly OptimizationOpportunityId[] {
  return basis.opportunities;
}

/** The read-only memory evidence a basis rests on, in declared order. */
export function awarenessBasisEvidenceOf(basis: AwarenessBasis): readonly EvidenceReference[] {
  return basis.evidence;
}

/** True when the basis rests on at least one learning, opportunity, or memory evidence. */
export function awarenessBasisReachesSource(basis: AwarenessBasis): boolean {
  return basis.learnings.length > 0 || basis.opportunities.length > 0 || basis.evidence.length > 0;
}
