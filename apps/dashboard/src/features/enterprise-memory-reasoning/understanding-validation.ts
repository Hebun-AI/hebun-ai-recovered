/**
 * Enterprise Memory Reasoning — understanding assembly validation (Phase 8).
 *
 * Validates the STRUCTURAL integrity of a proposed understanding assembly: the
 * subject and scope are named, the understanding is grounded in at least one piece
 * of evidence (evidence root preserved), no artifact appears twice within a kind, and
 * the provenance, explanation, and confidence linkages hold — by REUSING the already-
 * published Phase 5–7 set validators against the gathered artifacts. This is a plain,
 * deterministic structural check — NOT new reasoning, NOT inference, NOT computation.
 * It confirms the assembly is consistent and traceable; it never alters an artifact.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import { validateProvenanceSet } from "@/features/enterprise-memory-reasoning/provenance-validation";
import { validateExplanationSet } from "@/features/enterprise-memory-reasoning/explainability-validation";
import { validateConfidenceSet } from "@/features/enterprise-memory-reasoning/confidence-validation";
import type {
  UnderstandingContext,
  UnderstandingScope,
  UnderstandingSubject,
} from "@/features/enterprise-memory-reasoning/understanding-types";
import {
  confidenceMemberId,
  explanationMemberId,
  provenanceMemberId,
} from "@/features/enterprise-memory-reasoning/understanding-rules";

export type UnderstandingValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, ids: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`understanding gathers duplicate ${label} ${id}`);
    seen.add(id);
  }
}

export function validateUnderstanding(
  subject: UnderstandingSubject,
  scope: UnderstandingScope,
  context: UnderstandingContext,
): UnderstandingValidation {
  const issues: string[] = [];

  if (subject.subjectId.length === 0) issues.push("understanding has an empty subject id");
  if (scope.scopeId.length === 0) issues.push("understanding has an empty scope id");

  // Evidence root: an understanding must rest on at least one piece of memory.
  if (context.evidence.items.length === 0) {
    issues.push("understanding is not grounded in any evidence");
  }

  // No artifact may be gathered twice within a kind.
  pushDuplicates("evidence", context.evidence.items.map((item) => evidenceKey(item.reference)), issues);
  pushDuplicates("relation", context.relations.map((relation) => relation.relationId), issues);
  pushDuplicates("implication", context.implications.map((implication) => implication.implicationId), issues);
  pushDuplicates("contradiction", context.contradictions.map((contradiction) => contradiction.contradictionId), issues);
  pushDuplicates("gap", context.gaps.map((gap) => gap.gapId), issues);
  pushDuplicates("provenance", context.provenances.map(provenanceMemberId), issues);
  pushDuplicates("explanation", context.explanations.map(explanationMemberId), issues);
  pushDuplicates("confidence", context.confidences.map(confidenceMemberId), issues);

  // Provenance, explainability, and confidence linkages are preserved by reusing the
  // published validators against the gathered artifacts. No linkage is re-derived.
  const provenance = validateProvenanceSet(
    context.provenances,
    context.evidence,
    context.relations,
    context.implications,
    context.contradictions,
    context.gaps,
  );
  if (!provenance.ok) issues.push(...provenance.issues);

  const explanation = validateExplanationSet(
    context.explanations,
    context.evidence,
    context.relations,
    context.implications,
    context.contradictions,
    context.gaps,
    context.provenances,
  );
  if (!explanation.ok) issues.push(...explanation.issues);

  const confidence = validateConfidenceSet(
    context.confidences,
    context.evidence,
    context.relations,
    context.implications,
    context.contradictions,
    context.gaps,
  );
  if (!confidence.ok) issues.push(...confidence.issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
