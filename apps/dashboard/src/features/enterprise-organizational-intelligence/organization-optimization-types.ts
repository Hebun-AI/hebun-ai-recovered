/**
 * Enterprise Organizational Intelligence — organization optimization type descriptors (Phase 4).
 *
 * Declares the canonical contracts of Organizational Optimization Intelligence
 * (Program VIII, Phase 45): the ontology of attributable effectiveness analysis,
 * optimization opportunities, and their bounded analytic priority — with basis,
 * uncertainty, provenance, and lifecycle — and the bounded optimization context that
 * holds them. This is canonical, immutable declarative data — lookup tables and
 * contract shapes, not an engine.
 *
 * Organizational Optimization Intelligence analyzes effectiveness and surfaces
 * prioritized opportunities read-only from Phase 44 learnings and governed evidence.
 * It is NOT Learning, Memory, Knowledge, Evidence, Reasoning, Decision, Authority, or
 * action, and its priority is NEVER Program IV Work prioritization. Phase 4 defines
 * contracts ONLY: there is NO optimization engine, NO analysis execution, NO
 * recommendation engine, NO scoring, NO prioritization algorithm, NO objective
 * function, NO model, NO runtime, NO decision, and NO action here. A priority "rank"
 * is a DECLARED ordinal for consideration, never a computed score. A basis is a
 * read-only pointer into published learnings and memory evidence; it is never mutated.
 * Builds only on OI Phase 1–3 and the published Memory and Reasoning foundations.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationLearningId } from "@/features/enterprise-organizational-intelligence/organization-learning-types";

/** The implementation-independent lifecycle states of an optimization output. */
export type OptimizationLifecycleState =
  | "context-declared"
  | "basis-qualified"
  | "constraints-bound"
  | "effectiveness-analyzed"
  | "opportunities-identified"
  | "opportunities-prioritized"
  | "output-validated"
  | "output-qualified"
  | "review-eligible"
  | "closed"
  | "escalated";

/** The fixed, canonical properties of an optimization lifecycle state. */
export interface OptimizationLifecycleStateDescriptor {
  readonly state: OptimizationLifecycleState;
  /** A fixed integer for canonical ordering. Ordinal only — not a score or progression trigger. */
  readonly order: number;
  /** Whether the state ends the output's active lifecycle (history preserved). */
  readonly isTerminal: boolean;
}

/**
 * The canonical descriptor for every optimization lifecycle state. Frozen and
 * immutable. Order mirrors the constitutional lifecycle; no state advances
 * automatically. The terminal states (closed, escalated) end active lifecycle without
 * triggering any action.
 */
export const OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS: Readonly<
  Record<OptimizationLifecycleState, OptimizationLifecycleStateDescriptor>
> = Object.freeze({
  "context-declared": Object.freeze({ state: "context-declared", order: 0, isTerminal: false }),
  "basis-qualified": Object.freeze({ state: "basis-qualified", order: 1, isTerminal: false }),
  "constraints-bound": Object.freeze({ state: "constraints-bound", order: 2, isTerminal: false }),
  "effectiveness-analyzed": Object.freeze({ state: "effectiveness-analyzed", order: 3, isTerminal: false }),
  "opportunities-identified": Object.freeze({ state: "opportunities-identified", order: 4, isTerminal: false }),
  "opportunities-prioritized": Object.freeze({ state: "opportunities-prioritized", order: 5, isTerminal: false }),
  "output-validated": Object.freeze({ state: "output-validated", order: 6, isTerminal: false }),
  "output-qualified": Object.freeze({ state: "output-qualified", order: 7, isTerminal: false }),
  "review-eligible": Object.freeze({ state: "review-eligible", order: 8, isTerminal: false }),
  closed: Object.freeze({ state: "closed", order: 9, isTerminal: true }),
  escalated: Object.freeze({ state: "escalated", order: 10, isTerminal: true }),
});

export type OptimizationAnalysisId = OrganizationId;
export type OptimizationOpportunityId = OrganizationId;
export type OptimizationPriorityId = OrganizationId;

/**
 * The read-only, attributable set of Phase 44 learnings and governed memory evidence
 * that optimization analysis derives from. Each reference preserves its source
 * identity, ownership, and provenance; optimization never mutates or absorbs them.
 */
export interface OptimizationBasis {
  readonly learnings: readonly OrganizationLearningId[];
  readonly evidence: readonly EvidenceReference[];
}

/** An explicitly stated thing an opportunity does not know or cannot yet resolve. */
export interface OptimizationUncertainty {
  readonly statement: OrganizationStatement;
}

/**
 * The preserved attribution and version of an optimization artifact, maintained
 * independently of memory, knowledge, and learning provenance. Version is an ordinal
 * revision counter, not a clock.
 */
export interface OptimizationProvenance {
  readonly attributedTo: OrganizationStatement;
  readonly version: number;
}

/**
 * An attributable evaluation of organizational effectiveness and inefficiency within a
 * domain, derived read-only from its basis. It is never truth, canonical fact, or a
 * Decision.
 */
export interface OptimizationEffectivenessAnalysis {
  readonly analysisId: OptimizationAnalysisId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly basis: OptimizationBasis;
  readonly provenance: OptimizationProvenance;
}

/**
 * An attributable, scope-bound, uncertainty-preserving possibility for organizational
 * improvement, derived from an eligible effectiveness analysis. It is never a Decision,
 * Approval, command, Work change, or execution artifact.
 */
export interface OptimizationOpportunity {
  readonly opportunityId: OptimizationOpportunityId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly derivedFrom: OptimizationAnalysisId;
  readonly basis: OptimizationBasis;
  readonly uncertainties: readonly OptimizationUncertainty[];
}

/**
 * A bounded analytic ranking of one opportunity for eligible Human and Director
 * consideration. The rank is a DECLARED ordinal, never a computed score; it is never
 * Program IV Work prioritization, a Decision, Approval, or obligation.
 */
export interface OptimizationPriority {
  readonly priorityId: OptimizationPriorityId;
  readonly opportunityId: OptimizationOpportunityId;
  readonly rank: number;
}

/**
 * The bounded description of one optimization context: its purpose, the scope it is
 * confined to, the organization it concerns, and the effectiveness analyses,
 * opportunities, and analytic priorities within it. Contract shape only — it analyzes
 * none of these and computes no ranking.
 */
export interface OptimizationContext {
  readonly organizationId: OrganizationId;
  readonly purpose: OrganizationStatement;
  readonly scope: OrganizationScope;
  readonly analyses: readonly OptimizationEffectivenessAnalysis[];
  readonly opportunities: readonly OptimizationOpportunity[];
  readonly priorities: readonly OptimizationPriority[];
}

/**
 * An optimization context that has passed through optimization normalization: analyses,
 * opportunities, and priorities de-duplicated and canonically ordered, each basis and
 * uncertainty canonicalized. Structurally an {@link OptimizationContext}; the alias
 * marks that canonical form has been applied.
 */
export type CanonicalOptimizationContext = OptimizationContext;
