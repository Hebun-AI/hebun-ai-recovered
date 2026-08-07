/**
 * Heby Core — approval contracts (Phase 6, Approval Preparation and Director Boundary).
 *
 * Declares what a prepared item and the Director boundary ARE: the shapes through which Heby
 * takes a Phase 5 interpreted, grounded intent and PREPARES material for the appropriate human
 * review or approval process — keeping approval-related interaction visibly DISTINCT from
 * advice, stating the consequences a person must understand before confirming, and terminating
 * every path at the Director without implying, standing in for, or performing a decision.
 *
 * Phase 6 PREPARES and TERMINATES ONLY. It approves nothing, decides nothing, rejects nothing,
 * implies no authority, triggers no workflow, and never treats advice as approval or a
 * conversational "approve" as an authoritative act. A prepared item is always pending at the
 * Director: it awaits a human process and can never carry a resolved decision. It calls no
 * model, trusts no model output, invents nothing, mutates no upstream system, invokes no API,
 * and never advances past the human. There is no engine, no algorithm, no persistence, no AI,
 * no agent, no registry, no cache, no scheduler, no API, and no UI here — only immutable,
 * readonly declarations.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3–4 (Presentation,
 * Grounding), and Phase 5 (Intent and Natural-Language Interaction).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";
import type { HebyRoutedIntent } from "@/features/heby-core/heby-intent-types";

// --- Preparation kind --------------------------------------------------------

/**
 * The kind of prepared item: "advice" is advisory material and is NEVER an approval;
 * "review" is prepared for a human review process; "approval" is prepared for a human approval
 * process, awaiting the Director. The kind is the visible distinction that keeps advice from
 * ever being mistaken for approval. Naming and category only — a kind confers no authority and
 * performs no review or approval.
 */
export type HebyPreparationKind = "advice" | "review" | "approval";

/** The fixed, canonical properties of one preparation kind. */
export interface HebyPreparationKindDescriptor {
  readonly kind: HebyPreparationKind;
  /** A fixed integer for canonical category ordering. Ordinal only — not a rank or priority. */
  readonly order: number;
  /** Whether this kind is visibly distinct from plain advice (review and approval are). */
  readonly distinctFromAdvice: boolean;
  /** Whether an item of this kind must state consequences before a human confirmation. */
  readonly requiresConsequences: boolean;
  /** A short, fixed statement of the category. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every preparation kind. Frozen and immutable. */
export const HEBY_PREPARATION_KIND_DESCRIPTORS: Readonly<
  Record<HebyPreparationKind, HebyPreparationKindDescriptor>
> = Object.freeze({
  advice: Object.freeze({ kind: "advice", order: 0, distinctFromAdvice: false, requiresConsequences: false, statement: "advisory material, never an approval" }),
  review: Object.freeze({ kind: "review", order: 1, distinctFromAdvice: true, requiresConsequences: true, statement: "prepared for a human review process" }),
  approval: Object.freeze({ kind: "approval", order: 2, distinctFromAdvice: true, requiresConsequences: true, statement: "prepared for a human approval process, awaiting the Director" }),
});

// --- Decision state ----------------------------------------------------------

/**
 * The decision state of a prepared item: "pending" means it awaits a human decision at the
 * Director — the only state Heby may ever produce; "resolved" means a decision has been made,
 * which Heby MUST NEVER manufacture. Modelling "resolved" lets the boundary fail closed if an
 * item ever arrives dressed as a completed decision. Naming only — a state confers no authority.
 */
export type HebyDecisionState = "pending" | "resolved";

/** The fixed, canonical properties of one decision state. */
export interface HebyDecisionStateDescriptor {
  readonly state: HebyDecisionState;
  /** A fixed integer for canonical listing. Ordinal only — not a rank. */
  readonly order: number;
  /** Whether Heby may produce an item in this state. Only a pending item is admissible. */
  readonly admissible: boolean;
}

/** The canonical descriptor for every decision state. Frozen and immutable. */
export const HEBY_DECISION_STATE_DESCRIPTORS: Readonly<
  Record<HebyDecisionState, HebyDecisionStateDescriptor>
> = Object.freeze({
  pending: Object.freeze({ state: "pending", order: 0, admissible: true }),
  resolved: Object.freeze({ state: "resolved", order: 1, admissible: false }),
});

// --- Prepared item -----------------------------------------------------------

/**
 * One prepared item: its identity, its visibly distinct kind, the routed intent it derives
 * from, the grounded element identities it concerns (a subset of the intent's grounded
 * routing — never invented, never ungrounded), its decision state (always pending at the
 * Director), and the consequences a person must understand before confirming. A prepared item
 * is not a decision, not an approval, and not an authority: it is material awaiting a human
 * process.
 */
export interface HebyPreparedItem {
  readonly itemId: HebyId;
  readonly kind: HebyPreparationKind;
  readonly intentId: HebyId;
  readonly subjectRefs: readonly HebyId[];
  readonly decisionState: HebyDecisionState;
  readonly consequences: readonly HebyStatement[];
}

// --- Director boundary -------------------------------------------------------

/**
 * The Director boundary marker carried by every preparation: the authority basis carried
 * UNCHANGED from the bound context (authority remains visible), and the literal fact that the
 * interaction terminates at the Director. The `terminatesAtDirector` field is the literal
 * `true` — a preparation that does not terminate at the human cannot exist.
 */
export interface HebyDirectorTermination {
  readonly authorityBasis: HebyStatement;
  readonly terminatesAtDirector: true;
}

// --- Approval request / prepared output --------------------------------------

/**
 * The declared request for one preparation pass: Heby's canonical identity (its approval
 * philosophy and capability boundary), the Phase 4 grounded presentation (its bound context and
 * grounded elements), the Phase 5 routed intent it prepares from, and the proposed prepared
 * items. A request declares intent — nothing is prepared until it passes validation at the
 * boundary.
 */
export interface HebyApprovalRequest {
  readonly identity: CanonicalHebyIdentity;
  readonly grounded: HebyGroundedPresentation;
  readonly routed: HebyRoutedIntent;
  readonly items: readonly HebyPreparedItem[];
}

/**
 * The deliverable of Phase 6: a prepared approval — the presentation and routed intent it
 * derives from, the bound context it stays within (carried UNCHANGED), the prepared items
 * (each pending at the Director, visibly distinct in kind, grounded in the intent's routing,
 * and consequence-bearing where a human confirmation is required), and the Director boundary
 * that terminates the interaction. It approves nothing, decides nothing, and carries no
 * authority of its own.
 */
export interface HebyPreparedApproval {
  readonly presentationId: HebyId;
  readonly intentId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly items: readonly HebyPreparedItem[];
  readonly termination: HebyDirectorTermination;
}

/**
 * A prepared approval that has passed through approval normalization: prepared items
 * de-duplicated and canonically ordered by kind then identity, each item's subject references
 * and consequences de-duplicated and ordered, the bound context canonicalized, and the whole
 * prepared approval deep-frozen. Structurally a {@link HebyPreparedApproval}; the alias marks
 * that canonical form has been applied.
 */
export type CanonicalHebyPreparedApproval = HebyPreparedApproval;
