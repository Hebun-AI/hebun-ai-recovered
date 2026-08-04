/**
 * Enterprise Memory Reasoning — confidence & uncertainty rules (Phase 7).
 *
 * Pure, deterministic lookups over the canonical confidence descriptors, a total
 * ordering over confidence levels, and deterministic partitioning of a confidence
 * chain. These answer plain questions — what class is this level, does it require
 * stated uncertainty, which comes first, may this subject rest on this source, does
 * the chain reach memory, what is its lineage. NO confidence calculation, NO
 * probability, NO scoring, NO ranking of conclusions; table reads and pure
 * projections only. The level "rank" is an ordinal for total ordering, not a score.
 */

import type { ReasoningConfidenceLevel } from "@/features/enterprise-memory-reasoning/confidence";
import type {
  ConfidenceChain,
  ConfidenceClassification,
  ConfidenceEvidence,
  ConfidenceFactorDescriptor,
  ConfidenceFactorKind,
  ConfidenceFactorPolarity,
  ConfidenceLevelDescriptor,
  ConfidenceLineage,
  ConfidenceReference,
  ConfidenceSourceDescriptor,
  ConfidenceSourceKind,
  ConfidenceSubjectDescriptor,
  ConfidenceSubjectKind,
  UncertaintyCategory,
  UncertaintyCategoryDescriptor,
} from "@/features/enterprise-memory-reasoning/confidence-types";
import {
  CONFIDENCE_FACTOR_DESCRIPTORS,
  CONFIDENCE_LEVEL_DESCRIPTORS,
  CONFIDENCE_SOURCE_DESCRIPTORS,
  CONFIDENCE_SUBJECT_DESCRIPTORS,
  UNCERTAINTY_CATEGORY_DESCRIPTORS,
} from "@/features/enterprise-memory-reasoning/confidence-types";

export function confidenceLevelDescriptorOf(level: ReasoningConfidenceLevel): ConfidenceLevelDescriptor {
  return CONFIDENCE_LEVEL_DESCRIPTORS[level];
}

/** The ordinal rank of a level — for total ordering only, never a score. */
export function confidenceRank(level: ReasoningConfidenceLevel): number {
  return CONFIDENCE_LEVEL_DESCRIPTORS[level].rank;
}

/** The coarse class a level belongs to. */
export function confidenceClassificationOf(level: ReasoningConfidenceLevel): ConfidenceClassification {
  return CONFIDENCE_LEVEL_DESCRIPTORS[level].classification;
}

/** True when a level this weak must state at least one uncertainty. */
export function confidenceRequiresUncertainty(level: ReasoningConfidenceLevel): boolean {
  return CONFIDENCE_LEVEL_DESCRIPTORS[level].requiresUncertainty;
}

/** A deterministic total order over levels by ordinal rank. */
export function compareConfidenceLevel(left: ReasoningConfidenceLevel, right: ReasoningConfidenceLevel): number {
  return confidenceRank(left) - confidenceRank(right);
}

export function confidenceSourceDescriptorOf(kind: ConfidenceSourceKind): ConfidenceSourceDescriptor {
  return CONFIDENCE_SOURCE_DESCRIPTORS[kind];
}

/** True when the source grounds confidence directly in memory (evidence). */
export function confidenceSourceIsGrounding(kind: ConfidenceSourceKind): boolean {
  return CONFIDENCE_SOURCE_DESCRIPTORS[kind].isGrounding;
}

export function confidenceSubjectDescriptorOf(kind: ConfidenceSubjectKind): ConfidenceSubjectDescriptor {
  return CONFIDENCE_SUBJECT_DESCRIPTORS[kind];
}

/** True when a subject kind may legitimately rest on the given source kind. */
export function confidenceSubjectPermits(subjectKind: ConfidenceSubjectKind, sourceKind: ConfidenceSourceKind): boolean {
  return CONFIDENCE_SUBJECT_DESCRIPTORS[subjectKind].permittedSources.includes(sourceKind);
}

/** True when the subject kind requires its chain to reach an evidence root. */
export function confidenceRequiresEvidenceRoot(subjectKind: ConfidenceSubjectKind): boolean {
  return CONFIDENCE_SUBJECT_DESCRIPTORS[subjectKind].requiresEvidenceRoot;
}

export function confidenceFactorDescriptorOf(kind: ConfidenceFactorKind): ConfidenceFactorDescriptor {
  return CONFIDENCE_FACTOR_DESCRIPTORS[kind];
}

/** The polarity a factor typically pushes confidence toward. */
export function confidenceFactorPolarityOf(kind: ConfidenceFactorKind): ConfidenceFactorPolarity {
  return CONFIDENCE_FACTOR_DESCRIPTORS[kind].polarity;
}

export function uncertaintyCategoryDescriptorOf(category: UncertaintyCategory): UncertaintyCategoryDescriptor {
  return UNCERTAINTY_CATEGORY_DESCRIPTORS[category];
}

/** True when the category could in principle be reduced by more or fresher memory. */
export function uncertaintyIsResolvable(category: UncertaintyCategory): boolean {
  return UNCERTAINTY_CATEGORY_DESCRIPTORS[category].isResolvable;
}

/** Partitions a chain's references into its per-kind lineage, preserving chain order. */
export function lineageOf(chain: ConfidenceChain): ConfidenceLineage {
  const evidence: ConfidenceReference[] = [];
  const relations: ConfidenceReference[] = [];
  const implications: ConfidenceReference[] = [];
  const contradictions: ConfidenceReference[] = [];
  const gaps: ConfidenceReference[] = [];
  for (const reference of chain.references) {
    switch (reference.sourceKind) {
      case "evidence":
        evidence.push(reference);
        break;
      case "relation":
        relations.push(reference);
        break;
      case "implication":
        implications.push(reference);
        break;
      case "contradiction":
        contradictions.push(reference);
        break;
      case "gap":
        gaps.push(reference);
        break;
    }
  }
  return { evidence, relations, implications, contradictions, gaps };
}

/** The grounding (evidence) portion of a confidence chain — its inspectable root. */
export function evidenceOf(chain: ConfidenceChain): ConfidenceEvidence {
  return { references: chain.references.filter((reference) => confidenceSourceIsGrounding(reference.sourceKind)) };
}

/** True when the chain cites at least one evidence reference — it reaches memory. */
export function reachesEvidenceRoot(chain: ConfidenceChain): boolean {
  return chain.references.some((reference) => reference.sourceKind === "evidence");
}
