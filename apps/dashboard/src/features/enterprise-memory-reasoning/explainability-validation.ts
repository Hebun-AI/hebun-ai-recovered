/**
 * Enterprise Memory Reasoning — explainability validation (Phase 6).
 *
 * Validates the STRUCTURAL integrity of explanations against the declared evidence,
 * relations, implications, contradictions, gaps, and provenance: the subject is
 * declared, the walk has at least one step, every step carries a non-empty
 * statement, every reference cites a permitted and declared reference kind, no
 * derived explanation cites itself, and the walk reaches an evidence root when
 * required. This is a plain, deterministic structural check — NOT explanation
 * generation, NOT reasoning, NOT inference.
 */

import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { Provenance } from "@/features/enterprise-memory-reasoning/provenance-types";
import { evidenceKey } from "@/features/enterprise-memory-reasoning/relation-normalization";
import type {
  Explanation,
  ExplanationKind,
  ExplanationReferenceKind,
} from "@/features/enterprise-memory-reasoning/explainability-types";
import {
  explanationPermitsReference,
  explanationRequiresEvidenceRoot,
} from "@/features/enterprise-memory-reasoning/explainability-rules";

export type ExplainabilityValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateExplanationSet(
  explanations: readonly Explanation[],
  evidence: EvidenceSet,
  relations: readonly ReasoningRelation[],
  implications: readonly ReasoningImplication[],
  contradictions: readonly ReasoningContradiction[],
  gaps: readonly ReasoningGap[],
  provenances: readonly Provenance[],
): ExplainabilityValidation {
  const evidenceIds = new Set(evidence.items.map((item) => evidenceKey(item.reference)));
  const relationIds = new Set(relations.map((relation) => relation.relationId));
  const implicationIds = new Set(implications.map((implication) => implication.implicationId));
  const contradictionIds = new Set(contradictions.map((contradiction) => contradiction.contradictionId));
  const gapIds = new Set(gaps.map((gap) => gap.gapId));

  // Reference kinds address the reasoning graph directly.
  const declaredReference: Readonly<Record<ExplanationReferenceKind, ReadonlySet<string>>> = {
    evidence: evidenceIds,
    relation: relationIds,
    implication: implicationIds,
    contradiction: contradictionIds,
    gap: gapIds,
  };

  // Subject kinds address the same graph, plus provenance (by the artifact it covers).
  const declaredSubject: Readonly<Record<ExplanationKind, ReadonlySet<string>>> = {
    evidence: evidenceIds,
    relation: relationIds,
    implication: implicationIds,
    contradiction: contradictionIds,
    gap: gapIds,
    provenance: new Set(provenances.map((provenance) => provenance.artifactId)),
  };

  const issues: string[] = [];
  for (const explanation of explanations) {
    const { explanationKind, subject, chain } = explanation;

    if (subject.subjectKind !== explanationKind) {
      issues.push(
        `explanation of ${explanationKind} ${subject.subjectId} has a mismatched subject kind "${subject.subjectKind}"`,
      );
    }
    if (!declaredSubject[subject.subjectKind].has(subject.subjectId)) {
      issues.push(`explanation of ${explanationKind} ${subject.subjectId} names an undeclared subject`);
    }
    if (chain.steps.length === 0) {
      issues.push(`explanation of ${explanationKind} ${subject.subjectId} has no steps`);
    }

    let hasEvidenceRoot = false;
    for (const step of chain.steps) {
      if (step.statement.length === 0) {
        issues.push(`explanation of ${explanationKind} ${subject.subjectId} has a step with an empty statement`);
      }
      for (const reference of step.references) {
        if (reference.referenceKind === "evidence") hasEvidenceRoot = true;

        if (!explanationPermitsReference(explanationKind, reference.referenceKind)) {
          issues.push(
            `explanation of ${explanationKind} ${subject.subjectId} cites a forbidden reference kind "${reference.referenceKind}"`,
          );
        }
        if (!declaredReference[reference.referenceKind].has(reference.referenceId)) {
          issues.push(
            `explanation of ${explanationKind} ${subject.subjectId} cites undeclared ${reference.referenceKind} ${reference.referenceId}`,
          );
        }
        // A derived explanation must not cite itself. An evidence explanation citing
        // the very memory it presents is grounding, not a cycle, so it is allowed.
        if (
          explanationKind !== "evidence" &&
          reference.referenceKind === subject.subjectKind &&
          reference.referenceId === subject.subjectId
        ) {
          issues.push(`explanation of ${explanationKind} ${subject.subjectId} cites itself`);
        }
      }
    }

    if (explanationRequiresEvidenceRoot(explanationKind) && !hasEvidenceRoot) {
      issues.push(`explanation of ${explanationKind} ${subject.subjectId} never reaches an evidence root`);
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
