/**
 * Enterprise Organizational Intelligence Runtime — canonical core contracts (Phase 1).
 *
 * The shared vocabulary of the Organizational Intelligence Runtime: the
 * technology-neutral descriptor tables and primitive aliases every later Runtime
 * phase will speak. Phase 1 defines contracts ONLY. It performs no runtime behaviour,
 * no orchestration, no candidate generation, no analysis, no decision, no approval,
 * no execution, and no model call. There is no engine, no algorithm, no persistence,
 * no AI, no agent, no scheduler, no API, and no UI here — only immutable, readonly
 * declarations.
 *
 * The Runtime consumes settled Memory Context, Reasoning Understanding, and
 * Organizational Assembly read-only, and it produces attributable, non-authoritative
 * candidates and briefings for a human to consider. It decides, approves, executes,
 * and automates nothing. These descriptors encode that boundary in their shapes.
 */

/** A canonical, opaque identity. Text only — carries no behaviour. */
export type RuntimeId = string;

/** A canonical timestamp value carried from settled inputs. Text only — never generated here. */
export type RuntimeTimestamp = string;

/** A short, human-authored statement. Text only — carries no behaviour. */
export type RuntimeStatement = string;

/**
 * The canonical stages of one Runtime pass. These are the ten boundaries of the
 * Runtime Architecture named as ordered stages. Naming and ordering only — a stage
 * triggers no behaviour, runs nothing, and confers no authority.
 */
export type RuntimeStageKind =
  | "input"
  | "context"
  | "analysis"
  | "candidate-generation"
  | "validation"
  | "explanation"
  | "confidence"
  | "governance"
  | "director-approval"
  | "output";

/** The fixed, canonical properties of a Runtime stage. */
export interface RuntimeStageDescriptor {
  readonly stageKind: RuntimeStageKind;
  /** A fixed integer for canonical stage ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime stage. Frozen and immutable. */
export const RUNTIME_STAGE_DESCRIPTORS: Readonly<Record<RuntimeStageKind, RuntimeStageDescriptor>> =
  Object.freeze({
    input: Object.freeze({ stageKind: "input", order: 0 }),
    context: Object.freeze({ stageKind: "context", order: 1 }),
    analysis: Object.freeze({ stageKind: "analysis", order: 2 }),
    "candidate-generation": Object.freeze({ stageKind: "candidate-generation", order: 3 }),
    validation: Object.freeze({ stageKind: "validation", order: 4 }),
    explanation: Object.freeze({ stageKind: "explanation", order: 5 }),
    confidence: Object.freeze({ stageKind: "confidence", order: 6 }),
    governance: Object.freeze({ stageKind: "governance", order: 7 }),
    "director-approval": Object.freeze({ stageKind: "director-approval", order: 8 }),
    output: Object.freeze({ stageKind: "output", order: 9 }),
  });

/**
 * The canonical lifecycle states of a Runtime pass. Implementation-independent
 * progression only — no state advances automatically, and no state performs work.
 */
export type RuntimeLifecycleState =
  | "declared"
  | "admitted"
  | "bound"
  | "prepared"
  | "validated"
  | "qualified"
  | "briefed"
  | "closed"
  | "escalated";

/** The fixed, canonical properties of a Runtime lifecycle state. */
export interface RuntimeLifecycleStateDescriptor {
  readonly lifecycleState: RuntimeLifecycleState;
  /** A fixed integer for canonical lifecycle ordering. Ordinal only — not a score. */
  readonly order: number;
  /** Whether the state is terminal (no successor within one pass). */
  readonly isTerminal: boolean;
}

/** The canonical descriptor for every Runtime lifecycle state. Frozen and immutable. */
export const RUNTIME_LIFECYCLE_STATE_DESCRIPTORS: Readonly<
  Record<RuntimeLifecycleState, RuntimeLifecycleStateDescriptor>
> = Object.freeze({
  declared: Object.freeze({ lifecycleState: "declared", order: 0, isTerminal: false }),
  admitted: Object.freeze({ lifecycleState: "admitted", order: 1, isTerminal: false }),
  bound: Object.freeze({ lifecycleState: "bound", order: 2, isTerminal: false }),
  prepared: Object.freeze({ lifecycleState: "prepared", order: 3, isTerminal: false }),
  validated: Object.freeze({ lifecycleState: "validated", order: 4, isTerminal: false }),
  qualified: Object.freeze({ lifecycleState: "qualified", order: 5, isTerminal: false }),
  briefed: Object.freeze({ lifecycleState: "briefed", order: 6, isTerminal: false }),
  closed: Object.freeze({ lifecycleState: "closed", order: 7, isTerminal: true }),
  escalated: Object.freeze({ lifecycleState: "escalated", order: 8, isTerminal: true }),
});

/** The canonical overall status of a Runtime session. Naming and ordering only. */
export type RuntimeStatus =
  | "pending"
  | "admitted"
  | "prepared"
  | "validated"
  | "qualified"
  | "briefed"
  | "awaiting-director"
  | "closed"
  | "escalated"
  | "failed";

/** The fixed, canonical properties of a Runtime status. */
export interface RuntimeStatusDescriptor {
  readonly status: RuntimeStatus;
  /** A fixed integer for canonical status ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime status. Frozen and immutable. */
export const RUNTIME_STATUS_DESCRIPTORS: Readonly<Record<RuntimeStatus, RuntimeStatusDescriptor>> =
  Object.freeze({
    pending: Object.freeze({ status: "pending", order: 0 }),
    admitted: Object.freeze({ status: "admitted", order: 1 }),
    prepared: Object.freeze({ status: "prepared", order: 2 }),
    validated: Object.freeze({ status: "validated", order: 3 }),
    qualified: Object.freeze({ status: "qualified", order: 4 }),
    briefed: Object.freeze({ status: "briefed", order: 5 }),
    "awaiting-director": Object.freeze({ status: "awaiting-director", order: 6 }),
    closed: Object.freeze({ status: "closed", order: 7 }),
    escalated: Object.freeze({ status: "escalated", order: 8 }),
    failed: Object.freeze({ status: "failed", order: 9 }),
  });

/**
 * The kinds of candidate the Runtime vocabulary recognizes, one per published
 * Organizational Intelligence Foundation domain (Phases 44–47). Naming only — this
 * classifies contract shapes; it generates nothing and confers no authority. Every
 * candidate kind asserts something about the enterprise and so requires an evidence
 * basis to be well-formed.
 */
export type RuntimeCandidateKind =
  | "learning"
  | "optimization"
  | "awareness-signal"
  | "awareness-assessment"
  | "evolution-readiness"
  | "evolution-pathway";

/** The fixed, canonical properties of a Runtime candidate kind. */
export interface RuntimeCandidateKindDescriptor {
  readonly candidateKind: RuntimeCandidateKind;
  /** The originating Foundation phase (44–47). Ordinal provenance only — not a score. */
  readonly sourcePhase: number;
  /** Every candidate asserts about the enterprise and must be grounded in evidence. */
  readonly requiresBasis: boolean;
  /** A fixed integer for canonical cross-kind ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime candidate kind. Frozen and immutable. */
export const RUNTIME_CANDIDATE_KIND_DESCRIPTORS: Readonly<
  Record<RuntimeCandidateKind, RuntimeCandidateKindDescriptor>
> = Object.freeze({
  learning: Object.freeze({ candidateKind: "learning", sourcePhase: 44, requiresBasis: true, order: 0 }),
  optimization: Object.freeze({ candidateKind: "optimization", sourcePhase: 45, requiresBasis: true, order: 1 }),
  "awareness-signal": Object.freeze({
    candidateKind: "awareness-signal",
    sourcePhase: 46,
    requiresBasis: true,
    order: 2,
  }),
  "awareness-assessment": Object.freeze({
    candidateKind: "awareness-assessment",
    sourcePhase: 46,
    requiresBasis: true,
    order: 3,
  }),
  "evolution-readiness": Object.freeze({
    candidateKind: "evolution-readiness",
    sourcePhase: 47,
    requiresBasis: true,
    order: 4,
  }),
  "evolution-pathway": Object.freeze({
    candidateKind: "evolution-pathway",
    sourcePhase: 47,
    requiresBasis: true,
    order: 5,
  }),
});

/**
 * The kinds of settled upstream input the Runtime consumes read-only. Naming only —
 * declaring a dependency reads nothing and mutates nothing. Every dependency kind is
 * required: a Runtime pass is only well-formed when all are declared.
 */
export type RuntimeDependencyKind =
  | "memory-context"
  | "reasoning-understanding"
  | "organization-assembly";

/** The fixed, canonical properties of a Runtime dependency kind. */
export interface RuntimeDependencyKindDescriptor {
  readonly dependencyKind: RuntimeDependencyKind;
  /** Whether a well-formed Runtime pass must declare this dependency. */
  readonly required: boolean;
  /** A fixed integer for canonical dependency ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime dependency kind. Frozen and immutable. */
export const RUNTIME_DEPENDENCY_KIND_DESCRIPTORS: Readonly<
  Record<RuntimeDependencyKind, RuntimeDependencyKindDescriptor>
> = Object.freeze({
  "memory-context": Object.freeze({ dependencyKind: "memory-context", required: true, order: 0 }),
  "reasoning-understanding": Object.freeze({
    dependencyKind: "reasoning-understanding",
    required: true,
    order: 1,
  }),
  "organization-assembly": Object.freeze({
    dependencyKind: "organization-assembly",
    required: true,
    order: 2,
  }),
});

/**
 * The canonical failure kinds of a Runtime pass. Every failure is fail-closed: the
 * Runtime never silently guesses, fabricates, or advances on incomplete grounds.
 */
export type RuntimeFailureKind =
  | "missing-evidence"
  | "invalid-understanding"
  | "contradictory-inputs"
  | "stale-context"
  | "insufficient-confidence"
  | "unavailable-dependency"
  | "partial-candidate-generation"
  | "validation-failure"
  | "governance-rejection"
  | "timeout"
  | "retry-exhaustion";

/** The fixed, canonical properties of a Runtime failure kind. */
export interface RuntimeFailureKindDescriptor {
  readonly failureKind: RuntimeFailureKind;
  /** Every Runtime failure is fail-closed. Always true — encoded for explicitness. */
  readonly failClosed: boolean;
  /** A fixed integer for canonical failure ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime failure kind. Frozen and immutable. */
export const RUNTIME_FAILURE_KIND_DESCRIPTORS: Readonly<
  Record<RuntimeFailureKind, RuntimeFailureKindDescriptor>
> = Object.freeze({
  "missing-evidence": Object.freeze({ failureKind: "missing-evidence", failClosed: true, order: 0 }),
  "invalid-understanding": Object.freeze({ failureKind: "invalid-understanding", failClosed: true, order: 1 }),
  "contradictory-inputs": Object.freeze({ failureKind: "contradictory-inputs", failClosed: true, order: 2 }),
  "stale-context": Object.freeze({ failureKind: "stale-context", failClosed: true, order: 3 }),
  "insufficient-confidence": Object.freeze({ failureKind: "insufficient-confidence", failClosed: true, order: 4 }),
  "unavailable-dependency": Object.freeze({ failureKind: "unavailable-dependency", failClosed: true, order: 5 }),
  "partial-candidate-generation": Object.freeze({
    failureKind: "partial-candidate-generation",
    failClosed: true,
    order: 6,
  }),
  "validation-failure": Object.freeze({ failureKind: "validation-failure", failClosed: true, order: 7 }),
  "governance-rejection": Object.freeze({ failureKind: "governance-rejection", failClosed: true, order: 8 }),
  timeout: Object.freeze({ failureKind: "timeout", failClosed: true, order: 9 }),
  "retry-exhaustion": Object.freeze({ failureKind: "retry-exhaustion", failClosed: true, order: 10 }),
});

/**
 * The canonical closed responses to a Runtime failure. A failure never yields an
 * assumption or an action — only restriction, deferral, or escalation.
 */
export type RuntimeRestrictionKind = "restrict" | "defer" | "escalate";

/** The fixed, canonical properties of a Runtime restriction kind. */
export interface RuntimeRestrictionDescriptor {
  readonly restrictionKind: RuntimeRestrictionKind;
  /** A fixed integer for canonical restriction ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime restriction kind. Frozen and immutable. */
export const RUNTIME_RESTRICTION_DESCRIPTORS: Readonly<
  Record<RuntimeRestrictionKind, RuntimeRestrictionDescriptor>
> = Object.freeze({
  restrict: Object.freeze({ restrictionKind: "restrict", order: 0 }),
  defer: Object.freeze({ restrictionKind: "defer", order: 1 }),
  escalate: Object.freeze({ restrictionKind: "escalate", order: 2 }),
});

/**
 * The canonical declared confidence levels a candidate may carry. The ordinal orders
 * levels for canonical presentation ONLY; it is not a probability, weight, or score,
 * and it never becomes permission, ranking-as-command, or an auto-advance threshold.
 */
export type RuntimeConfidenceLevel = "indeterminate" | "low" | "moderate" | "high";

/** The fixed, canonical properties of a Runtime confidence level. */
export interface RuntimeConfidenceLevelDescriptor {
  readonly level: RuntimeConfidenceLevel;
  /** A fixed integer for canonical ordering. Ordinal only — never a probability or score. */
  readonly order: number;
}

/** The canonical descriptor for every Runtime confidence level. Frozen and immutable. */
export const RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS: Readonly<
  Record<RuntimeConfidenceLevel, RuntimeConfidenceLevelDescriptor>
> = Object.freeze({
  indeterminate: Object.freeze({ level: "indeterminate", order: 0 }),
  low: Object.freeze({ level: "low", order: 1 }),
  moderate: Object.freeze({ level: "moderate", order: 2 }),
  high: Object.freeze({ level: "high", order: 3 }),
});

/**
 * The canonical approval state a Runtime output may carry. The Runtime can only ever
 * represent a pending Director decision. Granting or denying approval is a Director
 * act the Runtime never performs and never emits — that is why this set has exactly
 * one member and no "granted" or "denied" state exists here.
 */
export type RuntimeApprovalState = "pending-director";

/** The fixed, canonical properties of a Runtime approval state. */
export interface RuntimeApprovalStateDescriptor {
  readonly approvalState: RuntimeApprovalState;
  /** A fixed integer for canonical ordering. Ordinal only — not a score. */
  readonly order: number;
}

/** The canonical descriptor for the Runtime approval state. Frozen and immutable. */
export const RUNTIME_APPROVAL_STATE_DESCRIPTORS: Readonly<
  Record<RuntimeApprovalState, RuntimeApprovalStateDescriptor>
> = Object.freeze({
  "pending-director": Object.freeze({ approvalState: "pending-director", order: 0 }),
});
