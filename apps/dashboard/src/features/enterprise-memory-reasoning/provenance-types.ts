/**
 * Enterprise Memory Reasoning — provenance type descriptors (Phase 5).
 *
 * Declares what a provenance record IS: the kinds of source a reasoning artifact
 * can rest on, the permitted upstream sources for each artifact kind, and the
 * shapes of a provenance reference, chain, and lineage. This is canonical,
 * immutable declarative data — lookup tables and contract shapes, not an engine.
 * There is no provenance generation, no inference, and no reasoning execution here.
 */

import type { ReasoningRelationId } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplicationId } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradictionId } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGapId } from "@/features/enterprise-memory-reasoning/gap";

/** The kinds of thing a provenance step can point back at. */
export type ProvenanceSourceKind = "evidence" | "relation" | "implication" | "contradiction" | "gap";

/** The reasoning artifacts that carry a provenance chain (evidence is the root, not carried). */
export type ProvenanceArtifactKind = "relation" | "implication" | "contradiction" | "gap";

/** The fixed, canonical properties of a provenance source kind. */
export interface ProvenanceSourceDescriptor {
  readonly sourceKind: ProvenanceSourceKind;
  /** Whether this source grounds reasoning directly in memory (evidence) rather than deriving. */
  readonly isRoot: boolean;
}

/**
 * The canonical descriptor for every provenance source kind. Frozen and immutable:
 *   - evidence:      root   (grounds directly in persisted memory)
 *   - relation:      derived
 *   - implication:   derived
 *   - contradiction: derived
 *   - gap:           derived
 */
export const PROVENANCE_SOURCE_DESCRIPTORS: Readonly<Record<ProvenanceSourceKind, ProvenanceSourceDescriptor>> =
  Object.freeze({
    evidence: Object.freeze({ sourceKind: "evidence", isRoot: true }),
    relation: Object.freeze({ sourceKind: "relation", isRoot: false }),
    implication: Object.freeze({ sourceKind: "implication", isRoot: false }),
    contradiction: Object.freeze({ sourceKind: "contradiction", isRoot: false }),
    gap: Object.freeze({ sourceKind: "gap", isRoot: false }),
  });

/** The fixed, canonical properties of a provenance-carrying artifact kind. */
export interface ProvenanceArtifactDescriptor {
  readonly artifactKind: ProvenanceArtifactKind;
  /** The source kinds a chain for this artifact may legitimately cite. */
  readonly permittedSources: readonly ProvenanceSourceKind[];
  /** Whether the chain must reach at least one evidence (memory) root. */
  readonly requiresEvidenceRoot: boolean;
}

/**
 * The canonical descriptor for every provenance-carrying artifact kind. Frozen and
 * immutable. Permitted sources mirror the real Phase 2–4 dependency structure:
 *   - relation:      evidence
 *   - implication:   evidence, relation
 *   - contradiction: evidence, relation, implication
 *   - gap:           evidence, relation, implication, contradiction
 * Every artifact requires an evidence root so no conclusion floats free of memory.
 */
export const PROVENANCE_ARTIFACT_DESCRIPTORS: Readonly<Record<ProvenanceArtifactKind, ProvenanceArtifactDescriptor>> =
  Object.freeze({
    relation: Object.freeze({
      artifactKind: "relation",
      permittedSources: Object.freeze(["evidence"] as const),
      requiresEvidenceRoot: true,
    }),
    implication: Object.freeze({
      artifactKind: "implication",
      permittedSources: Object.freeze(["evidence", "relation"] as const),
      requiresEvidenceRoot: true,
    }),
    contradiction: Object.freeze({
      artifactKind: "contradiction",
      permittedSources: Object.freeze(["evidence", "relation", "implication"] as const),
      requiresEvidenceRoot: true,
    }),
    gap: Object.freeze({
      artifactKind: "gap",
      permittedSources: Object.freeze(["evidence", "relation", "implication", "contradiction"] as const),
      requiresEvidenceRoot: true,
    }),
  });

/** The id of a provenance-carrying artifact, by kind. */
export type ProvenanceArtifactId =
  | ReasoningRelationId
  | ReasoningImplicationId
  | ReasoningContradictionId
  | ReasoningGapId;

/**
 * One immutable pointer into the reasoning graph. `sourceId` is the canonical
 * evidence key for evidence sources, or the artifact id for derived sources.
 */
export interface ProvenanceReference {
  readonly sourceKind: ProvenanceSourceKind;
  readonly sourceId: string;
}

/** An ordered-by-canonicalization set of references forming a basis. */
export interface ProvenanceChain {
  readonly references: readonly ProvenanceReference[];
}

/** A complete provenance record: one artifact and its full chain back to memory. */
export interface Provenance {
  readonly artifactKind: ProvenanceArtifactKind;
  readonly artifactId: ProvenanceArtifactId;
  readonly chain: ProvenanceChain;
}

/** A chain's references partitioned by source kind — the inspectable lineage. */
export interface ProvenanceLineage {
  readonly evidence: readonly ProvenanceReference[];
  readonly relations: readonly ProvenanceReference[];
  readonly implications: readonly ProvenanceReference[];
  readonly contradictions: readonly ProvenanceReference[];
  readonly gaps: readonly ProvenanceReference[];
}
