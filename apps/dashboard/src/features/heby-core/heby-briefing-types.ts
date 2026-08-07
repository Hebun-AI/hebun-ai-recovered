/**
 * Heby Core — briefing contracts (Phase 8, Director Briefing and Interaction Surface).
 *
 * Declares what a Director briefing IS: the shapes through which Heby, at the human-facing
 * terminus, ASSEMBLES the Phase 7 gated presentation and the Runtime-sourced briefing material
 * into a Director-facing advisory presentation — grounded evidence, reasoning, risk, opportunity,
 * options, and uncertainty as advisory FINDINGS (never an approval), prior material as immutable
 * history, carried human questions and recorded human decisions across the human boundary WITHOUT
 * resolving them, a full audit trail, and a termination at the Director Approval boundary.
 *
 * Phase 8 ASSEMBLES, CARRIES, and TERMINATES ONLY. It decides nothing, approves nothing, rejects
 * nothing, resolves no human decision, and never advances past the Director. It invents no fact,
 * evidence, or causality, fabricates no confidence, suppresses no uncertainty, fabricates no
 * prior state, and never designs a UI, executes, triggers a workflow, orchestrates, calls a
 * model, trusts model output, mutates any upstream system, waives Governance, reinterprets
 * Security, invokes an API, or bypasses the Director. Previous and current material are immutable
 * evidence; a recorded decision is immutable except by ATTRIBUTABLE supersession; missing history
 * fails closed, never fabricated. A finding is never an approval. There is no engine, no
 * algorithm, no persistence, no AI, no agent, no registry, no cache, no scheduler, no API, and
 * no UI here — only immutable, readonly declarations.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3 (Presentation), Phase 6
 * (Approval Preparation), and Phase 7 (Governance and Security Constraint Enforcement).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyConstraint, HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyDirectorTermination, HebyPreparedItem } from "@/features/heby-core/heby-approval-types";
import type { HebyGatedPresentation, HebyGovernanceScope } from "@/features/heby-core/heby-governance-types";

// --- Briefing section --------------------------------------------------------

/**
 * The advisory section a briefing finding belongs to. Every section is a FINDING — evidence,
 * reasoning, risk, opportunity, option, or uncertainty. None is an approval or a decision: a
 * presented finding is never an approval. Naming and category only — a section confers no
 * authority.
 */
export type HebyBriefingSection =
  | "evidence"
  | "reasoning"
  | "risk"
  | "opportunity"
  | "option"
  | "uncertainty";

/** The fixed, canonical properties of one briefing section. */
export interface HebyBriefingSectionDescriptor {
  readonly section: HebyBriefingSection;
  /** A fixed integer for canonical section ordering. Ordinal only — not a rank or priority. */
  readonly order: number;
  /** A short, fixed statement of the section. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every briefing section. Frozen and immutable. */
export const HEBY_BRIEFING_SECTION_DESCRIPTORS: Readonly<
  Record<HebyBriefingSection, HebyBriefingSectionDescriptor>
> = Object.freeze({
  evidence: Object.freeze({ section: "evidence", order: 0, statement: "grounded evidence, presented as the systems produced it" }),
  reasoning: Object.freeze({ section: "reasoning", order: 1, statement: "the reasoning the material rests on" }),
  risk: Object.freeze({ section: "risk", order: 2, statement: "a surfaced risk, carried from upstream" }),
  opportunity: Object.freeze({ section: "opportunity", order: 3, statement: "a surfaced opportunity, carried from upstream" }),
  option: Object.freeze({ section: "option", order: 4, statement: "an available option, never a decision" }),
  uncertainty: Object.freeze({ section: "uncertainty", order: 5, statement: "the uncertainty that remains, preserved" }),
});

// --- Audit subject kind ------------------------------------------------------

/** What one audit-trail entry attributes. Naming only — the audit records, it never decides. */
export type HebyAuditSubjectKind = "element" | "item" | "finding" | "history" | "question" | "decision";

/** The fixed, canonical properties of one audit subject kind. */
export interface HebyAuditSubjectKindDescriptor {
  readonly subjectKind: HebyAuditSubjectKind;
  /** A fixed integer for canonical listing. Ordinal only — not a rank. */
  readonly order: number;
}

/** The canonical descriptor for every audit subject kind. Frozen and immutable. */
export const HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS: Readonly<
  Record<HebyAuditSubjectKind, HebyAuditSubjectKindDescriptor>
> = Object.freeze({
  element: Object.freeze({ subjectKind: "element", order: 0 }),
  item: Object.freeze({ subjectKind: "item", order: 1 }),
  finding: Object.freeze({ subjectKind: "finding", order: 2 }),
  history: Object.freeze({ subjectKind: "history", order: 3 }),
  question: Object.freeze({ subjectKind: "question", order: 4 }),
  decision: Object.freeze({ subjectKind: "decision", order: 5 }),
});

// --- Finding / history / question / decision / audit -------------------------

/**
 * One advisory briefing finding: its identity, its section, the carried statement, the admitted
 * elements it rests on (attribution — never empty, never a blocked element), and the source
 * references behind it. A finding is advisory — never an approval, never a decision.
 */
export interface HebyBriefingFinding {
  readonly findingId: HebyId;
  readonly section: HebyBriefingSection;
  readonly statement: HebyStatement;
  readonly subjectRefs: readonly HebyId[];
  readonly sourceRefs: readonly HebyId[];
}

/**
 * One history entry: prior material carried as IMMUTABLE evidence. It names the prior reference
 * it carries (never fabricated — a missing prior fails closed), its carried statement, and the
 * admitted elements it concerns. Heby infers no causality from change; it carries what upstream
 * recorded.
 */
export interface HebyBriefingHistory {
  readonly historyId: HebyId;
  readonly priorRef: HebyId;
  readonly statement: HebyStatement;
  readonly subjectRefs: readonly HebyId[];
}

/**
 * One human question carried across the human boundary — UNRESOLVED. It carries the person's
 * question and the admitted elements it concerns. Carrying a question is not answering it.
 */
export interface HebyCarriedQuestion {
  readonly questionId: HebyId;
  readonly question: HebyStatement;
  readonly subjectRefs: readonly HebyId[];
}

/**
 * One recorded human decision carried across the human boundary — NOT resolved by Heby. It
 * carries the human's opaque recorded state (Heby never sets or rewrites it), the admitted
 * elements that form its basis, and — when it supersedes a prior decision — the attributable
 * reference to that prior decision. A recorded decision is immutable except by attributable
 * supersession.
 */
export interface HebyRecordedDecision {
  readonly decisionId: HebyId;
  readonly recordedState: HebyStatement;
  readonly basisRefs: readonly HebyId[];
  readonly supersedesRef: HebyId | null;
}

/** One audit-trail entry: what it attributes and its identity. Built by Heby, never inventive. */
export interface HebyAuditEntry {
  readonly subjectKind: HebyAuditSubjectKind;
  readonly subjectId: HebyId;
}

// --- Briefing request / assembled output -------------------------------------

/**
 * The declared request for one briefing assembly: Heby's canonical identity, the Phase 7 gated
 * presentation (its admitted elements and items, bound context, scope, and immutable
 * constraints), and the Runtime-sourced briefing material — advisory findings, prior history,
 * carried questions, and recorded decisions. A request declares intent — nothing is assembled
 * until it passes validation at the boundary.
 */
export interface HebyBriefingRequest {
  readonly identity: CanonicalHebyIdentity;
  readonly gated: HebyGatedPresentation;
  readonly findings: readonly HebyBriefingFinding[];
  readonly history: readonly HebyBriefingHistory[];
  readonly questions: readonly HebyCarriedQuestion[];
  readonly decisions: readonly HebyRecordedDecision[];
}

/**
 * The deliverable of Phase 8: a Director-facing advisory briefing awaiting a human decision,
 * fully attributable — the presentation and intent it derives from, the isolation scope, the
 * bound context and immutable constraints carried UNCHANGED, the admitted elements and items
 * carried UNCHANGED, the advisory findings by section, the immutable history, the carried
 * questions and recorded decisions, the full audit trail Heby assembled over every carried
 * subject, and the termination at the Director Approval boundary. It decides nothing, approves
 * nothing, and carries no authority of its own.
 */
export interface HebyDirectorBriefing {
  readonly presentationId: HebyId;
  readonly intentId: HebyId;
  readonly scope: HebyGovernanceScope;
  readonly context: HebyDeclaredContext;
  readonly constraints: readonly HebyConstraint[];
  readonly elements: readonly HebyPresentationElement[];
  readonly items: readonly HebyPreparedItem[];
  readonly findings: readonly HebyBriefingFinding[];
  readonly history: readonly HebyBriefingHistory[];
  readonly questions: readonly HebyCarriedQuestion[];
  readonly decisions: readonly HebyRecordedDecision[];
  readonly audit: readonly HebyAuditEntry[];
  readonly termination: HebyDirectorTermination;
}

/**
 * A Director briefing that has passed through briefing normalization: elements, items, findings,
 * history, questions, decisions, audit, and constraints each de-duplicated and canonically
 * ordered (arrangement only), the bound context canonicalized, the scope and termination frozen,
 * and the whole briefing deep-frozen. Structurally a {@link HebyDirectorBriefing}; the alias
 * marks that canonical form has been applied.
 */
export type CanonicalHebyDirectorBriefing = HebyDirectorBriefing;
