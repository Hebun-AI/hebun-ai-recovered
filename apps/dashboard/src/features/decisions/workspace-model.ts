/*
 * decisions/workspace-model.ts — the read model for the Decision & Approval
 * Experience (Hebun UI Phase 14).
 *
 * PROVENANCE CONTRACT (no-fake-data, human-authority-preserving):
 *
 *   This surface answers: what requires human authority, what information supports
 *   the decision, what exactly is being decided, what the consequences are, what the
 *   human decided, and how that decision is recorded.
 *
 *   The ONLY real, Director-safe material available for it is the immutable Heby
 *   Core Phase 6 approval CONTRACT VOCABULARY — the shapes and rules through which a
 *   grounded intent becomes material PREPARED for a human review or approval process
 *   and TERMINATES at the Director. That contract:
 *     - distinguishes advice (never an approval) from review and approval
 *       (HEBY_PREPARATION_KIND_DESCRIPTORS),
 *     - admits only the "pending" decision state and rejects "resolved"
 *       (HEBY_DECISION_STATE_DESCRIPTORS) — Heby may never manufacture a decision,
 *     - requires consequences to be stated before any human confirmation,
 *     - and terminates every path at the Director, implying no authority of its own.
 *
 *   NO real persisted approval REQUEST, decision RECORD, briefing INSTANCE, evidence
 *   INSTANCE, recommendation INSTANCE, consequence INSTANCE, decision HISTORY, or
 *   execution HANDOFF is available to this surface:
 *     - the legacy `/approvals` projection (getDecisionProjection) is a mock,
 *     - features/approvals/mock.ts and features/governance/approvals.ts are seeded,
 *     - human-approval results are derived from EXECUTION SIMULATION, not a persisted
 *       queue,
 *     - the `approvals` DB table is a schema with no live read/write path here,
 *     - Decision-type entries in enterprise memory are seeded organizational memory,
 *       not records of a human decision ACT on this surface.
 *   None of it is surfaced. Every instance region renders an honest, explained empty
 *   state, and the authority chain is presented as STRUCTURAL contract truth only.
 *
 *   No Approve / Reject / Authorize affordance exists: there is no real, safe,
 *   server-authorized decision-mutation path that persists a decision record, so the
 *   act is honestly reported as not connected. This model fabricates no decision,
 *   approval, recommendation, briefing, evidence, consequence, timestamp, deadline,
 *   approver, count, urgency, or history value, and calls no model.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md,
 * src/features/heby-core/heby-approval-types.ts (Phase 6 contracts).
 */

import {
  HEBY_DECISION_STATE_DESCRIPTORS,
  HEBY_PREPARATION_KIND_DESCRIPTORS,
  type HebyDecisionState,
  type HebyPreparationKind,
} from "@/features/heby-core";

/* ---------------------------------------------------------------------------
 * Preparation kinds — the visible distinction that keeps advice from ever being
 * mistaken for an approval. Copied over REAL immutable contract descriptors.
 * ------------------------------------------------------------------------- */

export interface PreparationKindView {
  readonly kind: HebyPreparationKind;
  readonly order: number;
  readonly distinctFromAdvice: boolean;
  readonly requiresConsequences: boolean;
  readonly statement: string;
}

export function getPreparationKinds(): readonly PreparationKindView[] {
  return Object.values(HEBY_PREPARATION_KIND_DESCRIPTORS)
    .map((descriptor) => ({
      kind: descriptor.kind,
      order: descriptor.order,
      distinctFromAdvice: descriptor.distinctFromAdvice,
      requiresConsequences: descriptor.requiresConsequences,
      statement: descriptor.statement,
    }))
    .sort((a, b) => a.order - b.order);
}

/* ---------------------------------------------------------------------------
 * Decision states — only "pending" is admissible; "resolved" is modelled so the
 * boundary fails closed, never so Heby can produce it. Copied over REAL descriptors.
 * ------------------------------------------------------------------------- */

export interface DecisionStateView {
  readonly state: HebyDecisionState;
  readonly order: number;
  /** Whether Heby may ever produce an item in this state. Only "pending" is. */
  readonly admissible: boolean;
  readonly label: string;
  readonly meaning: string;
}

const DECISION_STATE_COPY: Record<HebyDecisionState, { label: string; meaning: string }> = {
  pending: {
    label: "Pending at the Director",
    meaning: "Awaits a human decision. The only state the system may produce.",
  },
  resolved: {
    label: "Resolved by a human",
    meaning: "A decision has been recorded. The system must never manufacture this — it can only arrive from a real human act.",
  },
};

export function getDecisionStates(): readonly DecisionStateView[] {
  return Object.values(HEBY_DECISION_STATE_DESCRIPTORS)
    .map((descriptor) => ({
      state: descriptor.state,
      order: descriptor.order,
      admissible: descriptor.admissible,
      label: DECISION_STATE_COPY[descriptor.state].label,
      meaning: DECISION_STATE_COPY[descriptor.state].meaning,
    }))
    .sort((a, b) => a.order - b.order);
}

/* ---------------------------------------------------------------------------
 * The human-authority chain — the structural path from advisory material to an
 * authorized handoff. Presented as the surface's mental model; every step below
 * "prepared item" has no live instance and is marked accordingly. STRUCTURAL only —
 * no step here executes, decides, or carries authority.
 * ------------------------------------------------------------------------- */

/** Where the ownership of a chain stage lives, for the boundary narrative. */
export type ChainOwner =
  | "Intelligence"
  | "Knowledge"
  | "Heby"
  | "Director"
  | "Decisions"
  | "Governance"
  | "Operations";

export interface AuthorityChainStep {
  readonly order: number;
  readonly label: string;
  readonly describes: string;
  readonly owner: ChainOwner;
  /** True only for the human decision act itself — the point authority is exercised. */
  readonly isHumanAuthority: boolean;
  /** Whether a real live instance can feed this step on this surface today. */
  readonly connected: boolean;
}

const AUTHORITY_CHAIN: readonly AuthorityChainStep[] = [
  { order: 0, label: "Advisory material", describes: "Analysis and candidates. Advisory only — never an approval.", owner: "Intelligence", isHumanAuthority: false, connected: false },
  { order: 1, label: "Recommendation", describes: "A proposed course of action. Still advisory; distinct from a decision.", owner: "Intelligence", isHumanAuthority: false, connected: false },
  { order: 2, label: "Prepared decision item", describes: "Heby prepares grounded material for a human process, stating consequences. Approves nothing.", owner: "Heby", isHumanAuthority: false, connected: false },
  { order: 3, label: "Human review", describes: "The Director reviews evidence, consequences, and authority requirements before acting.", owner: "Director", isHumanAuthority: false, connected: false },
  { order: 4, label: "Human decision", describes: "The Director exercises authority. Only a human may do this — the system never decides.", owner: "Director", isHumanAuthority: true, connected: false },
  { order: 5, label: "Decision record", describes: "An accountable, immutable record of what was decided, by whom, and why.", owner: "Decisions", isHumanAuthority: false, connected: false },
  { order: 6, label: "Authorized handoff", describes: "An authorized outcome may become eligible for Operations. A decision is not execution.", owner: "Operations", isHumanAuthority: false, connected: false },
];

export function getAuthorityChain(): readonly AuthorityChainStep[] {
  return AUTHORITY_CHAIN;
}

/* ---------------------------------------------------------------------------
 * Inspector lenses — the facets a real prepared decision item would be examined
 * through. Instructional only; nothing is selectable because no live item exists.
 * ------------------------------------------------------------------------- */

export interface DecisionLensView {
  readonly facet: string;
  readonly question: string;
}

const INSPECTOR_LENSES: readonly DecisionLensView[] = [
  { facet: "Overview", question: "What exactly is being decided, and why does it need human authority?" },
  { facet: "Evidence", question: "What grounded information supports this decision?" },
  { facet: "Recommendation", question: "What course of action is advised — and is it clearly not the decision?" },
  { facet: "Consequences", question: "What follows from each choice? (Required before any confirmation.)" },
  { facet: "Governance", question: "What policy or authority requirement applies?" },
  { facet: "Authority", question: "Who must decide, and on what basis?" },
  { facet: "History", question: "What was decided before, and did anything supersede it?" },
  { facet: "Handoff", question: "If decided, what becomes eligible for Operations?" },
];

export function getInspectorLenses(): readonly DecisionLensView[] {
  return INSPECTOR_LENSES;
}

/* ---------------------------------------------------------------------------
 * The assembled workspace model. Instance collections are always empty: no real
 * persisted queue, record, briefing, evidence, recommendation, consequence, or
 * history is connected, and none is fabricated.
 * ------------------------------------------------------------------------- */

export interface DecisionWorkspaceModel {
  readonly preparationKinds: readonly PreparationKindView[];
  readonly decisionStates: readonly DecisionStateView[];
  readonly authorityChain: readonly AuthorityChainStep[];
  readonly inspectorLenses: readonly DecisionLensView[];
  /** Live pending human decisions. Always empty: no persisted queue is connected. */
  readonly pendingDecisions: readonly never[];
  /** Recorded decision history. Always empty: no immutable decision record is connected. */
  readonly history: readonly never[];
  /**
   * Whether a real, server-authorized decision-mutation path (persisting a decision
   * record with verified Director identity and enforced governance) is connected.
   * Always false in this phase — the decision act is honestly not connected.
   */
  readonly decisionRecordingConnected: false;
}

/** Build the Decision & Approval Experience model. Pure; fabricates nothing. */
export function getDecisionWorkspaceModel(): DecisionWorkspaceModel {
  return {
    preparationKinds: getPreparationKinds(),
    decisionStates: getDecisionStates(),
    authorityChain: getAuthorityChain(),
    inspectorLenses: getInspectorLenses(),
    pendingDecisions: [],
    history: [],
    decisionRecordingConnected: false,
  };
}
