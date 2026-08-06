/**
 * Enterprise Organizational Intelligence — organization learning validation (Phase 3).
 *
 * Validates the STRUCTURAL integrity of a learning context: the context is named,
 * every learning is evidence-grounded (read-only basis), scope-bound to a declared
 * domain, attributably provenanced, and non-empty in statement; relationships connect
 * declared learnings without self-reference; and no learning or relationship is
 * duplicated. This is a plain, deterministic structural check — NOT learning
 * identification, NOT generation, NOT truth certification, NOT memory admission, NOT
 * decision. It confirms shape and traceability only; it never alters a learning.
 */

import type {
  OrganizationLearningContext,
  OrganizationLearningRelationship,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import { learningRelationshipKey } from "@/features/enterprise-organizational-intelligence/organization-learning-normalization";

export type OrganizationLearningValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, keys: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`learning context declares duplicate ${label} ${key}`);
    seen.add(key);
  }
}

export function validateOrganizationLearningContext(
  context: OrganizationLearningContext,
): OrganizationLearningValidation {
  const issues: string[] = [];

  if (context.organizationId.length === 0) issues.push("learning context has an empty organization id");
  if (context.purpose.length === 0) issues.push("learning context has an empty purpose");
  if (context.scope.scopeId.length === 0) issues.push("learning context has an empty scope id");

  const declaredDomains = new Set(context.scope.domains);
  const declaredLearnings = new Set(context.learnings.map((learning) => learning.learningId));

  for (const learning of context.learnings) {
    const id = learning.learningId;
    if (learning.statement.length === 0) issues.push(`learning ${id} has an empty statement`);
    if (!declaredDomains.has(learning.subject.domainId)) {
      issues.push(`learning ${id} names an out-of-scope domain ${learning.subject.domainId}`);
    }
    // Evidence-grounded: a learning must derive from at least one memory reference.
    if (learning.basis.evidence.length === 0) issues.push(`learning ${id} has no evidence basis`);
    if (learning.provenance.attributedTo.length === 0) issues.push(`learning ${id} has no attribution`);
    if (!Number.isInteger(learning.provenance.version) || learning.provenance.version < 1) {
      issues.push(`learning ${id} has an invalid provenance version`);
    }
    for (const uncertainty of learning.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`learning ${id} has an uncertainty with an empty statement`);
    }
  }

  for (const relationship of context.relationships) {
    checkRelationship(relationship, declaredLearnings, issues);
  }

  pushDuplicates("learning", context.learnings.map((learning) => learning.learningId), issues);
  pushDuplicates("relationship", context.relationships.map(learningRelationshipKey), issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function checkRelationship(
  relationship: OrganizationLearningRelationship,
  declaredLearnings: ReadonlySet<string>,
  issues: string[],
): void {
  const id = relationship.relationshipId;
  if (relationship.from === relationship.to) {
    issues.push(`relationship ${id} connects a learning to itself`);
  }
  if (!declaredLearnings.has(relationship.from)) {
    issues.push(`relationship ${id} cites an undeclared learning ${relationship.from}`);
  }
  if (!declaredLearnings.has(relationship.to)) {
    issues.push(`relationship ${id} cites an undeclared learning ${relationship.to}`);
  }
}
