/**
 * Heby Core — presentation and explanation contracts (Phase 3, Presentation and Explanation).
 *
 * Declares what a presentation and an explanation ARE: the shapes through which Heby
 * renders Phase 2 admitted material honestly — composing presentation elements that
 * DISTINGUISH evidence, interpretation, recommendation, uncertainty, and decision, each
 * attributable to admitted inputs and carrying its confidence and marked uncertainty, and
 * a faceted explanation exposing the why / evidence / sources / assumptions / uncertainty /
 * what-changed continuation from the basis the source already carries.
 *
 * Phase 3 renders ONLY. It invents no rationale, exposes no protected information,
 * prescribes no implementation, asserts nothing beyond its declared confidence, and never
 * decides, approves, rejects, reasons, executes, calls a model, invokes an API, mutates any
 * upstream system, or bypasses the Director. There is no engine, no algorithm, no
 * persistence, no AI, no agent, no registry, no cache, no scheduler, no API, and no UI
 * here — only immutable, readonly declarations. Every presented element and every
 * explanation statement remains attributable to Phase 2 admitted inputs.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity) and Phase 2 (Input and Context Consumption).
 */

import type { HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type {
  HebyAdmittedInput,
  HebyContextBinding,
  HebyDeclaredContext,
} from "@/features/heby-core/heby-input-context-types";

// --- Presentation kinds ------------------------------------------------------

/**
 * The five distinguished categories a presentation keeps separate so nothing is mistaken
 * for something it is not: evidence, interpretation, recommendation, uncertainty, and
 * decision. A "decision" element only labels where a Director decision belongs — Heby
 * decides nothing. Naming and category only; a kind confers no authority.
 */
export type HebyPresentationKind =
  | "evidence"
  | "interpretation"
  | "recommendation"
  | "uncertainty"
  | "decision";

/** The fixed, canonical properties of one presentation kind. */
export interface HebyPresentationKindDescriptor {
  readonly kind: HebyPresentationKind;
  /**
   * A fixed integer for canonical category ordering. Ordinal only — a stable display
   * order for grouping. It is NOT a rank, score, priority, or confidence.
   */
  readonly order: number;
  /** A short, fixed statement of the category. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every presentation kind. Frozen and immutable. */
export const HEBY_PRESENTATION_KIND_DESCRIPTORS: Readonly<
  Record<HebyPresentationKind, HebyPresentationKindDescriptor>
> = Object.freeze({
  evidence: Object.freeze({ kind: "evidence", order: 0, statement: "an attributable observation grounded in admitted inputs" }),
  interpretation: Object.freeze({ kind: "interpretation", order: 1, statement: "a reading of the evidence, marked as interpretation" }),
  recommendation: Object.freeze({ kind: "recommendation", order: 2, statement: "an advisory option, never a decision" }),
  uncertainty: Object.freeze({ kind: "uncertainty", order: 3, statement: "a declared limitation or open question" }),
  decision: Object.freeze({ kind: "decision", order: 4, statement: "a Director decision point, labelled and pending — never made by Heby" }),
});

// --- Confidence --------------------------------------------------------------

/**
 * The declared confidence carried with a presented element, sourced from the admitted
 * input's basis. Presentation-only: it is carried and marked, and it NEVER becomes a
 * rank, a permission, or an ordering key for elements.
 */
export type HebyConfidenceLevel = "high" | "moderate" | "low" | "indeterminate";

/** The fixed, canonical properties of one confidence level. */
export interface HebyConfidenceLevelDescriptor {
  readonly level: HebyConfidenceLevel;
  /**
   * A fixed integer for canonical descriptor listing only. It is NEVER used to order,
   * rank, or prioritize presentation elements.
   */
  readonly order: number;
  /** Whether an element at this level must carry marked uncertainty. */
  readonly requiresUncertainty: boolean;
}

/** The canonical descriptor for every confidence level. Frozen and immutable. */
export const HEBY_CONFIDENCE_LEVEL_DESCRIPTORS: Readonly<
  Record<HebyConfidenceLevel, HebyConfidenceLevelDescriptor>
> = Object.freeze({
  high: Object.freeze({ level: "high", order: 0, requiresUncertainty: false }),
  moderate: Object.freeze({ level: "moderate", order: 1, requiresUncertainty: false }),
  low: Object.freeze({ level: "low", order: 2, requiresUncertainty: true }),
  indeterminate: Object.freeze({ level: "indeterminate", order: 3, requiresUncertainty: true }),
});

// --- Element classification --------------------------------------------------

/**
 * Whether an element may be presented. A "protected" element must never be exposed
 * through a presentation; only "presentable" elements pass the boundary. Naming only.
 */
export type HebyElementClassification = "presentable" | "protected";

/** The fixed, canonical properties of one element classification. */
export interface HebyElementClassificationDescriptor {
  readonly classification: HebyElementClassification;
  /** A fixed integer for canonical listing. Ordinal only. */
  readonly order: number;
  /** Whether an element of this classification may be exposed through a presentation. */
  readonly presentable: boolean;
}

/** The canonical descriptor for every element classification. Frozen and immutable. */
export const HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS: Readonly<
  Record<HebyElementClassification, HebyElementClassificationDescriptor>
> = Object.freeze({
  presentable: Object.freeze({ classification: "presentable", order: 0, presentable: true }),
  protected: Object.freeze({ classification: "protected", order: 1, presentable: false }),
});

// --- Explanation facets ------------------------------------------------------

/** The facets of the explanation continuation. Naming and grouping only. */
export type HebyExplanationFacet =
  | "why"
  | "evidence"
  | "sources"
  | "assumptions"
  | "uncertainty"
  | "what-changed";

/** The fixed, canonical properties of one explanation facet. */
export interface HebyExplanationFacetDescriptor {
  readonly facet: HebyExplanationFacet;
  /** A fixed integer for canonical facet ordering. Ordinal only — not a rank. */
  readonly order: number;
  /** A short, fixed statement of the facet. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every explanation facet. Frozen and immutable. */
export const HEBY_EXPLANATION_FACET_DESCRIPTORS: Readonly<
  Record<HebyExplanationFacet, HebyExplanationFacetDescriptor>
> = Object.freeze({
  why: Object.freeze({ facet: "why", order: 0, statement: "why this material is presented" }),
  evidence: Object.freeze({ facet: "evidence", order: 1, statement: "the evidence it rests on" }),
  sources: Object.freeze({ facet: "sources", order: 2, statement: "the admitted sources behind it" }),
  assumptions: Object.freeze({ facet: "assumptions", order: 3, statement: "the assumptions carried" }),
  uncertainty: Object.freeze({ facet: "uncertainty", order: 4, statement: "the uncertainty that remains" }),
  "what-changed": Object.freeze({ facet: "what-changed", order: 5, statement: "what changed since the previous understanding" }),
});

// --- Presentation element ----------------------------------------------------

/**
 * One presented element: its identity, its distinguished kind, the carried statement, the
 * admitted inputs it is grounded in (attribution — never empty), its carried confidence,
 * its marked uncertainty, and its classification. The statement is carried from the
 * admitted basis, never invented. A protected element is never exposed.
 */
export interface HebyPresentationElement {
  readonly elementId: HebyId;
  readonly kind: HebyPresentationKind;
  readonly statement: HebyStatement;
  readonly evidenceRefs: readonly HebyId[];
  readonly confidence: HebyConfidenceLevel;
  readonly uncertainty: readonly HebyStatement[];
  readonly classification: HebyElementClassification;
}

// --- Explanation -------------------------------------------------------------

/**
 * One faceted explanation entry: the facet it answers, its carried statements, and the
 * admitted sources behind it. Statements are carried from the admitted basis, never
 * invented; every source reference is an admitted input identity.
 */
export interface HebyExplanationEntry {
  readonly facet: HebyExplanationFacet;
  readonly statements: readonly HebyStatement[];
  readonly sourceRefs: readonly HebyId[];
}

// --- Presentation request / output -------------------------------------------

/**
 * The declared request for one presentation: an identity, the Phase 2 context binding it
 * renders over (admitted inputs and bound context), the proposed presentation elements,
 * and the proposed explanation entries. A request declares intent — it presents nothing
 * on its own; presentation happens only through validation at the boundary.
 */
export interface HebyPresentationRequest {
  readonly presentationId: HebyId;
  readonly binding: HebyContextBinding;
  readonly elements: readonly HebyPresentationElement[];
  readonly explanation: readonly HebyExplanationEntry[];
}

/**
 * The deliverable of Phase 3: an attributable, scope-bound, non-authoritative
 * presentation — its identity, the request/binding identity it renders, the bound context
 * it stays within, the admitted inputs it carries UNCHANGED (so provenance and source
 * identity travel intact), its distinguished elements, and its faceted explanation. It
 * asserts nothing beyond declared confidence, exposes no protected information, and carries
 * no decision, approval, or authority of its own.
 */
export interface HebyPresentation {
  readonly presentationId: HebyId;
  readonly requestId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly inputs: readonly HebyAdmittedInput[];
  readonly elements: readonly HebyPresentationElement[];
  readonly explanation: readonly HebyExplanationEntry[];
}

/**
 * A presentation that has passed through presentation normalization: elements
 * de-duplicated and canonically ordered by category then identity, explanation entries
 * ordered by facet, references and uncertainty de-duplicated and ordered, statements and
 * confidence carried UNCHANGED, and the whole presentation deep-frozen. Structurally a
 * {@link HebyPresentation}; the alias marks that canonical form has been applied.
 */
export type CanonicalHebyPresentation = HebyPresentation;
