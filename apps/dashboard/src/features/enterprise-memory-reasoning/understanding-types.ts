/**
 * Enterprise Memory Reasoning — understanding assembly type descriptors (Phase 8).
 *
 * The FINAL phase of the Reasoning Foundation. Declares what an assembled
 * understanding IS: the kinds of published artifact it gathers, the shapes of an
 * understanding subject, scope, reference, chain, summary, basis, context, artifact,
 * and bundle. This is canonical, immutable declarative data — lookup tables and
 * contract shapes, not an engine.
 *
 * This phase ONLY gathers already-published artifacts (evidence, relations,
 * implications, contradictions, gaps, provenance, explanations, confidence) under a
 * single canonical Understanding. It produces NO new reasoning, NO new implication,
 * NO new contradiction, NO new confidence, and NO new explanation. It computes
 * nothing, decides nothing, plans nothing, executes nothing, and mutates nothing —
 * no AI, no LLM, no agent, no memory mutation. It builds only on Phases 1–7.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { Provenance } from "@/features/enterprise-memory-reasoning/provenance-types";
import type { Explanation } from "@/features/enterprise-memory-reasoning/explainability-types";
import type { Confidence } from "@/features/enterprise-memory-reasoning/confidence-types";

/** The kinds of published artifact an understanding gathers, across all prior phases. */
export type UnderstandingArtifactKind =
  | "evidence"
  | "relation"
  | "implication"
  | "contradiction"
  | "gap"
  | "provenance"
  | "explanation"
  | "confidence";

/** The fixed, canonical properties of a gathered artifact kind. */
export interface UnderstandingArtifactDescriptor {
  readonly artifactKind: UnderstandingArtifactKind;
  /** Whether this kind grounds understanding directly in memory (evidence). */
  readonly isGrounding: boolean;
  /** A fixed integer for canonical cross-kind ordering. Ordinal only — not a score. */
  readonly layer: number;
}

/**
 * The canonical descriptor for every gathered artifact kind. Frozen and immutable.
 * Layers give a deterministic cross-kind order that mirrors the phase pipeline:
 * evidence, then relations, implications, contradictions, gaps, then provenance,
 * explanations, and confidence. Evidence alone grounds directly in memory.
 */
export const UNDERSTANDING_ARTIFACT_DESCRIPTORS: Readonly<
  Record<UnderstandingArtifactKind, UnderstandingArtifactDescriptor>
> = Object.freeze({
  evidence: Object.freeze({ artifactKind: "evidence", isGrounding: true, layer: 0 }),
  relation: Object.freeze({ artifactKind: "relation", isGrounding: false, layer: 1 }),
  implication: Object.freeze({ artifactKind: "implication", isGrounding: false, layer: 2 }),
  contradiction: Object.freeze({ artifactKind: "contradiction", isGrounding: false, layer: 3 }),
  gap: Object.freeze({ artifactKind: "gap", isGrounding: false, layer: 4 }),
  provenance: Object.freeze({ artifactKind: "provenance", isGrounding: false, layer: 5 }),
  explanation: Object.freeze({ artifactKind: "explanation", isGrounding: false, layer: 6 }),
  confidence: Object.freeze({ artifactKind: "confidence", isGrounding: false, layer: 7 }),
});

/** The question or goal an assembled understanding answers. Identity only. */
export interface UnderstandingSubject {
  readonly subjectId: string;
}

/** The bounded boundary an understanding covers — never exceeded by assembly. */
export interface UnderstandingScope {
  readonly scopeId: string;
}

/**
 * One immutable pointer to a gathered artifact. `artifactId` is the canonical
 * evidence key, the artifact id, or the canonical member id for provenance,
 * explanation, and confidence (which are keyed by the artifact/subject they cover).
 */
export interface UnderstandingReference {
  readonly artifactKind: UnderstandingArtifactKind;
  readonly artifactId: string;
}

/** The canonical, de-duplicated, totally ordered index of every gathered artifact. */
export interface UnderstandingChain {
  readonly references: readonly UnderstandingReference[];
}

/** A deterministic tally of what the understanding gathered, by kind. Carried, not judged. */
export interface UnderstandingSummary {
  readonly counts: Readonly<Record<UnderstandingArtifactKind, number>>;
  readonly total: number;
}

/** The memory grounding of the whole understanding — its evidence references. */
export interface UnderstandingBasis {
  readonly evidence: readonly UnderstandingReference[];
}

/**
 * The concrete published artifacts an understanding holds, carried UNCHANGED from
 * Phases 1–7. Assembly gathers and canonically orders these; it never mutates,
 * enriches, or re-derives any of them.
 */
export interface UnderstandingContext {
  readonly evidence: EvidenceSet;
  readonly relations: readonly ReasoningRelation[];
  readonly implications: readonly ReasoningImplication[];
  readonly contradictions: readonly ReasoningContradiction[];
  readonly gaps: readonly ReasoningGap[];
  readonly provenances: readonly Provenance[];
  readonly explanations: readonly Explanation[];
  readonly confidences: readonly Confidence[];
}

/** One concrete gathered member, tagged by kind — the inspectable artifact enumeration. */
export type UnderstandingArtifact =
  | { readonly kind: "evidence"; readonly value: EvidenceSet["items"][number] }
  | { readonly kind: "relation"; readonly value: ReasoningRelation }
  | { readonly kind: "implication"; readonly value: ReasoningImplication }
  | { readonly kind: "contradiction"; readonly value: ReasoningContradiction }
  | { readonly kind: "gap"; readonly value: ReasoningGap }
  | { readonly kind: "provenance"; readonly value: Provenance }
  | { readonly kind: "explanation"; readonly value: Explanation }
  | { readonly kind: "confidence"; readonly value: Confidence };

/**
 * The assembled understanding record: the subject it answers, the scope it is bounded
 * to, the canonical chain indexing every gathered artifact, a deterministic summary,
 * and the evidence basis it rests on. It carries no new conclusion of its own.
 */
export interface Understanding {
  readonly subject: UnderstandingSubject;
  readonly scope: UnderstandingScope;
  readonly chain: UnderstandingChain;
  readonly summary: UnderstandingSummary;
  readonly basis: UnderstandingBasis;
}

/**
 * The complete, immutable deliverable: the assembled understanding record together
 * with the concrete published artifacts it indexes. This is what a human decision or
 * a future planning layer consumes — bounded, explained, confidence-annotated, and
 * traceable to memory, with nothing decided.
 */
export interface UnderstandingBundle {
  readonly understanding: Understanding;
  readonly context: UnderstandingContext;
}

/**
 * A bundle that has passed through understanding normalization: context sets
 * de-duplicated and canonically ordered, and the understanding index derived
 * deterministically from that canonical context. Structurally an
 * {@link UnderstandingBundle}; the alias marks that canonical form has been applied.
 */
export type CanonicalUnderstanding = UnderstandingBundle;
