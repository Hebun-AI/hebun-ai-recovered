/**
 * Enterprise Memory Reasoning — provenance rules (Phase 5).
 *
 * Pure, deterministic lookups over the canonical provenance descriptors, plus
 * deterministic partitioning of a chain into its per-kind lineage. These answer
 * plain questions — is this source a root, may this artifact cite this source,
 * what is the evidence/relation/implication/contradiction/gap/dependency lineage.
 * No provenance generation, no inference; table reads and pure partitions only.
 */

import type {
  ProvenanceArtifactDescriptor,
  ProvenanceArtifactKind,
  ProvenanceChain,
  ProvenanceLineage,
  ProvenanceReference,
  ProvenanceSourceDescriptor,
  ProvenanceSourceKind,
} from "@/features/enterprise-memory-reasoning/provenance-types";
import {
  PROVENANCE_ARTIFACT_DESCRIPTORS,
  PROVENANCE_SOURCE_DESCRIPTORS,
} from "@/features/enterprise-memory-reasoning/provenance-types";

export function provenanceSourceDescriptorOf(kind: ProvenanceSourceKind): ProvenanceSourceDescriptor {
  return PROVENANCE_SOURCE_DESCRIPTORS[kind];
}

export function provenanceArtifactDescriptorOf(kind: ProvenanceArtifactKind): ProvenanceArtifactDescriptor {
  return PROVENANCE_ARTIFACT_DESCRIPTORS[kind];
}

/** True when the source grounds reasoning directly in memory (evidence). */
export function provenanceSourceIsRoot(kind: ProvenanceSourceKind): boolean {
  return PROVENANCE_SOURCE_DESCRIPTORS[kind].isRoot;
}

/** True when an artifact kind may legitimately cite the given source kind. */
export function provenanceArtifactPermits(
  artifactKind: ProvenanceArtifactKind,
  sourceKind: ProvenanceSourceKind,
): boolean {
  return PROVENANCE_ARTIFACT_DESCRIPTORS[artifactKind].permittedSources.includes(sourceKind);
}

/** True when the artifact kind requires its chain to reach an evidence root. */
export function provenanceRequiresEvidenceRoot(artifactKind: ProvenanceArtifactKind): boolean {
  return PROVENANCE_ARTIFACT_DESCRIPTORS[artifactKind].requiresEvidenceRoot;
}

/** Partitions a chain's references into its per-kind lineage, preserving chain order. */
export function lineageOf(chain: ProvenanceChain): ProvenanceLineage {
  const evidence: ProvenanceReference[] = [];
  const relations: ProvenanceReference[] = [];
  const implications: ProvenanceReference[] = [];
  const contradictions: ProvenanceReference[] = [];
  const gaps: ProvenanceReference[] = [];
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

/** The derived (non-root) portion of a chain — its dependency lineage. */
export function dependencyLineageOf(chain: ProvenanceChain): readonly ProvenanceReference[] {
  return chain.references.filter((reference) => !provenanceSourceIsRoot(reference.sourceKind));
}
