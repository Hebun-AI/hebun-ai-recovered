/**
 * Enterprise Memory Reasoning — understanding assembly rules (Phase 8).
 *
 * Pure, deterministic lookups over the canonical artifact descriptors, canonical
 * member-id derivation, and deterministic projections of a context into references,
 * a tagged artifact enumeration, a per-kind summary, and an evidence basis. These
 * answer plain questions — what layer is this kind, does it ground in memory, what
 * is this member's canonical id, what did the context gather. NO new reasoning, NO
 * inference, NO computation of confidence or anything else; table reads and pure
 * projections only. Member ids reuse the earlier phases' canonical identity.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type { EvidenceItem } from "@/features/enterprise-memory-reasoning/evidence";
import type { Provenance } from "@/features/enterprise-memory-reasoning/provenance-types";
import type { Explanation } from "@/features/enterprise-memory-reasoning/explainability-types";
import type { Confidence } from "@/features/enterprise-memory-reasoning/confidence-types";
import type {
  Understanding,
  UnderstandingArtifact,
  UnderstandingArtifactDescriptor,
  UnderstandingArtifactKind,
  UnderstandingBasis,
  UnderstandingContext,
  UnderstandingReference,
  UnderstandingSummary,
} from "@/features/enterprise-memory-reasoning/understanding-types";
import { UNDERSTANDING_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/understanding-types";

export function understandingArtifactDescriptorOf(kind: UnderstandingArtifactKind): UnderstandingArtifactDescriptor {
  return UNDERSTANDING_ARTIFACT_DESCRIPTORS[kind];
}

/** True when the kind grounds understanding directly in memory (evidence). */
export function understandingArtifactIsGrounding(kind: UnderstandingArtifactKind): boolean {
  return UNDERSTANDING_ARTIFACT_DESCRIPTORS[kind].isGrounding;
}

/** The canonical cross-kind ordering layer of an artifact kind. */
export function understandingLayerOf(kind: UnderstandingArtifactKind): number {
  return UNDERSTANDING_ARTIFACT_DESCRIPTORS[kind].layer;
}

/** The canonical member id of one piece of evidence (its memory key). */
export function evidenceMemberId(item: EvidenceItem): string {
  return evidenceKey(item.reference);
}

/** The canonical member id of one provenance record (the artifact it covers). */
export function provenanceMemberId(provenance: Provenance): string {
  return JSON.stringify([provenance.artifactKind, provenance.artifactId]);
}

/** The canonical member id of one explanation (the subject it presents). */
export function explanationMemberId(explanation: Explanation): string {
  return JSON.stringify([explanation.explanationKind, explanation.subject.subjectId]);
}

/** The canonical member id of one confidence assessment (the conclusion it annotates). */
export function confidenceMemberId(confidence: Confidence): string {
  return JSON.stringify([confidence.subject.subjectKind, confidence.subject.subjectId]);
}

/** Enumerates every gathered member of a context as a reference, in natural order. */
export function referencesOf(context: UnderstandingContext): readonly UnderstandingReference[] {
  return [
    ...context.evidence.items.map((item) => ({ artifactKind: "evidence" as const, artifactId: evidenceMemberId(item) })),
    ...context.relations.map((relation) => ({ artifactKind: "relation" as const, artifactId: relation.relationId })),
    ...context.implications.map((implication) => ({
      artifactKind: "implication" as const,
      artifactId: implication.implicationId,
    })),
    ...context.contradictions.map((contradiction) => ({
      artifactKind: "contradiction" as const,
      artifactId: contradiction.contradictionId,
    })),
    ...context.gaps.map((gap) => ({ artifactKind: "gap" as const, artifactId: gap.gapId })),
    ...context.provenances.map((provenance) => ({
      artifactKind: "provenance" as const,
      artifactId: provenanceMemberId(provenance),
    })),
    ...context.explanations.map((explanation) => ({
      artifactKind: "explanation" as const,
      artifactId: explanationMemberId(explanation),
    })),
    ...context.confidences.map((confidence) => ({
      artifactKind: "confidence" as const,
      artifactId: confidenceMemberId(confidence),
    })),
  ];
}

/** Enumerates every gathered member of a context as a tagged artifact, in natural order. */
export function artifactsOf(context: UnderstandingContext): readonly UnderstandingArtifact[] {
  return [
    ...context.evidence.items.map((value) => ({ kind: "evidence" as const, value })),
    ...context.relations.map((value) => ({ kind: "relation" as const, value })),
    ...context.implications.map((value) => ({ kind: "implication" as const, value })),
    ...context.contradictions.map((value) => ({ kind: "contradiction" as const, value })),
    ...context.gaps.map((value) => ({ kind: "gap" as const, value })),
    ...context.provenances.map((value) => ({ kind: "provenance" as const, value })),
    ...context.explanations.map((value) => ({ kind: "explanation" as const, value })),
    ...context.confidences.map((value) => ({ kind: "confidence" as const, value })),
  ];
}

/** A deterministic per-kind tally of what a context gathered. Carried, never judged. */
export function summaryOf(context: UnderstandingContext): UnderstandingSummary {
  const counts: Record<UnderstandingArtifactKind, number> = {
    evidence: context.evidence.items.length,
    relation: context.relations.length,
    implication: context.implications.length,
    contradiction: context.contradictions.length,
    gap: context.gaps.length,
    provenance: context.provenances.length,
    explanation: context.explanations.length,
    confidence: context.confidences.length,
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { counts, total };
}

/** The evidence basis a context rests on — its memory grounding. */
export function basisOf(context: UnderstandingContext): UnderstandingBasis {
  return {
    evidence: context.evidence.items.map((item) => ({
      artifactKind: "evidence" as const,
      artifactId: evidenceMemberId(item),
    })),
  };
}

/** True when the understanding is grounded in at least one piece of evidence. */
export function reachesEvidenceRoot(understanding: Understanding): boolean {
  return understanding.basis.evidence.length > 0;
}
