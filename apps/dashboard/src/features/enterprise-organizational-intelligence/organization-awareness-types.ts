/**
 * Enterprise Organizational Intelligence — organization awareness type descriptors (Phase 5).
 *
 * Declares the canonical contracts of Strategic Awareness (Program VIII, Phase 46):
 * the ontology of attributable strategic signals and assessments across the strategic
 * dimensions (position, state, health, readiness, opportunity, risk, alignment, drift,
 * dependency) — with basis, uncertainty, provenance, and lifecycle — and the bounded
 * awareness context that holds them. This is canonical, immutable declarative data —
 * lookup tables and contract shapes, not an engine.
 *
 * Strategic Awareness makes the enterprise's strategic condition visible read-only from
 * Phase 44 learnings, Phase 45 optimization outputs, and governed evidence. It is NOT
 * Governance, Decision, Authority, Learning, Optimization, or action. Phase 5 defines
 * contracts ONLY: there is NO awareness engine, NO awareness analysis, NO
 * self-evaluation engine, NO blind-spot detection engine, NO monitoring, NO alerting,
 * NO scoring, NO recommendation, NO prioritization, NO model, NO runtime, NO decision,
 * and NO action here. Awareness of a risk is never authority to mitigate it; awareness
 * of an opportunity is never authority to pursue it. A basis is a read-only pointer into
 * published learnings, optimization opportunities, and memory evidence; it is never
 * mutated. Builds only on OI Phase 1–4 and the published Memory and Reasoning foundations.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import type { OptimizationOpportunityId } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";

/** The strategic dimensions a signal observes or an assessment evaluates. */
export type StrategicDimension =
  | "position"
  | "state"
  | "health"
  | "readiness"
  | "opportunity"
  | "risk"
  | "alignment"
  | "drift"
  | "dependency";

/** The fixed, canonical properties of a strategic dimension. */
export interface StrategicDimensionDescriptor {
  readonly dimension: StrategicDimension;
  /** A fixed integer for canonical ordering. Ordinal only — not a score, index, or threshold. */
  readonly order: number;
}

/** The canonical descriptor for every strategic dimension. Frozen and immutable. */
export const STRATEGIC_DIMENSION_DESCRIPTORS: Readonly<Record<StrategicDimension, StrategicDimensionDescriptor>> =
  Object.freeze({
    position: Object.freeze({ dimension: "position", order: 0 }),
    state: Object.freeze({ dimension: "state", order: 1 }),
    health: Object.freeze({ dimension: "health", order: 2 }),
    readiness: Object.freeze({ dimension: "readiness", order: 3 }),
    opportunity: Object.freeze({ dimension: "opportunity", order: 4 }),
    risk: Object.freeze({ dimension: "risk", order: 5 }),
    alignment: Object.freeze({ dimension: "alignment", order: 6 }),
    drift: Object.freeze({ dimension: "drift", order: 7 }),
    dependency: Object.freeze({ dimension: "dependency", order: 8 }),
  });

/** The implementation-independent lifecycle states of an awareness output. */
export type AwarenessLifecycleState =
  | "context-declared"
  | "basis-qualified"
  | "constraints-bound"
  | "signals-detected"
  | "assessment-produced"
  | "output-validated"
  | "output-qualified"
  | "review-eligible"
  | "closed"
  | "escalated";

/** The fixed, canonical properties of an awareness lifecycle state. */
export interface AwarenessLifecycleStateDescriptor {
  readonly state: AwarenessLifecycleState;
  /** A fixed integer for canonical ordering. Ordinal only — not a progression trigger. */
  readonly order: number;
  /** Whether the state ends the output's active lifecycle (history preserved). */
  readonly isTerminal: boolean;
}

/**
 * The canonical descriptor for every awareness lifecycle state. Frozen and immutable.
 * Order mirrors the constitutional lifecycle; no state advances automatically. The
 * terminal states (closed, escalated) end active lifecycle without triggering action.
 */
export const AWARENESS_LIFECYCLE_STATE_DESCRIPTORS: Readonly<
  Record<AwarenessLifecycleState, AwarenessLifecycleStateDescriptor>
> = Object.freeze({
  "context-declared": Object.freeze({ state: "context-declared", order: 0, isTerminal: false }),
  "basis-qualified": Object.freeze({ state: "basis-qualified", order: 1, isTerminal: false }),
  "constraints-bound": Object.freeze({ state: "constraints-bound", order: 2, isTerminal: false }),
  "signals-detected": Object.freeze({ state: "signals-detected", order: 3, isTerminal: false }),
  "assessment-produced": Object.freeze({ state: "assessment-produced", order: 4, isTerminal: false }),
  "output-validated": Object.freeze({ state: "output-validated", order: 5, isTerminal: false }),
  "output-qualified": Object.freeze({ state: "output-qualified", order: 6, isTerminal: false }),
  "review-eligible": Object.freeze({ state: "review-eligible", order: 7, isTerminal: false }),
  closed: Object.freeze({ state: "closed", order: 8, isTerminal: true }),
  escalated: Object.freeze({ state: "escalated", order: 9, isTerminal: true }),
});

export type StrategicSignalId = OrganizationId;
export type StrategicAssessmentId = OrganizationId;

/**
 * The read-only, attributable set of Phase 44 learnings, Phase 45 optimization
 * opportunities, and governed memory evidence that awareness derives from. Each
 * reference preserves its source identity, ownership, and provenance; awareness never
 * mutates, redefines, or absorbs them.
 */
export interface AwarenessBasis {
  readonly learnings: readonly OrganizationLearningId[];
  readonly opportunities: readonly OptimizationOpportunityId[];
  readonly evidence: readonly EvidenceReference[];
}

/** An explicitly stated thing a signal or assessment does not know or cannot yet resolve. */
export interface AwarenessUncertainty {
  readonly statement: OrganizationStatement;
}

/**
 * The preserved attribution and version of an awareness artifact, maintained
 * independently of memory, learning, and optimization provenance. Version is an
 * ordinal revision counter, not a clock.
 */
export interface AwarenessProvenance {
  readonly attributedTo: OrganizationStatement;
  readonly version: number;
}

/**
 * An attributable, scope-bound observation across a strategic dimension, derived
 * read-only from its basis. It is never a command, alert-to-act, Decision, or obligation.
 */
export interface StrategicSignal {
  readonly signalId: StrategicSignalId;
  readonly dimension: StrategicDimension;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly basis: AwarenessBasis;
  readonly provenance: AwarenessProvenance;
  readonly uncertainties: readonly AwarenessUncertainty[];
}

/**
 * An attributable, uncertainty-preserving evaluation over strategic signals across a
 * dimension. It is never a Decision, Approval, Governance outcome, or command; a
 * perceived risk or opportunity carries no authority or obligation to act.
 */
export interface StrategicAssessment {
  readonly assessmentId: StrategicAssessmentId;
  readonly dimension: StrategicDimension;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly derivedFrom: readonly StrategicSignalId[];
  readonly basis: AwarenessBasis;
  readonly provenance: AwarenessProvenance;
  readonly uncertainties: readonly AwarenessUncertainty[];
}

/**
 * The bounded description of one awareness context: its purpose, the scope it is
 * confined to, the organization it concerns, and the strategic signals and assessments
 * within it. Contract shape only — it detects no signal and produces no assessment.
 */
export interface AwarenessContext {
  readonly organizationId: OrganizationId;
  readonly purpose: OrganizationStatement;
  readonly scope: OrganizationScope;
  readonly signals: readonly StrategicSignal[];
  readonly assessments: readonly StrategicAssessment[];
}

/**
 * An awareness context that has passed through awareness normalization: signals and
 * assessments de-duplicated and canonically ordered, each basis and uncertainty
 * canonicalized. Structurally an {@link AwarenessContext}; the alias marks that
 * canonical form has been applied.
 */
export type CanonicalAwarenessContext = AwarenessContext;
