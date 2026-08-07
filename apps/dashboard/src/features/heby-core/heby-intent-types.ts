/**
 * Heby Core — intent contracts (Phase 5, Intent and Natural-Language Interaction).
 *
 * Declares what interpreted intent IS: the shapes through which Heby, at the first
 * model-assisted surface, treats a natural-language utterance and a model-shaped
 * interpretation of it as UNTRUSTED PROPOSAL material, and — deterministically, calling no
 * model itself — validates that interpretation and routes it only to grounded, bounded
 * presentation, or turns ambiguity into an explicit clarification rather than an assumption.
 *
 * Phase 5 interprets and routes ONLY. It calls no model, trusts no model output as
 * authority, generates no candidate, reasons as no authority, assumes no ambiguous intent,
 * and never decides, approves, rejects, executes, mutates any upstream system, invokes an
 * API, or bypasses the Director. A model may propose an interpretation; that proposal is
 * data here, admitted only if it maps to a declared Heby capability (never a
 * non-responsibility) and routes only to grounded elements — otherwise it fails closed.
 * There is no engine, no algorithm, no persistence, no AI, no agent, no registry, no cache,
 * no scheduler, no API, and no UI here — only immutable, readonly declarations.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3–4 (Presentation, Grounding).
 */

import type { HebyCapability, HebyId, HebyStatement } from "@/features/heby-core/heby-identity-types";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyDeclaredContext } from "@/features/heby-core/heby-input-context-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";

// --- Interpretation disposition ----------------------------------------------

/**
 * How an interpretation is disposed: "resolved" when the intent maps to a declared Heby
 * capability routed to grounded elements, "clarify" when it is ambiguous and must be asked
 * about rather than assumed. Naming only — a disposition confers no authority.
 */
export type HebyInterpretationDisposition = "resolved" | "clarify";

/** The fixed, canonical properties of one interpretation disposition. */
export interface HebyInterpretationDispositionDescriptor {
  readonly disposition: HebyInterpretationDisposition;
  /** A fixed integer for canonical listing. Ordinal only — not a rank or priority. */
  readonly order: number;
  /** A short, fixed statement of the disposition. Descriptive only. */
  readonly statement: HebyStatement;
}

/** The canonical descriptor for every interpretation disposition. Frozen and immutable. */
export const HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS: Readonly<
  Record<HebyInterpretationDisposition, HebyInterpretationDispositionDescriptor>
> = Object.freeze({
  resolved: Object.freeze({ disposition: "resolved", order: 0, statement: "the intent maps to a declared capability routed to grounded elements" }),
  clarify: Object.freeze({ disposition: "clarify", order: 1, statement: "the intent is ambiguous and must be clarified, never assumed" }),
});

// --- Utterance / clarification -----------------------------------------------

/**
 * One natural-language utterance from a person: its identity and its text. The text is the
 * person's own words, carried UNCHANGED — Heby interprets it, it never rewrites it.
 */
export interface HebyUtterance {
  readonly utteranceId: HebyId;
  readonly text: HebyStatement;
}

/**
 * A clarification Heby asks when intent is ambiguous: the question to put to the person and
 * the reason the intent could not be resolved. A clarification carries no routing and no
 * assumed answer — asking is not assuming.
 */
export interface HebyClarification {
  readonly question: HebyStatement;
  readonly reason: HebyStatement;
}

// --- Proposed (model-shaped, untrusted) intent -------------------------------

/**
 * One model-shaped interpretation proposed for an utterance — UNTRUSTED. It declares a
 * disposition and, when resolved, the declared Heby capability it maps to and the grounded
 * element identities it routes to; when clarify, the clarification to ask. Heby accepts this
 * only through validation: a resolved proposal must map to a capability in Heby's identity
 * (never a non-responsibility) and route only to grounded elements; a clarify proposal must
 * carry no routing. It is never trusted as authority.
 */
export interface HebyProposedIntent {
  readonly intentId: HebyId;
  readonly utteranceId: HebyId;
  readonly disposition: HebyInterpretationDisposition;
  readonly requestedCapability: HebyCapability | null;
  readonly routedElementRefs: readonly HebyId[];
  readonly clarification: HebyClarification | null;
}

// --- Intent request / routed output ------------------------------------------

/**
 * The declared request for one interpretation: Heby's canonical identity (its capability
 * boundary), the Phase 4 grounded presentation the intent is interpreted against (which
 * carries its bound context and grounded elements), the person's utterance, and the
 * untrusted model-shaped proposal. A request declares intent — nothing is routed until it
 * passes validation at the boundary.
 */
export interface HebyIntentRequest {
  readonly identity: CanonicalHebyIdentity;
  readonly grounded: HebyGroundedPresentation;
  readonly utterance: HebyUtterance;
  readonly proposed: HebyProposedIntent;
}

/**
 * The deliverable of Phase 5: an interpreted, bounded intent — its identity, the utterance
 * it interprets, the grounded presentation and bound context it is scoped to, its
 * disposition, and either the declared capability and grounded routing (resolved) or the
 * clarification to ask (clarify). It grants no authority, routes only to grounded elements,
 * and is never a decision, approval, or execution.
 */
export interface HebyRoutedIntent {
  readonly intentId: HebyId;
  readonly utteranceId: HebyId;
  readonly presentationId: HebyId;
  readonly context: HebyDeclaredContext;
  readonly disposition: HebyInterpretationDisposition;
  readonly requestedCapability: HebyCapability | null;
  readonly routedElementRefs: readonly HebyId[];
  readonly clarification: HebyClarification | null;
}

/**
 * A routed intent that has passed through intent normalization: routed element references
 * de-duplicated and canonically ordered, bound context canonicalized, and every other field
 * carried UNCHANGED, with the whole routed intent deep-frozen. Structurally a
 * {@link HebyRoutedIntent}; the alias marks that canonical form has been applied.
 */
export type CanonicalHebyRoutedIntent = HebyRoutedIntent;
