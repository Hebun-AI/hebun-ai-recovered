/**
 * Enterprise Memory Reasoning — explainability type descriptors (Phase 6).
 *
 * Declares what an explanation IS: the kinds of reasoning artifact an explanation
 * can present, the reference kinds each explanation kind's steps may cite, and the
 * shapes of an explanation subject, reference, step, chain, and record. This is
 * canonical, immutable declarative data — lookup tables and contract shapes, not an
 * engine. There is NO explanation generation, NO reasoning, NO inference, and NO
 * understanding here. An explanation carries human-authored legible statements that
 * memory and the earlier phases already produced; this phase never composes prose.
 *
 * Phase 6 consumes the provenance-carrying artifacts of Phases 2–5 and defines how
 * they are presented legibly. It creates no new conclusions and mutates nothing.
 */

/**
 * The kinds of thing an explanation can present. One per reasoning artifact type,
 * plus the provenance chain itself — the six legible surfaces of understanding.
 */
export type ExplanationKind =
  | "evidence"
  | "relation"
  | "implication"
  | "contradiction"
  | "gap"
  | "provenance";

/**
 * The kinds of reasoning-graph artifact an explanation step may cite as its basis.
 * These point back into the graph (never at another explanation), so a human can
 * walk each step to the memory and derivations that support it.
 */
export type ExplanationReferenceKind =
  | "evidence"
  | "relation"
  | "implication"
  | "contradiction"
  | "gap";

/** The fixed, canonical properties of an explanation kind. */
export interface ExplanationKindDescriptor {
  readonly explanationKind: ExplanationKind;
  /** Whether this kind presents memory directly (evidence) rather than a derivation. */
  readonly isGrounded: boolean;
  /** The reference kinds this kind's steps may legitimately cite. */
  readonly permittedReferenceKinds: readonly ExplanationReferenceKind[];
  /** Whether the walk must reach at least one evidence (memory) reference. */
  readonly requiresEvidenceRoot: boolean;
}

/**
 * The canonical descriptor for every explanation kind. Frozen and immutable.
 * Permitted reference kinds mirror the real Phase 2–5 dependency structure, so an
 * explanation may only cite what the artifact it presents could itself rest on:
 *   - evidence:      evidence                                             (grounded)
 *   - relation:      evidence
 *   - implication:   evidence, relation
 *   - contradiction: evidence, relation, implication
 *   - gap:           evidence, relation, implication, contradiction
 *   - provenance:    evidence, relation, implication, contradiction, gap
 * Every kind must reach an evidence root so no explained conclusion floats free of
 * memory; for an evidence explanation the root it cites IS the memory it presents.
 */
export const EXPLANATION_KIND_DESCRIPTORS: Readonly<Record<ExplanationKind, ExplanationKindDescriptor>> =
  Object.freeze({
    evidence: Object.freeze({
      explanationKind: "evidence",
      isGrounded: true,
      permittedReferenceKinds: Object.freeze(["evidence"] as const),
      requiresEvidenceRoot: true,
    }),
    relation: Object.freeze({
      explanationKind: "relation",
      isGrounded: false,
      permittedReferenceKinds: Object.freeze(["evidence"] as const),
      requiresEvidenceRoot: true,
    }),
    implication: Object.freeze({
      explanationKind: "implication",
      isGrounded: false,
      permittedReferenceKinds: Object.freeze(["evidence", "relation"] as const),
      requiresEvidenceRoot: true,
    }),
    contradiction: Object.freeze({
      explanationKind: "contradiction",
      isGrounded: false,
      permittedReferenceKinds: Object.freeze(["evidence", "relation", "implication"] as const),
      requiresEvidenceRoot: true,
    }),
    gap: Object.freeze({
      explanationKind: "gap",
      isGrounded: false,
      permittedReferenceKinds: Object.freeze(["evidence", "relation", "implication", "contradiction"] as const),
      requiresEvidenceRoot: true,
    }),
    provenance: Object.freeze({
      explanationKind: "provenance",
      isGrounded: false,
      permittedReferenceKinds: Object.freeze([
        "evidence",
        "relation",
        "implication",
        "contradiction",
        "gap",
      ] as const),
      requiresEvidenceRoot: true,
    }),
  });

/**
 * What an explanation is about. `subjectId` is the canonical evidence key for an
 * evidence subject, or the artifact id for any other kind (for a provenance subject
 * it is the id of the artifact whose chain is being explained).
 */
export interface ExplanationSubject {
  readonly subjectKind: ExplanationKind;
  readonly subjectId: string;
}

/**
 * One immutable pointer, cited by a step, into the reasoning graph. `referenceId`
 * is the canonical evidence key for an evidence reference, or the artifact id for a
 * derived reference.
 */
export interface ExplanationReference {
  readonly referenceKind: ExplanationReferenceKind;
  readonly referenceId: string;
}

/**
 * One legible move in the walk: a human-authored statement together with the basis
 * it rests on. The statement is carried, never generated, by this phase.
 */
export interface ExplanationStep {
  readonly statement: string;
  readonly references: readonly ExplanationReference[];
}

/**
 * The ordered sequence of steps that makes a conclusion walkable. Step order is
 * meaningful — it is the legible path a human follows — and is preserved by
 * canonicalization; only exact-duplicate steps collapse.
 */
export interface ExplanationChain {
  readonly steps: readonly ExplanationStep[];
}

/** A complete explanation: one subject and the walkable chain that presents it. */
export interface Explanation {
  readonly explanationKind: ExplanationKind;
  readonly subject: ExplanationSubject;
  readonly chain: ExplanationChain;
}

/** An explanation that presents a single piece of evidence directly from memory. */
export type EvidenceExplanation = Explanation & { readonly explanationKind: "evidence" };
/** An explanation that presents one relation between memories. */
export type RelationExplanation = Explanation & { readonly explanationKind: "relation" };
/** An explanation that presents one implication and how it follows. */
export type ImplicationExplanation = Explanation & { readonly explanationKind: "implication" };
/** An explanation that presents one contradiction and the tension behind it. */
export type ContradictionExplanation = Explanation & { readonly explanationKind: "contradiction" };
/** An explanation that presents one gap and what it leaves uncovered. */
export type GapExplanation = Explanation & { readonly explanationKind: "gap" };
/** An explanation that walks one artifact's provenance chain back to memory. */
export type ProvenanceExplanation = Explanation & { readonly explanationKind: "provenance" };

/**
 * An explanation that has passed through explainability normalization: references
 * within each step de-duplicated and totally ordered, exact-duplicate steps
 * collapsed, step order otherwise preserved. Structurally an {@link Explanation};
 * the alias marks that canonical form has been applied.
 */
export type CanonicalExplanation = Explanation;

/** A chain's references partitioned by reference kind — the inspectable lineage. */
export interface ExplanationLineage {
  readonly evidence: readonly ExplanationReference[];
  readonly relations: readonly ExplanationReference[];
  readonly implications: readonly ExplanationReference[];
  readonly contradictions: readonly ExplanationReference[];
  readonly gaps: readonly ExplanationReference[];
}
