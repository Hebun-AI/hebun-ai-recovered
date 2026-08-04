/**
 * Enterprise Memory Reasoning — explainability rules (Phase 6).
 *
 * Pure, deterministic lookups over the canonical explanation-kind descriptors, plus
 * deterministic flattening and partitioning of an explanation chain. These answer
 * plain questions — is this kind grounded, may this kind's steps cite this reference
 * kind, must the walk reach memory, what references does the walk cite, and what is
 * its per-kind lineage. NO explanation generation, NO reasoning, NO inference; table
 * reads and pure projections only.
 */

import type {
  ExplanationChain,
  ExplanationKind,
  ExplanationKindDescriptor,
  ExplanationLineage,
  ExplanationReference,
  ExplanationReferenceKind,
} from "@/features/enterprise-memory-reasoning/explainability-types";
import { EXPLANATION_KIND_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/explainability-types";

export function explanationKindDescriptorOf(kind: ExplanationKind): ExplanationKindDescriptor {
  return EXPLANATION_KIND_DESCRIPTORS[kind];
}

/** True when the kind presents memory directly (evidence) rather than a derivation. */
export function explanationIsGrounded(kind: ExplanationKind): boolean {
  return EXPLANATION_KIND_DESCRIPTORS[kind].isGrounded;
}

/** True when the explanation kind may legitimately cite the given reference kind. */
export function explanationPermitsReference(
  kind: ExplanationKind,
  referenceKind: ExplanationReferenceKind,
): boolean {
  return EXPLANATION_KIND_DESCRIPTORS[kind].permittedReferenceKinds.includes(referenceKind);
}

/** True when the explanation kind requires its walk to reach an evidence root. */
export function explanationRequiresEvidenceRoot(kind: ExplanationKind): boolean {
  return EXPLANATION_KIND_DESCRIPTORS[kind].requiresEvidenceRoot;
}

/** Flattens a chain's references across all steps, preserving step then reference order. */
export function referencesOf(chain: ExplanationChain): readonly ExplanationReference[] {
  return chain.steps.flatMap((step) => step.references);
}

/** Partitions a chain's references into its per-kind lineage, preserving walk order. */
export function lineageOf(chain: ExplanationChain): ExplanationLineage {
  const evidence: ExplanationReference[] = [];
  const relations: ExplanationReference[] = [];
  const implications: ExplanationReference[] = [];
  const contradictions: ExplanationReference[] = [];
  const gaps: ExplanationReference[] = [];
  for (const reference of referencesOf(chain)) {
    switch (reference.referenceKind) {
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

/** True when the chain cites at least one evidence reference — it reaches memory. */
export function reachesEvidenceRoot(chain: ExplanationChain): boolean {
  return chain.steps.some((step) =>
    step.references.some((reference) => reference.referenceKind === "evidence"),
  );
}
