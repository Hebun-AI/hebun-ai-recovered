/**
 * Enterprise Organizational Intelligence Runtime — rules (Phase 1).
 *
 * Pure, deterministic lookups over the canonical Runtime descriptors, and
 * deterministic projections of a request into its dependencies, a tagged artifact
 * enumeration, and a per-kind candidate summary. These answer plain questions — what
 * order is this stage, is this dependency required, is this failure fail-closed, which
 * required dependencies does a request declare. NO runtime behaviour, NO orchestration,
 * NO generation, NO computation of anything beyond table reads and pure projections.
 */

import {
  RUNTIME_APPROVAL_STATE_DESCRIPTORS,
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_FAILURE_KIND_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
  RUNTIME_RESTRICTION_DESCRIPTORS,
  RUNTIME_STAGE_DESCRIPTORS,
  RUNTIME_STATUS_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  RuntimeApprovalState,
  RuntimeApprovalStateDescriptor,
  RuntimeCandidateKind,
  RuntimeCandidateKindDescriptor,
  RuntimeConfidenceLevel,
  RuntimeConfidenceLevelDescriptor,
  RuntimeDependencyKind,
  RuntimeDependencyKindDescriptor,
  RuntimeFailureKind,
  RuntimeFailureKindDescriptor,
  RuntimeLifecycleState,
  RuntimeLifecycleStateDescriptor,
  RuntimeRestrictionDescriptor,
  RuntimeRestrictionKind,
  RuntimeStageDescriptor,
  RuntimeStageKind,
  RuntimeStatus,
  RuntimeStatusDescriptor,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  RuntimeArtifact,
  RuntimeCandidate,
  RuntimeDependency,
  RuntimeRequest,
  RuntimeSummary,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";

// --- Stage lookups -----------------------------------------------------------

export function runtimeStageDescriptorOf(kind: RuntimeStageKind): RuntimeStageDescriptor {
  return RUNTIME_STAGE_DESCRIPTORS[kind];
}

export function runtimeStageOrderOf(kind: RuntimeStageKind): number {
  return RUNTIME_STAGE_DESCRIPTORS[kind].order;
}

// --- Lifecycle lookups -------------------------------------------------------

export function runtimeLifecycleStateDescriptorOf(
  state: RuntimeLifecycleState,
): RuntimeLifecycleStateDescriptor {
  return RUNTIME_LIFECYCLE_STATE_DESCRIPTORS[state];
}

export function runtimeLifecycleOrderOf(state: RuntimeLifecycleState): number {
  return RUNTIME_LIFECYCLE_STATE_DESCRIPTORS[state].order;
}

export function runtimeLifecycleIsTerminal(state: RuntimeLifecycleState): boolean {
  return RUNTIME_LIFECYCLE_STATE_DESCRIPTORS[state].isTerminal;
}

/** Total order over lifecycle states by canonical ordinal. */
export function compareRuntimeLifecycle(left: RuntimeLifecycleState, right: RuntimeLifecycleState): number {
  return runtimeLifecycleOrderOf(left) - runtimeLifecycleOrderOf(right);
}

// --- Status lookups ----------------------------------------------------------

export function runtimeStatusDescriptorOf(status: RuntimeStatus): RuntimeStatusDescriptor {
  return RUNTIME_STATUS_DESCRIPTORS[status];
}

export function runtimeStatusOrderOf(status: RuntimeStatus): number {
  return RUNTIME_STATUS_DESCRIPTORS[status].order;
}

// --- Candidate-kind lookups --------------------------------------------------

export function runtimeCandidateKindDescriptorOf(
  kind: RuntimeCandidateKind,
): RuntimeCandidateKindDescriptor {
  return RUNTIME_CANDIDATE_KIND_DESCRIPTORS[kind];
}

export function runtimeCandidateKindOrderOf(kind: RuntimeCandidateKind): number {
  return RUNTIME_CANDIDATE_KIND_DESCRIPTORS[kind].order;
}

/** Every candidate kind asserts about the enterprise and requires an evidence basis. */
export function runtimeCandidateRequiresBasis(kind: RuntimeCandidateKind): boolean {
  return RUNTIME_CANDIDATE_KIND_DESCRIPTORS[kind].requiresBasis;
}

/** The originating Foundation phase (44–47) of a candidate kind. Provenance ordinal only. */
export function runtimeCandidateSourcePhaseOf(kind: RuntimeCandidateKind): number {
  return RUNTIME_CANDIDATE_KIND_DESCRIPTORS[kind].sourcePhase;
}

// --- Dependency lookups ------------------------------------------------------

export function runtimeDependencyKindDescriptorOf(
  kind: RuntimeDependencyKind,
): RuntimeDependencyKindDescriptor {
  return RUNTIME_DEPENDENCY_KIND_DESCRIPTORS[kind];
}

export function runtimeDependencyOrderOf(kind: RuntimeDependencyKind): number {
  return RUNTIME_DEPENDENCY_KIND_DESCRIPTORS[kind].order;
}

export function runtimeDependencyIsRequired(kind: RuntimeDependencyKind): boolean {
  return RUNTIME_DEPENDENCY_KIND_DESCRIPTORS[kind].required;
}

/** Every dependency kind that a well-formed Runtime pass must declare, in canonical order. */
export function runtimeRequiredDependencyKinds(): readonly RuntimeDependencyKind[] {
  return Object.values(RUNTIME_DEPENDENCY_KIND_DESCRIPTORS)
    .filter((descriptor) => descriptor.required)
    .sort((left, right) => left.order - right.order)
    .map((descriptor) => descriptor.dependencyKind);
}

// --- Failure and restriction lookups -----------------------------------------

export function runtimeFailureKindDescriptorOf(kind: RuntimeFailureKind): RuntimeFailureKindDescriptor {
  return RUNTIME_FAILURE_KIND_DESCRIPTORS[kind];
}

/** Every Runtime failure is fail-closed. Encoded as a lookup for explicitness. */
export function runtimeFailureIsFailClosed(kind: RuntimeFailureKind): boolean {
  return RUNTIME_FAILURE_KIND_DESCRIPTORS[kind].failClosed;
}

export function runtimeFailureOrderOf(kind: RuntimeFailureKind): number {
  return RUNTIME_FAILURE_KIND_DESCRIPTORS[kind].order;
}

export function runtimeRestrictionDescriptorOf(kind: RuntimeRestrictionKind): RuntimeRestrictionDescriptor {
  return RUNTIME_RESTRICTION_DESCRIPTORS[kind];
}

export function runtimeRestrictionOrderOf(kind: RuntimeRestrictionKind): number {
  return RUNTIME_RESTRICTION_DESCRIPTORS[kind].order;
}

// --- Confidence and approval lookups -----------------------------------------

export function runtimeConfidenceLevelDescriptorOf(
  level: RuntimeConfidenceLevel,
): RuntimeConfidenceLevelDescriptor {
  return RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS[level];
}

export function runtimeConfidenceOrderOf(level: RuntimeConfidenceLevel): number {
  return RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS[level].order;
}

/** Total order over confidence levels by canonical ordinal — presentation only. */
export function compareRuntimeConfidence(left: RuntimeConfidenceLevel, right: RuntimeConfidenceLevel): number {
  return runtimeConfidenceOrderOf(left) - runtimeConfidenceOrderOf(right);
}

export function runtimeApprovalStateDescriptorOf(
  state: RuntimeApprovalState,
): RuntimeApprovalStateDescriptor {
  return RUNTIME_APPROVAL_STATE_DESCRIPTORS[state];
}

// --- Projections -------------------------------------------------------------

/** The declared dependencies of a request, in natural order. Read-only projection. */
export function dependenciesOf(request: RuntimeRequest): readonly RuntimeDependency[] {
  return request.context.dependencies;
}

/**
 * True when a request declares every required dependency kind. A well-formed Runtime
 * pass consumes all settled inputs — memory context, reasoning understanding, and
 * organization assembly.
 */
export function reachesRequiredDependencies(request: RuntimeRequest): boolean {
  const declared = new Set(request.context.dependencies.map((dependency) => dependency.dependencyKind));
  return runtimeRequiredDependencyKinds().every((kind) => declared.has(kind));
}

/** A deterministic per-kind tally of candidates. Carried, never judged. */
export function summaryOf(candidates: readonly RuntimeCandidate[]): RuntimeSummary {
  const counts: Record<RuntimeCandidateKind, number> = {
    learning: 0,
    optimization: 0,
    "awareness-signal": 0,
    "awareness-assessment": 0,
    "evolution-readiness": 0,
    "evolution-pathway": 0,
  };
  for (const candidate of candidates) {
    counts[candidate.candidateKind] += 1;
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { counts, total };
}

/**
 * Enumerates a request's declared dependencies and a set of candidates as tagged
 * artifacts, in natural order. The inspectable artifact enumeration of a pass.
 */
export function artifactsOf(
  request: RuntimeRequest,
  candidates: readonly RuntimeCandidate[],
): readonly RuntimeArtifact[] {
  return [
    ...request.context.dependencies.map((value) => ({ kind: "dependency" as const, value })),
    ...candidates.map((value) => ({ kind: "candidate" as const, value })),
  ];
}
