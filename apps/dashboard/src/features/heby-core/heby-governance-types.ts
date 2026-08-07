/**
 * Heby Core — governance contracts (Phase 7, Governance and Security Constraint Enforcement).
 *
 * Declares what the Governance Constraint Holder and a gated presentation ARE: the shapes
 * through which Heby holds the applicable Governance and Security constraints IMMUTABLE
 * (consume-only) and GATES the rendered surface — the Phase 4 grounded elements and the Phase 6
 * prepared items — blocking anything that would cross a tenant or organization boundary, rest
 * on ineligible or unresolved evidence, or expose a protected element, and RECORDING every
 * block. It enforces isolation, evidence eligibility, classification, and no-secret-exposure
 * across all presentation.
 *
 * Phase 7 HOLDS and GATES ONLY. It never approves, waives, authors, or reinterprets a
 * constraint; never decides, rejects, resolves a decision, or advances past the Director; never
 * executes, triggers a workflow, orchestrates, calls a model, trusts model output, invents,
 * fabricates confidence, suppresses uncertainty, exposes a secret, mutates any upstream system,
 * invokes an API, or bypasses the Director. It does NOT trust upstream conclusions: even an
 * element another phase treated as clean is independently re-checked here — defense-in-depth,
 * fail-closed. Constraints are carried UNCHANGED; classification rides every admitted element.
 * There is no engine, no algorithm, no persistence, no AI, no agent, no registry, no cache, no
 * scheduler, no API, and no UI here — only immutable, readonly declarations.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Input and Context), Phase 3 (Presentation),
 * Phase 4 (Grounding), Phase 5 (Intent), and Phase 6 (Approval Preparation).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyConstraint, HebyConstraintKind, HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";
import type { HebyPreparedApproval, HebyPreparedItem } from "@/features/heby-core/heby-approval-types";

// --- Subject kind ------------------------------------------------------------

/**
 * What a governance block is recorded against: the whole "presentation" (an isolation failure
 * stops the entire surface), a single rendered "element", or a prepared "item". Naming only.
 */
export type HebyGovernanceSubjectKind = "presentation" | "element" | "item";

/** The fixed, canonical properties of one governance subject kind. */
export interface HebyGovernanceSubjectKindDescriptor {
  readonly subjectKind: HebyGovernanceSubjectKind;
  /** A fixed integer for canonical listing. Ordinal only — not a rank. */
  readonly order: number;
  /** A short, fixed statement of the subject kind. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every governance subject kind. Frozen and immutable. */
export const HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS: Readonly<
  Record<HebyGovernanceSubjectKind, HebyGovernanceSubjectKindDescriptor>
> = Object.freeze({
  presentation: Object.freeze({ subjectKind: "presentation", order: 0, statement: "the whole rendered surface" }),
  element: Object.freeze({ subjectKind: "element", order: 1, statement: "a single rendered element" }),
  item: Object.freeze({ subjectKind: "item", order: 2, statement: "a single prepared item" }),
});

// --- Block reason ------------------------------------------------------------

/**
 * The fail-closed reason a subject is blocked from presentation. Every reason is an explicit
 * Governance or Security violation — never a judgement of quality, priority, or worth. Each
 * reason names the constraint kind it enforces so the block records what was violated.
 */
export type HebyGovernanceBlockReason =
  | "cross-tenant"
  | "cross-organization"
  | "protected-classification"
  | "ineligible-evidence"
  | "unresolved-evidence"
  | "blocked-subject";

/** The fixed, canonical properties of one governance block reason. */
export interface HebyGovernanceBlockReasonDescriptor {
  readonly reason: HebyGovernanceBlockReason;
  /** A fixed integer for canonical ordering. Ordinal only — not a rank. */
  readonly order: number;
  /** The constraint kind this reason enforces. Recorded on every block. */
  readonly constraintKind: HebyConstraintKind;
  /** A short, fixed statement of the violation. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every governance block reason. Frozen and immutable. */
export const HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS: Readonly<
  Record<HebyGovernanceBlockReason, HebyGovernanceBlockReasonDescriptor>
> = Object.freeze({
  "cross-tenant": Object.freeze({ reason: "cross-tenant", order: 0, constraintKind: "security", statement: "the surface crosses a tenant boundary" }),
  "cross-organization": Object.freeze({ reason: "cross-organization", order: 1, constraintKind: "security", statement: "the surface crosses an organization boundary" }),
  "protected-classification": Object.freeze({ reason: "protected-classification", order: 2, constraintKind: "classification", statement: "a rendered element is protected and must never be exposed" }),
  "ineligible-evidence": Object.freeze({ reason: "ineligible-evidence", order: 3, constraintKind: "governance", statement: "a rendered element rests on evidence a governed source marked ineligible" }),
  "unresolved-evidence": Object.freeze({ reason: "unresolved-evidence", order: 4, constraintKind: "governance", statement: "a rendered element rests on evidence that resolves to no admitted input" }),
  "blocked-subject": Object.freeze({ reason: "blocked-subject", order: 5, constraintKind: "governance", statement: "a prepared item rests on a blocked element" }),
});

// --- Governance scope --------------------------------------------------------

/**
 * The isolation identity the gate enforces against: the tenant and organization the declared
 * context binds. Every consumed surface must declare the same scope — a mismatch is a
 * cross-tenant or cross-organization leakage and stops the whole presentation.
 */
export interface HebyGovernanceScope {
  readonly tenantId: HebyId;
  readonly organizationId: HebyId;
}

// --- Governance block --------------------------------------------------------

/**
 * One recorded governance block: what it is recorded against, its identity, the fail-closed
 * reason, and the constraint kind that reason enforces. A block is a record — it stops a
 * subject from presentation, it never approves, waives, or authors anything.
 */
export interface HebyGovernanceBlock {
  readonly subjectKind: HebyGovernanceSubjectKind;
  readonly subjectId: HebyId;
  readonly reason: HebyGovernanceBlockReason;
  readonly constraintKind: HebyConstraintKind;
}

// --- Gate request / gated output ---------------------------------------------

/**
 * The declared request for one governance gate pass: Heby's canonical identity, the Phase 4
 * grounded presentation (its bound context, admitted inputs, and grounded elements — the
 * rendered surface), and the Phase 6 prepared approval (its prepared items). A request declares
 * intent — nothing is gated until it passes structural validation at the boundary.
 */
export interface HebyGovernanceGateRequest {
  readonly identity: CanonicalHebyIdentity;
  readonly grounded: HebyGroundedPresentation;
  readonly prepared: HebyPreparedApproval;
}

/**
 * The deliverable of Phase 7: a gated presentation — the presentation and intent it derives
 * from, the isolation scope it is bound to, the bound context carried UNCHANGED, the applicable
 * constraints held IMMUTABLE (consume-only), the admitted elements and items that passed every
 * gate (each still carrying its classification), and the recorded blocks. On an isolation
 * failure the whole surface is stopped — admitted sets are empty and a presentation-level block
 * is recorded. It approves nothing, waives nothing, authors nothing, and carries no authority.
 */
export interface HebyGatedPresentation {
  readonly presentationId: HebyId;
  readonly intentId: HebyId;
  readonly scope: HebyGovernanceScope;
  readonly context: HebyDeclaredContext;
  readonly constraints: readonly HebyConstraint[];
  readonly admittedElements: readonly HebyPresentationElement[];
  readonly admittedItems: readonly HebyPreparedItem[];
  readonly blocks: readonly HebyGovernanceBlock[];
}

/**
 * A gated presentation that has passed through governance normalization: admitted elements
 * ordered by kind then identity, admitted items ordered by kind then identity, blocks ordered
 * by subject kind then reason then identity, constraints de-duplicated and ordered, the bound
 * context canonicalized, the scope frozen, and the whole gated presentation deep-frozen.
 * Structurally a {@link HebyGatedPresentation}; the alias marks that canonical form has been
 * applied.
 */
export type CanonicalHebyGatedPresentation = HebyGatedPresentation;
