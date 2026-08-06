/**
 * Enterprise Organizational Intelligence — organization evolution rules (Phase 6).
 *
 * Pure, deterministic lookups over the canonical evolution descriptors, a total ordering
 * over lifecycle states, and pure projections of a basis and pathway. These answer plain
 * questions — what order is this constraint kind or lifecycle state, is it terminal, what
 * does this basis rest on, does a pathway preserve continuity. NO evolution assessment, NO
 * prediction, NO forecasting, NO simulation, NO pathway generation, NO inference; table
 * reads and pure projections only. The "order" is an ordinal for total ordering, never a
 * threshold or progression trigger.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import type { OptimizationOpportunityId } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import type { StrategicAssessmentId } from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
import type {
  EvolutionBasis,
  EvolutionConstraintKind,
  EvolutionConstraintKindDescriptor,
  EvolutionLifecycleState,
  EvolutionLifecycleStateDescriptor,
  EvolutionPathway,
} from "@/features/enterprise-organizational-intelligence/organization-evolution-types";
import {
  EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS,
  EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence/organization-evolution-types";

export function evolutionConstraintKindDescriptorOf(kind: EvolutionConstraintKind): EvolutionConstraintKindDescriptor {
  return EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS[kind];
}

/** The ordinal order of a constraint kind — for total ordering only. */
export function evolutionConstraintKindOrderOf(kind: EvolutionConstraintKind): number {
  return EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS[kind].order;
}

export function evolutionLifecycleStateDescriptorOf(state: EvolutionLifecycleState): EvolutionLifecycleStateDescriptor {
  return EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS[state];
}

/** The ordinal order of a lifecycle state — for total ordering only, never a trigger. */
export function evolutionLifecycleOrderOf(state: EvolutionLifecycleState): number {
  return EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS[state].order;
}

/** True when the state ends the output's active lifecycle (history preserved). */
export function evolutionLifecycleIsTerminal(state: EvolutionLifecycleState): boolean {
  return EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS[state].isTerminal;
}

/** A deterministic total order over lifecycle states by ordinal. */
export function compareEvolutionLifecycle(left: EvolutionLifecycleState, right: EvolutionLifecycleState): number {
  return evolutionLifecycleOrderOf(left) - evolutionLifecycleOrderOf(right);
}

/** The read-only Phase 44 learnings a basis rests on, in declared order. */
export function evolutionBasisLearningsOf(basis: EvolutionBasis): readonly OrganizationLearningId[] {
  return basis.learnings;
}

/** The read-only Phase 45 optimization opportunities a basis rests on, in declared order. */
export function evolutionBasisOpportunitiesOf(basis: EvolutionBasis): readonly OptimizationOpportunityId[] {
  return basis.opportunities;
}

/** The read-only Phase 46 awareness assessments a basis rests on, in declared order. */
export function evolutionBasisAssessmentsOf(basis: EvolutionBasis): readonly StrategicAssessmentId[] {
  return basis.assessments;
}

/** The read-only memory evidence a basis rests on, in declared order. */
export function evolutionBasisEvidenceOf(basis: EvolutionBasis): readonly EvidenceReference[] {
  return basis.evidence;
}

/** True when the basis rests on at least one learning, opportunity, assessment, or evidence. */
export function evolutionBasisReachesSource(basis: EvolutionBasis): boolean {
  return (
    basis.learnings.length > 0 ||
    basis.opportunities.length > 0 ||
    basis.assessments.length > 0 ||
    basis.evidence.length > 0
  );
}

/** True when the pathway preserves constitutional continuity, as required of every pathway. */
export function evolutionPathwayPreservesContinuity(pathway: EvolutionPathway): boolean {
  return pathway.continuity.preserved;
}
