/**
 * Heby Core — grounding contracts (Phase 4, Grounding and Anti-Hallucination).
 *
 * Declares what grounding IS: the shapes through which Heby verifies, uniformly across all
 * presentation kinds, that every presented element traces to a SETTLED admitted source —
 * and withholds or clearly marks anything unsupported. Phase 4 is the cross-cutting defense
 * against invention and hallucination. It BINDS and VALIDATES references; it generates no
 * content.
 *
 * Grounding here is evidence/reference binding and validation ONLY. It is never independent
 * reasoning, semantic invention, fact generation, web research, retrieval orchestration,
 * autonomous RAG, AI inference, confidence inflation, recommendation generation, or decision
 * generation. A grounded statement is traceable to admitted, settled, eligible upstream
 * material; anything missing, dangling, unsettled, ineligible, or protected fails closed and
 * is withheld — never dressed as grounded, and never satisfied by invented evidence.
 * Grounding alters no meaning: statements, confidence, uncertainty, provenance, and source
 * identity are carried UNCHANGED. There is no engine, no algorithm, no persistence, no AI,
 * no agent, no registry, no cache, no scheduler, no API, and no UI here — only immutable,
 * readonly declarations.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Input and Context), Phase 3 (Presentation).
 */

import type { HebyId } from "@/features/heby-core/heby-identity-types";
import type { HebyAdmittedInput, HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type {
  HebyExplanationEntry,
  HebyPresentation,
  HebyPresentationElement,
} from "@/features/heby-core/heby-presentation-types";

// --- Grounding status --------------------------------------------------------

/**
 * The grounding status of one presented element: "grounded" when it traces to a settled
 * admitted source, "withheld" when it does not. An element is never presented as grounded
 * without a settled-source trace. Naming only.
 */
export type HebyGroundingStatus = "grounded" | "withheld";

/** The fixed, canonical properties of one grounding status. */
export interface HebyGroundingStatusDescriptor {
  readonly status: HebyGroundingStatus;
  /** A fixed integer for canonical listing. Ordinal only — not a rank or score. */
  readonly order: number;
  /** Whether an element with this status may appear in the grounded set. */
  readonly grounded: boolean;
}

/** The canonical descriptor for every grounding status. Frozen and immutable. */
export const HEBY_GROUNDING_STATUS_DESCRIPTORS: Readonly<
  Record<HebyGroundingStatus, HebyGroundingStatusDescriptor>
> = Object.freeze({
  grounded: Object.freeze({ status: "grounded", order: 0, grounded: true }),
  withheld: Object.freeze({ status: "withheld", order: 1, grounded: false }),
});

// --- Withhold reasons --------------------------------------------------------

/**
 * The fail-closed reason an element is withheld from the grounded set. Every reason is an
 * explicit grounding failure — never a judgement of quality, priority, or worth.
 */
export type HebyWithholdReason =
  | "no-basis"
  | "dangling-reference"
  | "unsettled-source"
  | "ineligible-source"
  | "protected";

/** The fixed, canonical properties of one withhold reason. */
export interface HebyWithholdReasonDescriptor {
  readonly reason: HebyWithholdReason;
  /** A fixed integer for canonical ordering. Ordinal only — not a rank. */
  readonly order: number;
  /** A short, fixed statement of the failure. Descriptive only. */
  readonly statement: HebyId;
}

/** The canonical descriptor for every withhold reason. Frozen and immutable. */
export const HEBY_WITHHOLD_REASON_DESCRIPTORS: Readonly<
  Record<HebyWithholdReason, HebyWithholdReasonDescriptor>
> = Object.freeze({
  "no-basis": Object.freeze({ reason: "no-basis", order: 0, statement: "the element declares no evidence basis" }),
  "dangling-reference": Object.freeze({ reason: "dangling-reference", order: 1, statement: "an evidence reference resolves to no admitted input" }),
  "unsettled-source": Object.freeze({ reason: "unsettled-source", order: 2, statement: "an evidence reference resolves to a non-settled source" }),
  "ineligible-source": Object.freeze({ reason: "ineligible-source", order: 3, statement: "an evidence reference resolves to an ineligible source" }),
  protected: Object.freeze({ reason: "protected", order: 4, statement: "the element is protected and must never be exposed" }),
});

// --- Grounding trace ---------------------------------------------------------

/**
 * The settled-source trace of one grounded element: the element it grounds, and the
 * ordered, de-duplicated settled admitted-input identities that support it. A grounded
 * element always carries a non-empty trace — the proof that it was presented only with a
 * settled-source trace.
 */
export interface HebyGroundingTrace {
  readonly elementId: HebyId;
  readonly settledSourceRefs: readonly HebyId[];
}

/**
 * One withheld element: the element itself, carried UNCHANGED, and the fail-closed reason
 * it is not grounded. Clearly marked — never presented as grounded, never silently dropped.
 */
export interface HebyWithheldElement {
  readonly element: HebyPresentationElement;
  readonly reason: HebyWithholdReason;
}

// --- Grounding request / output ----------------------------------------------

/**
 * The declared request for one grounding pass: the Phase 3 presentation to ground (which
 * already carries its admitted inputs, bound context, elements, and explanation). A request
 * declares intent — grounding happens only through validation at the boundary.
 */
export interface HebyGroundingRequest {
  readonly presentation: HebyPresentation;
}

/**
 * The deliverable of Phase 4: a uniformly grounded presentation — its identity and bound
 * context carried UNCHANGED, the settled admitted inputs it carries, the grounded elements
 * (each with a settled-source trace), the withheld elements (each clearly marked with its
 * fail-closed reason), and the grounded explanation entries. It generates no content, alters
 * no meaning, and remains attributable, scope-bound, and non-authoritative.
 */
export interface HebyGroundedPresentation {
  readonly presentationId: HebyId;
  readonly requestId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly inputs: readonly HebyAdmittedInput[];
  readonly groundedElements: readonly HebyPresentationElement[];
  readonly traces: readonly HebyGroundingTrace[];
  readonly withheld: readonly HebyWithheldElement[];
  readonly explanation: readonly HebyExplanationEntry[];
}

/**
 * A grounded presentation that has passed through grounding normalization: grounded
 * elements canonically ordered, traces ordered and de-duplicated, withheld elements ordered
 * by reason then identity, explanation ordered by facet, inputs and context canonicalized,
 * and the whole grounded presentation deep-frozen. Structurally a
 * {@link HebyGroundedPresentation}; the alias marks that canonical form has been applied.
 */
export type CanonicalHebyGroundedPresentation = HebyGroundedPresentation;
