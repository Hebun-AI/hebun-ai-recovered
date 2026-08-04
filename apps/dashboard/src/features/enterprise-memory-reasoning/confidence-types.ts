/**
 * Enterprise Memory Reasoning — confidence & uncertainty type descriptors (Phase 7).
 *
 * Declares what a confidence assessment IS: the ordinal confidence levels and their
 * classification, the graph sources confidence can rest on, the artifact kinds a
 * confidence can annotate, the named factors that inform it, the categories of
 * uncertainty, and the shapes of a confidence reference, chain, evidence, factor,
 * limitation, assumption, uncertainty, and record. This is canonical, immutable
 * declarative data — lookup tables and contract shapes, not an engine.
 *
 * There is NO confidence calculation, NO probability, NO statistical or Bayesian
 * model, NO scoring, NO ranking, NO AI, and NO reasoning here. Confidence is a
 * plainly DECLARED, explainable level carried from the earlier phases; this phase
 * only defines its shape and canonical rules. It builds on the Phase 1 confidence
 * contract (the ordinal level and uncertainty statement) and on Phases 2–6.
 */

import type { ReasoningConfidenceLevel } from "@/features/enterprise-memory-reasoning/confidence";
import type { ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

/** The coarse, named class a confidence level falls into. Naming only. */
export type ConfidenceClassification = "provisional" | "supported" | "strong" | "established";

/** The fixed, canonical properties of a confidence level. */
export interface ConfidenceLevelDescriptor {
  readonly level: ReasoningConfidenceLevel;
  /** A fixed integer for total ordering. Ordinal meaning only — not a score. */
  readonly rank: number;
  /** The coarse class this level belongs to. */
  readonly classification: ConfidenceClassification;
  /** Whether a level this weak must state at least one uncertainty. */
  readonly requiresUncertainty: boolean;
}

/**
 * The canonical descriptor for every confidence level. Frozen and immutable.
 * Ranks give a deterministic total order (low < medium < high < verified). Weaker
 * levels must declare what they do not know, so no soft conclusion hides its limits.
 */
export const CONFIDENCE_LEVEL_DESCRIPTORS: Readonly<Record<ReasoningConfidenceLevel, ConfidenceLevelDescriptor>> =
  Object.freeze({
    low: Object.freeze({ level: "low", rank: 0, classification: "provisional", requiresUncertainty: true }),
    medium: Object.freeze({ level: "medium", rank: 1, classification: "supported", requiresUncertainty: true }),
    high: Object.freeze({ level: "high", rank: 2, classification: "strong", requiresUncertainty: false }),
    verified: Object.freeze({ level: "verified", rank: 3, classification: "established", requiresUncertainty: false }),
  });

/** The kinds of reasoning-graph artifact a confidence assessment can rest on. */
export type ConfidenceSourceKind = "evidence" | "relation" | "implication" | "contradiction" | "gap";

/** The fixed, canonical properties of a confidence source kind. */
export interface ConfidenceSourceDescriptor {
  readonly sourceKind: ConfidenceSourceKind;
  /** Whether this source grounds confidence directly in memory (evidence). */
  readonly isGrounding: boolean;
}

/**
 * The canonical descriptor for every confidence source kind. Frozen and immutable:
 * evidence grounds directly in memory; the rest are derived reasoning artifacts.
 */
export const CONFIDENCE_SOURCE_DESCRIPTORS: Readonly<Record<ConfidenceSourceKind, ConfidenceSourceDescriptor>> =
  Object.freeze({
    evidence: Object.freeze({ sourceKind: "evidence", isGrounding: true }),
    relation: Object.freeze({ sourceKind: "relation", isGrounding: false }),
    implication: Object.freeze({ sourceKind: "implication", isGrounding: false }),
    contradiction: Object.freeze({ sourceKind: "contradiction", isGrounding: false }),
    gap: Object.freeze({ sourceKind: "gap", isGrounding: false }),
  });

/** The reasoning artifacts a confidence assessment may annotate (conclusions only). */
export type ConfidenceSubjectKind = "relation" | "implication" | "contradiction" | "gap";

/** The fixed, canonical properties of a confidence-carrying subject kind. */
export interface ConfidenceSubjectDescriptor {
  readonly subjectKind: ConfidenceSubjectKind;
  /** The source kinds a chain for this subject may legitimately cite. */
  readonly permittedSources: readonly ConfidenceSourceKind[];
  /** Whether the chain must reach at least one evidence (memory) root. */
  readonly requiresEvidenceRoot: boolean;
}

/**
 * The canonical descriptor for every confidence-carrying subject kind. Frozen and
 * immutable. Permitted sources mirror the real Phase 2–4 dependency structure, so a
 * confidence may only rest on what its conclusion could itself rest on:
 *   - relation:      evidence
 *   - implication:   evidence, relation
 *   - contradiction: evidence, relation, implication
 *   - gap:           evidence, relation, implication, contradiction
 * Every subject requires an evidence root so no confidence floats free of memory.
 */
export const CONFIDENCE_SUBJECT_DESCRIPTORS: Readonly<Record<ConfidenceSubjectKind, ConfidenceSubjectDescriptor>> =
  Object.freeze({
    relation: Object.freeze({
      subjectKind: "relation",
      permittedSources: Object.freeze(["evidence"] as const),
      requiresEvidenceRoot: true,
    }),
    implication: Object.freeze({
      subjectKind: "implication",
      permittedSources: Object.freeze(["evidence", "relation"] as const),
      requiresEvidenceRoot: true,
    }),
    contradiction: Object.freeze({
      subjectKind: "contradiction",
      permittedSources: Object.freeze(["evidence", "relation", "implication"] as const),
      requiresEvidenceRoot: true,
    }),
    gap: Object.freeze({
      subjectKind: "gap",
      permittedSources: Object.freeze(["evidence", "relation", "implication", "contradiction"] as const),
      requiresEvidenceRoot: true,
    }),
  });

/** The polarity a factor typically pushes confidence toward. Naming only. */
export type ConfidenceFactorPolarity = "supporting" | "limiting";

/** The named considerations that inform a declared confidence. */
export type ConfidenceFactorKind =
  | "evidence-strength"
  | "corroboration"
  | "provenance-depth"
  | "recency"
  | "consistency"
  | "completeness"
  | "sparsity"
  | "staleness"
  | "conflict";

/** The fixed, canonical properties of a confidence factor kind. */
export interface ConfidenceFactorDescriptor {
  readonly factorKind: ConfidenceFactorKind;
  readonly polarity: ConfidenceFactorPolarity;
}

/**
 * The canonical descriptor for every confidence factor kind. Frozen and immutable.
 * Supporting factors typically strengthen a conclusion; limiting factors typically
 * weaken it. This is naming and classification only — no factor is ever scored.
 */
export const CONFIDENCE_FACTOR_DESCRIPTORS: Readonly<Record<ConfidenceFactorKind, ConfidenceFactorDescriptor>> =
  Object.freeze({
    "evidence-strength": Object.freeze({ factorKind: "evidence-strength", polarity: "supporting" }),
    corroboration: Object.freeze({ factorKind: "corroboration", polarity: "supporting" }),
    "provenance-depth": Object.freeze({ factorKind: "provenance-depth", polarity: "supporting" }),
    recency: Object.freeze({ factorKind: "recency", polarity: "supporting" }),
    consistency: Object.freeze({ factorKind: "consistency", polarity: "supporting" }),
    completeness: Object.freeze({ factorKind: "completeness", polarity: "supporting" }),
    sparsity: Object.freeze({ factorKind: "sparsity", polarity: "limiting" }),
    staleness: Object.freeze({ factorKind: "staleness", polarity: "limiting" }),
    conflict: Object.freeze({ factorKind: "conflict", polarity: "limiting" }),
  });

/** The categories an explicitly stated uncertainty can fall into. */
export type UncertaintyCategory = "incompleteness" | "ambiguity" | "conflict" | "staleness" | "scope";

/** The fixed, canonical properties of an uncertainty category. */
export interface UncertaintyCategoryDescriptor {
  readonly category: UncertaintyCategory;
  /** Whether more evidence or resolution could, in principle, dissolve it. */
  readonly isResolvable: boolean;
}

/**
 * The canonical descriptor for every uncertainty category. Frozen and immutable.
 * Scope uncertainty is inherent to the bounded memory and never fully resolvable;
 * the others could in principle be reduced by more or fresher memory.
 */
export const UNCERTAINTY_CATEGORY_DESCRIPTORS: Readonly<Record<UncertaintyCategory, UncertaintyCategoryDescriptor>> =
  Object.freeze({
    incompleteness: Object.freeze({ category: "incompleteness", isResolvable: true }),
    ambiguity: Object.freeze({ category: "ambiguity", isResolvable: true }),
    conflict: Object.freeze({ category: "conflict", isResolvable: true }),
    staleness: Object.freeze({ category: "staleness", isResolvable: true }),
    scope: Object.freeze({ category: "scope", isResolvable: false }),
  });

/** What a confidence assessment is about: one conclusion, by kind and id. */
export interface ConfidenceSubject {
  readonly subjectKind: ConfidenceSubjectKind;
  readonly subjectId: string;
}

/**
 * One immutable pointer into the reasoning graph forming part of a confidence basis.
 * `referenceId` is the canonical evidence key for an evidence source, or the
 * artifact id for a derived source.
 */
export interface ConfidenceReference {
  readonly sourceKind: ConfidenceSourceKind;
  readonly referenceId: string;
}

/** An ordered-by-canonicalization set of references forming a confidence basis. */
export interface ConfidenceChain {
  readonly references: readonly ConfidenceReference[];
}

/** The grounding (evidence) portion of a confidence basis — its inspectable root. */
export interface ConfidenceEvidence {
  readonly references: readonly ConfidenceReference[];
}

/** A stated thing that caps how far a conclusion can be trusted. */
export interface ConfidenceLimitation {
  readonly statement: ReasoningStatement;
}

/** A stated assumption a declared confidence rests on. */
export interface ConfidenceAssumption {
  readonly statement: ReasoningStatement;
}

/** Where a stated uncertainty arises in the reasoning graph. */
export interface UncertaintySource {
  readonly sourceKind: ConfidenceSourceKind;
  readonly sourceId: string;
}

/** The plainly stated reason an uncertainty exists. */
export interface UncertaintyReason {
  readonly statement: ReasoningStatement;
}

/** One explicitly declared thing a conclusion does not know, with its origins. */
export interface Uncertainty {
  readonly category: UncertaintyCategory;
  readonly reason: UncertaintyReason;
  readonly sources: readonly UncertaintySource[];
}

/**
 * A complete, declared confidence assessment for one conclusion: its level, the
 * basis it rests on, the factors considered, the assumptions and limitations that
 * bound it, and the uncertainties it openly states. Nothing here is computed.
 */
export interface Confidence {
  readonly subject: ConfidenceSubject;
  readonly level: ReasoningConfidenceLevel;
  readonly chain: ConfidenceChain;
  readonly factors: readonly ConfidenceFactorKind[];
  readonly assumptions: readonly ConfidenceAssumption[];
  readonly limitations: readonly ConfidenceLimitation[];
  readonly uncertainties: readonly Uncertainty[];
}

/**
 * A confidence that has passed through confidence normalization: chain references,
 * factors, assumptions, limitations, and uncertainties de-duplicated and put in a
 * fixed total order. Structurally a {@link Confidence}; the alias marks that
 * canonical form has been applied.
 */
export type CanonicalConfidence = Confidence;

/** A confidence chain's references partitioned by source kind — its lineage. */
export interface ConfidenceLineage {
  readonly evidence: readonly ConfidenceReference[];
  readonly relations: readonly ConfidenceReference[];
  readonly implications: readonly ConfidenceReference[];
  readonly contradictions: readonly ConfidenceReference[];
  readonly gaps: readonly ConfidenceReference[];
}
