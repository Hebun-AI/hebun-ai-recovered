/**
 * Enterprise Organizational Intelligence — organization learning type descriptors (Phase 3).
 *
 * Declares the canonical contracts of Organizational Learning (Program VIII, Phase 44):
 * the ontology of an attributable organizational learning — its identity, subject,
 * basis, statement, uncertainty, provenance, relationships, lifecycle — and the
 * bounded learning context that holds them. This is canonical, immutable declarative
 * data — lookup tables and contract shapes, not an engine.
 *
 * Organizational Learning identifies and preserves attributable learning about the
 * enterprise from read-only governed evidence and memory references. It is NOT Memory,
 * Knowledge, Evidence, Reasoning, Decision, or Authority. Phase 3 defines contracts
 * ONLY: there is NO learning identification, NO learning generation, NO model, NO
 * algorithm, NO memory admission, NO runtime, NO decision, and NO action here. A
 * learning basis is a read-only pointer into published memory evidence; it is never
 * mutated or redefined. Builds only on OI Phase 1–2 and the published Memory and
 * Reasoning foundations.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";

/** The implementation-independent lifecycle states of an organizational learning. */
export type LearningLifecycleState =
  | "context-declared"
  | "evidence-qualified"
  | "constraints-bound"
  | "identified"
  | "preserved"
  | "validated"
  | "qualified"
  | "review-eligible"
  | "evolved"
  | "superseded"
  | "retired"
  | "closed"
  | "escalated";

/** The fixed, canonical properties of a learning lifecycle state. */
export interface LearningLifecycleStateDescriptor {
  readonly state: LearningLifecycleState;
  /** A fixed integer for canonical ordering. Ordinal only — not a score or progression trigger. */
  readonly order: number;
  /** Whether the state ends the learning's active lifecycle (history preserved). */
  readonly isTerminal: boolean;
}

/**
 * The canonical descriptor for every learning lifecycle state. Frozen and immutable.
 * Order mirrors the constitutional lifecycle; no state advances automatically. The
 * terminal states (superseded, retired, closed, escalated) end active lifecycle while
 * preserving history — they are never rewrites of memory or prior learning.
 */
export const LEARNING_LIFECYCLE_STATE_DESCRIPTORS: Readonly<
  Record<LearningLifecycleState, LearningLifecycleStateDescriptor>
> = Object.freeze({
  "context-declared": Object.freeze({ state: "context-declared", order: 0, isTerminal: false }),
  "evidence-qualified": Object.freeze({ state: "evidence-qualified", order: 1, isTerminal: false }),
  "constraints-bound": Object.freeze({ state: "constraints-bound", order: 2, isTerminal: false }),
  identified: Object.freeze({ state: "identified", order: 3, isTerminal: false }),
  preserved: Object.freeze({ state: "preserved", order: 4, isTerminal: false }),
  validated: Object.freeze({ state: "validated", order: 5, isTerminal: false }),
  qualified: Object.freeze({ state: "qualified", order: 6, isTerminal: false }),
  "review-eligible": Object.freeze({ state: "review-eligible", order: 7, isTerminal: false }),
  evolved: Object.freeze({ state: "evolved", order: 8, isTerminal: false }),
  superseded: Object.freeze({ state: "superseded", order: 9, isTerminal: true }),
  retired: Object.freeze({ state: "retired", order: 10, isTerminal: true }),
  closed: Object.freeze({ state: "closed", order: 11, isTerminal: true }),
  escalated: Object.freeze({ state: "escalated", order: 12, isTerminal: true }),
});

/** The canonical relationships one learning may hold to another. */
export type LearningRelationshipKind = "supersedes" | "contradicts" | "refines";

/** The fixed, canonical properties of a learning relationship kind. */
export interface LearningRelationshipKindDescriptor {
  readonly kind: LearningRelationshipKind;
  /** Whether the relationship holds equally in both directions (contradiction). */
  readonly isSymmetric: boolean;
}

/**
 * The canonical descriptor for every learning relationship kind. Frozen and immutable.
 * Supersession and refinement are directional; contradiction is symmetric.
 */
export const LEARNING_RELATIONSHIP_KIND_DESCRIPTORS: Readonly<
  Record<LearningRelationshipKind, LearningRelationshipKindDescriptor>
> = Object.freeze({
  supersedes: Object.freeze({ kind: "supersedes", isSymmetric: false }),
  contradicts: Object.freeze({ kind: "contradicts", isSymmetric: true }),
  refines: Object.freeze({ kind: "refines", isSymmetric: false }),
});

export type OrganizationLearningId = OrganizationId;

/** The bounded organizational matter a learning concerns, within a declared domain. */
export interface OrganizationLearningSubject {
  readonly subjectId: OrganizationId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
}

/**
 * The read-only, attributable set of governed memory evidence a learning derives from.
 * Each reference preserves its source identity, ownership, and provenance; a learning
 * never mutates or admits memory.
 */
export interface OrganizationLearningBasis {
  readonly evidence: readonly EvidenceReference[];
}

/** An explicitly stated thing a learning does not know or cannot yet resolve. */
export interface OrganizationLearningUncertainty {
  readonly statement: OrganizationStatement;
}

/**
 * The preserved attribution and version of a learning, maintained independently of
 * memory and knowledge provenance. Version is an ordinal revision counter, not a clock.
 */
export interface OrganizationLearningProvenance {
  readonly attributedTo: OrganizationStatement;
  readonly version: number;
}

/**
 * One attributable, scope-bound, provenance-preserving organizational understanding.
 * It is expressed with its uncertainty and never constitutes Memory, Knowledge,
 * Evidence, truth, a Decision, or a command.
 */
export interface OrganizationLearning {
  readonly learningId: OrganizationLearningId;
  readonly subject: OrganizationLearningSubject;
  readonly statement: OrganizationLearningStatement;
  readonly lifecycle: LearningLifecycleState;
  readonly basis: OrganizationLearningBasis;
  readonly provenance: OrganizationLearningProvenance;
  readonly uncertainties: readonly OrganizationLearningUncertainty[];
}

/** The attributable expression of what was learned. Text only. */
export type OrganizationLearningStatement = OrganizationStatement;

/** A directional or symmetric relationship between two declared learnings. */
export interface OrganizationLearningRelationship {
  readonly relationshipId: OrganizationId;
  readonly kind: LearningRelationshipKind;
  readonly from: OrganizationLearningId;
  readonly to: OrganizationLearningId;
}

/**
 * The bounded description of one learning context: its purpose, the scope it is
 * confined to, the organization it concerns, the learnings preserved within it, and
 * the relationships between them. Contract shape only — it declares none of these and
 * identifies no learning.
 */
export interface OrganizationLearningContext {
  readonly organizationId: OrganizationId;
  readonly purpose: OrganizationStatement;
  readonly scope: OrganizationScope;
  readonly learnings: readonly OrganizationLearning[];
  readonly relationships: readonly OrganizationLearningRelationship[];
}

/**
 * A learning context that has passed through learning normalization: learnings and
 * relationships de-duplicated and canonically ordered, each learning's basis and
 * uncertainties canonicalized. Structurally an {@link OrganizationLearningContext};
 * the alias marks that canonical form has been applied.
 */
export type CanonicalOrganizationLearningContext = OrganizationLearningContext;
