/**
 * Enterprise Organizational Intelligence — organization evolution type descriptors (Phase 6).
 *
 * Declares the canonical contracts of Strategic Enterprise Evolution (Program VIII,
 * Phase 47): the ontology of attributable evolution constraints, readiness assessments,
 * and non-authoritative evolution pathways — with continuity, sustainability, basis,
 * uncertainty, provenance, and lifecycle — and the bounded evolution context that holds
 * them. This is canonical, immutable declarative data — lookup tables and contract
 * shapes, not an engine.
 *
 * Strategic Enterprise Evolution DESCRIBES constitutional evolution read-only from Phase
 * 44 learnings, Phase 45 optimization, Phase 46 awareness, and governed evidence; it
 * never PERFORMS evolution, amends the roadmap, opens phases, governs, decides, or acts.
 * A pathway is descriptive guidance, never a Plan, Decision, or roadmap amendment. Phase
 * 6 defines contracts ONLY: there is NO evolution engine, NO prediction, NO forecasting,
 * NO simulation, NO optimization, NO awareness engine, NO recommendation, NO planning, NO
 * model, NO runtime, NO decision, and NO action here. A basis is a read-only pointer into
 * published learnings, optimization opportunities, awareness assessments, and memory
 * evidence; it is never mutated. Builds only on OI Phase 1–5 and the published Memory and
 * Reasoning foundations.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import type { OptimizationOpportunityId } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import type { StrategicAssessmentId } from "@/features/enterprise-organizational-intelligence/organization-awareness-types";

/** The kinds of constitutional limit any described evolution pathway must respect. */
export type EvolutionConstraintKind =
  | "continuity"
  | "identity"
  | "history"
  | "accountability"
  | "governance"
  | "security"
  | "roadmap-integrity";

/** The fixed, canonical properties of an evolution constraint kind. */
export interface EvolutionConstraintKindDescriptor {
  readonly kind: EvolutionConstraintKind;
  /** A fixed integer for canonical ordering. Ordinal only — not a score or threshold. */
  readonly order: number;
}

/** The canonical descriptor for every evolution constraint kind. Frozen and immutable. */
export const EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS: Readonly<
  Record<EvolutionConstraintKind, EvolutionConstraintKindDescriptor>
> = Object.freeze({
  continuity: Object.freeze({ kind: "continuity", order: 0 }),
  identity: Object.freeze({ kind: "identity", order: 1 }),
  history: Object.freeze({ kind: "history", order: 2 }),
  accountability: Object.freeze({ kind: "accountability", order: 3 }),
  governance: Object.freeze({ kind: "governance", order: 4 }),
  security: Object.freeze({ kind: "security", order: 5 }),
  "roadmap-integrity": Object.freeze({ kind: "roadmap-integrity", order: 6 }),
});

/** The implementation-independent lifecycle states of an evolution output. */
export type EvolutionLifecycleState =
  | "context-declared"
  | "basis-qualified"
  | "constraints-bound"
  | "readiness-assessed"
  | "pathways-described"
  | "continuity-preserved"
  | "output-validated"
  | "output-qualified"
  | "review-eligible"
  | "closed"
  | "escalated";

/** The fixed, canonical properties of an evolution lifecycle state. */
export interface EvolutionLifecycleStateDescriptor {
  readonly state: EvolutionLifecycleState;
  /** A fixed integer for canonical ordering. Ordinal only — not a progression trigger. */
  readonly order: number;
  /** Whether the state ends the output's active lifecycle (history preserved). */
  readonly isTerminal: boolean;
}

/**
 * The canonical descriptor for every evolution lifecycle state. Frozen and immutable.
 * Order mirrors the constitutional lifecycle; no state advances automatically and none
 * amends the roadmap. The terminal states (closed, escalated) end active lifecycle
 * without triggering action or roadmap amendment.
 */
export const EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS: Readonly<
  Record<EvolutionLifecycleState, EvolutionLifecycleStateDescriptor>
> = Object.freeze({
  "context-declared": Object.freeze({ state: "context-declared", order: 0, isTerminal: false }),
  "basis-qualified": Object.freeze({ state: "basis-qualified", order: 1, isTerminal: false }),
  "constraints-bound": Object.freeze({ state: "constraints-bound", order: 2, isTerminal: false }),
  "readiness-assessed": Object.freeze({ state: "readiness-assessed", order: 3, isTerminal: false }),
  "pathways-described": Object.freeze({ state: "pathways-described", order: 4, isTerminal: false }),
  "continuity-preserved": Object.freeze({ state: "continuity-preserved", order: 5, isTerminal: false }),
  "output-validated": Object.freeze({ state: "output-validated", order: 6, isTerminal: false }),
  "output-qualified": Object.freeze({ state: "output-qualified", order: 7, isTerminal: false }),
  "review-eligible": Object.freeze({ state: "review-eligible", order: 8, isTerminal: false }),
  closed: Object.freeze({ state: "closed", order: 9, isTerminal: true }),
  escalated: Object.freeze({ state: "escalated", order: 10, isTerminal: true }),
});

export type EvolutionConstraintId = OrganizationId;
export type EvolutionReadinessId = OrganizationId;
export type EvolutionPathwayId = OrganizationId;

/**
 * The read-only, attributable set of Phase 44 learnings, Phase 45 optimization
 * opportunities, Phase 46 awareness assessments, and governed memory evidence that
 * evolution derives from. Each reference preserves its source identity, ownership, and
 * provenance; evolution never mutates, redefines, or absorbs them.
 */
export interface EvolutionBasis {
  readonly learnings: readonly OrganizationLearningId[];
  readonly opportunities: readonly OptimizationOpportunityId[];
  readonly assessments: readonly StrategicAssessmentId[];
  readonly evidence: readonly EvidenceReference[];
}

/** An explicitly stated thing a readiness or pathway does not know or cannot yet resolve. */
export interface EvolutionUncertainty {
  readonly statement: OrganizationStatement;
}

/**
 * The preserved attribution and version of an evolution artifact, maintained
 * independently of upstream provenance. Version is an ordinal revision counter, not a clock.
 */
export interface EvolutionProvenance {
  readonly attributedTo: OrganizationStatement;
  readonly version: number;
}

/** A constitutional limit that any described evolution pathway must respect. */
export interface EvolutionConstraint {
  readonly constraintId: EvolutionConstraintId;
  readonly kind: EvolutionConstraintKind;
  readonly statement: OrganizationStatement;
}

/**
 * An attributable, uncertainty-preserving assessment of the Enterprise's preparedness to
 * evolve within a domain, derived read-only from its basis. It never authorizes, decides,
 * or performs evolution.
 */
export interface EvolutionReadiness {
  readonly readinessId: EvolutionReadinessId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly basis: EvolutionBasis;
  readonly provenance: EvolutionProvenance;
  readonly uncertainties: readonly EvolutionUncertainty[];
}

/** The preserved constitutional continuity a described pathway must not erase. */
export interface EvolutionContinuity {
  readonly preserved: boolean;
  readonly statement: OrganizationStatement;
}

/** An attributable assessment of a pathway's durability and constitutional soundness. */
export interface EvolutionSustainability {
  readonly statement: OrganizationStatement;
}

/**
 * An attributable, scope-bound, non-authoritative description of a possible constitutional
 * evolution direction, derived from an eligible readiness assessment and respecting the
 * declared constraints. It is never a Plan, Decision, roadmap amendment, command, or the
 * performance of evolution.
 */
export interface EvolutionPathway {
  readonly pathwayId: EvolutionPathwayId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly derivedFrom: EvolutionReadinessId;
  readonly respects: readonly EvolutionConstraintId[];
  readonly continuity: EvolutionContinuity;
  readonly sustainability: EvolutionSustainability;
  readonly basis: EvolutionBasis;
  readonly provenance: EvolutionProvenance;
  readonly uncertainties: readonly EvolutionUncertainty[];
}

/**
 * The bounded description of one evolution context: its purpose, the scope it is confined
 * to, the organization it concerns, the constitutional constraints, the readiness
 * assessments, and the described pathways within it. Contract shape only — it assesses no
 * readiness, describes no pathway, and amends no roadmap.
 */
export interface EvolutionContext {
  readonly organizationId: OrganizationId;
  readonly purpose: OrganizationStatement;
  readonly scope: OrganizationScope;
  readonly constraints: readonly EvolutionConstraint[];
  readonly readiness: readonly EvolutionReadiness[];
  readonly pathways: readonly EvolutionPathway[];
}

/**
 * An evolution context that has passed through evolution normalization: constraints,
 * readiness, and pathways de-duplicated and canonically ordered, each basis and
 * uncertainty canonicalized. Structurally an {@link EvolutionContext}; the alias marks
 * that canonical form has been applied.
 */
export type CanonicalEvolutionContext = EvolutionContext;
