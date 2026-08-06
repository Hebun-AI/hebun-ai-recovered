/**
 * Enterprise Organizational Intelligence Runtime — ontology shapes (Phase 1).
 *
 * Declares what a Runtime pass IS: the shapes of a Runtime scope, provenance,
 * explainability, confidence, governance, approval, dependency, context, input,
 * candidate, artifact, summary, request, session, output, and failure. This is
 * canonical, immutable declarative data — contract shapes, not an engine.
 *
 * These shapes describe a Runtime pass; they run nothing. Phase 1 produces NO
 * candidate, prepares NO briefing, performs NO validation beyond the declared
 * structural checks in the validation module, and holds NO state. It builds only on
 * the Runtime core contracts and, by reference, on the settled Memory, Reasoning, and
 * Organizational Intelligence foundations it will later consume read-only.
 */

import type {
  RuntimeApprovalState,
  RuntimeCandidateKind,
  RuntimeConfidenceLevel,
  RuntimeDependencyKind,
  RuntimeFailureKind,
  RuntimeId,
  RuntimeLifecycleState,
  RuntimeRestrictionKind,
  RuntimeStageKind,
  RuntimeStatement,
  RuntimeStatus,
  RuntimeTimestamp,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";

/** The bounded organizational scope a Runtime pass is declared against. */
export interface RuntimeScope {
  readonly scopeId: RuntimeId;
  readonly statement: RuntimeStatement;
  readonly domains: readonly string[];
}

/**
 * The preserved provenance carried with a candidate and its basis: source,
 * attribution, version, effective period, and lifecycle. Distinct from and never a
 * rewrite of Memory or Knowledge provenance.
 */
export interface RuntimeProvenance {
  readonly source: RuntimeStatement;
  readonly attribution: RuntimeStatement;
  readonly version: number;
  readonly effectivePeriod: RuntimeTimestamp;
  readonly lifecycle: RuntimeLifecycleState;
}

/**
 * The preserved constitutional explanation of a candidate: its basis, assumptions,
 * limitations, and uncertainty. Text only — it exposes no protected information and
 * prescribes no implementation.
 */
export interface RuntimeExplainability {
  readonly basis: readonly RuntimeStatement[];
  readonly assumptions: readonly RuntimeStatement[];
  readonly limitations: readonly RuntimeStatement[];
  readonly uncertainty: readonly RuntimeStatement[];
}

/**
 * The declared confidence a candidate carries, with its uncertainty. The level orders
 * candidates for presentation only; it never becomes permission or an auto-advance
 * threshold.
 */
export interface RuntimeConfidence {
  readonly level: RuntimeConfidenceLevel;
  readonly uncertainty: readonly RuntimeStatement[];
}

/**
 * The governance constraints a Runtime pass consumes, held immutable. The Runtime
 * consumes these read-only; it never approves, waives, enforces, or rewrites them.
 */
export interface RuntimeGovernance {
  readonly constraints: readonly RuntimeId[];
  readonly heldImmutable: true;
}

/**
 * The approval marker a Runtime output carries. Always pending a Director decision:
 * the Runtime never grants or denies approval, and no other state is representable.
 */
export interface RuntimeApproval {
  readonly state: RuntimeApprovalState;
}

/**
 * One declared, read-only consumption of a settled upstream input, named by kind and
 * pinned to a specific referenced version. Declaring a dependency reads nothing and
 * mutates nothing.
 */
export interface RuntimeDependency {
  readonly dependencyKind: RuntimeDependencyKind;
  readonly referenceId: RuntimeId;
  readonly version: number;
}

/**
 * The declared context of one Runtime pass: its purpose, scope, organization, tenant,
 * authority basis, and the settled inputs it consumes read-only. It carries the
 * constraints of the pass; it grants no authority and widens no scope.
 */
export interface RuntimeContext {
  readonly purpose: RuntimeStatement;
  readonly scope: RuntimeScope;
  readonly organizationId: RuntimeId;
  readonly tenantId: RuntimeId;
  readonly authorityBasis: RuntimeStatement;
  readonly dependencies: readonly RuntimeDependency[];
}

/** The proposed input to a Runtime pass — its declared context. */
export interface RuntimeInput {
  readonly context: RuntimeContext;
}

/**
 * The SHAPE of one produced candidate: its identity, kind, statement, and the bound
 * provenance, explainability, and confidence it must always carry. Phase 1 defines
 * this shape only; it generates no candidate. A candidate is attributable, uncertain,
 * reviewable, and non-authoritative — never a Decision, Approval, or command.
 */
export interface RuntimeCandidate {
  readonly candidateId: RuntimeId;
  readonly candidateKind: RuntimeCandidateKind;
  readonly statement: RuntimeStatement;
  readonly provenance: RuntimeProvenance;
  readonly explainability: RuntimeExplainability;
  readonly confidence: RuntimeConfidence;
}

/** One inspectable member of a Runtime pass, tagged by kind. */
export type RuntimeArtifact =
  | { readonly kind: "dependency"; readonly value: RuntimeDependency }
  | { readonly kind: "candidate"; readonly value: RuntimeCandidate };

/** A deterministic per-kind tally of candidates. Carried, never judged. */
export interface RuntimeSummary {
  readonly counts: Readonly<Record<RuntimeCandidateKind, number>>;
  readonly total: number;
}

/**
 * The declared request for one Runtime pass: an identity, the context it runs under,
 * the candidate kinds it targets, and the stages it declares. A request is a
 * declaration of intent and boundary — it performs nothing.
 */
export interface RuntimeRequest {
  readonly requestId: RuntimeId;
  readonly context: RuntimeContext;
  readonly targets: readonly RuntimeCandidateKind[];
  readonly stages: readonly RuntimeStageKind[];
}

/**
 * The identity and position of a Runtime pass in progress: its session identity, the
 * request it realizes, its overall status, its current stage, and its approval marker
 * (always pending Director). A session is a positional record — it drives nothing.
 */
export interface RuntimeSession {
  readonly sessionId: RuntimeId;
  readonly requestId: RuntimeId;
  readonly status: RuntimeStatus;
  readonly stage: RuntimeStageKind;
  readonly approval: RuntimeApproval;
}

/**
 * The advisory deliverable of a Runtime pass: the candidates it carries, their
 * summary, the governance held immutable over it, and its approval marker. An output
 * is attributable, scope-bound, and non-authoritative — it terminates at the Director
 * Approval boundary and is never a Decision, command, roadmap change, or execution
 * artifact.
 */
export interface RuntimeOutput {
  readonly requestId: RuntimeId;
  readonly candidates: readonly RuntimeCandidate[];
  readonly summary: RuntimeSummary;
  readonly governance: RuntimeGovernance;
  readonly approval: RuntimeApproval;
}

/**
 * One fail-closed failure of a Runtime pass: the failure kind, the closed response it
 * mandates, and an attributable detail. A failure never yields an assumption or an
 * action.
 */
export interface RuntimeFailure {
  readonly failureKind: RuntimeFailureKind;
  readonly restriction: RuntimeRestrictionKind;
  readonly detail: RuntimeStatement;
}

/**
 * A request that has passed through Runtime normalization: dependencies, targets,
 * stages, and scope domains de-duplicated and canonically ordered. Structurally a
 * {@link RuntimeRequest}; the alias marks that canonical form has been applied.
 */
export type CanonicalRuntimeRequest = RuntimeRequest;
