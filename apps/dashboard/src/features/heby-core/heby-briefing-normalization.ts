/**
 * Heby Core — briefing normalization (Phase 8, Director Briefing and Interaction Surface).
 *
 * Deterministically canonicalizes a Director briefing:
 *   - admitted elements ordered by presentation kind then identity,
 *   - admitted items ordered by preparation kind then identity,
 *   - findings ordered by section then identity,
 *   - history, questions, and decisions ordered by identity,
 *   - the audit trail ordered by subject kind then identity,
 *   - constraints de-duplicated and ordered through the Phase 2 normalizer, carried UNCHANGED,
 *   - the bound context canonicalized through the Phase 2 normalizer, unchanged in meaning,
 *   - the isolation scope and Director termination frozen,
 *   - every carried subject deep-frozen by CLONING (Phase 8 never assumes upstream frozen-ness
 *     and never mutates the caller's objects),
 *   - the whole briefing emitted immutable and deep-frozen.
 *
 * All ordering is ARRANGEMENT ONLY — never a rank, score, priority, or recommendation. Pure
 * canonical normalization: NO model call, NO decision, NO approval, NO mutation of any preserved
 * value, and NO change of semantic meaning. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe. Normalization is idempotent: the canonical form of a
 * canonical briefing is itself.
 */

import {
  type CanonicalHebyDirectorBriefing,
  type HebyAuditEntry,
  type HebyBriefingFinding,
  type HebyBriefingHistory,
  type HebyCarriedQuestion,
  type HebyDirectorBriefing,
  type HebyRecordedDecision,
} from "@/features/heby-core/heby-briefing-types";
import {
  hebyAuditSubjectKindOrder,
  hebyBriefingSectionOrder,
} from "@/features/heby-core/heby-briefing-rules";
import { hebyPresentationKindOrder } from "@/features/heby-core/heby-presentation-rules";
import { hebyPreparationKindOrder } from "@/features/heby-core/heby-approval-rules";
import { normalizeHebyConstraints, normalizeHebyDeclaredContext } from "@/features/heby-core/heby-input-context-normalization";
import type { HebyDirectorTermination } from "@/features/heby-core/heby-approval-types";
import type { HebyGovernanceScope } from "@/features/heby-core/heby-governance-types";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyPreparedItem } from "@/features/heby-core/heby-approval-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

// --- Clone + deep-freeze helpers (no input mutation) --------------------------

function freezeElement(element: HebyPresentationElement): HebyPresentationElement {
  return Object.freeze({ ...element, evidenceRefs: Object.freeze([...element.evidenceRefs]), uncertainty: Object.freeze([...element.uncertainty]) });
}

function freezeItem(item: HebyPreparedItem): HebyPreparedItem {
  return Object.freeze({ ...item, subjectRefs: Object.freeze([...item.subjectRefs]), consequences: Object.freeze([...item.consequences]) });
}

function freezeFinding(finding: HebyBriefingFinding): HebyBriefingFinding {
  return Object.freeze({ ...finding, subjectRefs: Object.freeze([...finding.subjectRefs]), sourceRefs: Object.freeze([...finding.sourceRefs]) });
}

function freezeHistory(entry: HebyBriefingHistory): HebyBriefingHistory {
  return Object.freeze({ ...entry, subjectRefs: Object.freeze([...entry.subjectRefs]) });
}

function freezeQuestion(question: HebyCarriedQuestion): HebyCarriedQuestion {
  return Object.freeze({ ...question, subjectRefs: Object.freeze([...question.subjectRefs]) });
}

function freezeDecision(decision: HebyRecordedDecision): HebyRecordedDecision {
  return Object.freeze({ ...decision, basisRefs: Object.freeze([...decision.basisRefs]) });
}

function freezeAudit(entry: HebyAuditEntry): HebyAuditEntry {
  return Object.freeze({ ...entry });
}

// --- Ordering (arrangement only) ---------------------------------------------

function orderElements(elements: readonly HebyPresentationElement[]): readonly HebyPresentationElement[] {
  return [...elements]
    .sort((left, right) => {
      const byKind = hebyPresentationKindOrder(left.kind) - hebyPresentationKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.elementId, right.elementId);
    })
    .map(freezeElement);
}

function orderItems(items: readonly HebyPreparedItem[]): readonly HebyPreparedItem[] {
  return [...items]
    .sort((left, right) => {
      const byKind = hebyPreparationKindOrder(left.kind) - hebyPreparationKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.itemId, right.itemId);
    })
    .map(freezeItem);
}

function orderFindings(findings: readonly HebyBriefingFinding[]): readonly HebyBriefingFinding[] {
  return [...findings]
    .sort((left, right) => {
      const bySection = hebyBriefingSectionOrder(left.section) - hebyBriefingSectionOrder(right.section);
      return bySection !== 0 ? bySection : compareStrings(left.findingId, right.findingId);
    })
    .map(freezeFinding);
}

function orderHistory(history: readonly HebyBriefingHistory[]): readonly HebyBriefingHistory[] {
  return [...history].sort((left, right) => compareStrings(left.historyId, right.historyId)).map(freezeHistory);
}

function orderQuestions(questions: readonly HebyCarriedQuestion[]): readonly HebyCarriedQuestion[] {
  return [...questions].sort((left, right) => compareStrings(left.questionId, right.questionId)).map(freezeQuestion);
}

function orderDecisions(decisions: readonly HebyRecordedDecision[]): readonly HebyRecordedDecision[] {
  return [...decisions].sort((left, right) => compareStrings(left.decisionId, right.decisionId)).map(freezeDecision);
}

function orderAudit(audit: readonly HebyAuditEntry[]): readonly HebyAuditEntry[] {
  return [...audit]
    .sort((left, right) => {
      const byKind = hebyAuditSubjectKindOrder(left.subjectKind) - hebyAuditSubjectKindOrder(right.subjectKind);
      return byKind !== 0 ? byKind : compareStrings(left.subjectId, right.subjectId);
    })
    .map(freezeAudit);
}

function freezeScope(scope: HebyGovernanceScope): HebyGovernanceScope {
  return Object.freeze({ tenantId: scope.tenantId, organizationId: scope.organizationId });
}

function freezeTermination(termination: HebyDirectorTermination): HebyDirectorTermination {
  return Object.freeze({ ...termination });
}

/**
 * Canonicalizes a Director briefing into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical briefing, and the canonical form
 * of a canonical briefing is itself. Every collection is ordered; the context is canonicalized;
 * the scope and termination are frozen; identities, statements, and states are carried UNCHANGED.
 */
export function normalizeHebyDirectorBriefing(briefing: HebyDirectorBriefing): CanonicalHebyDirectorBriefing {
  return Object.freeze({
    presentationId: briefing.presentationId,
    intentId: briefing.intentId,
    scope: freezeScope(briefing.scope),
    context: normalizeHebyDeclaredContext(briefing.context),
    constraints: Object.freeze(normalizeHebyConstraints(briefing.constraints)),
    elements: Object.freeze(orderElements(briefing.elements)),
    items: Object.freeze(orderItems(briefing.items)),
    findings: Object.freeze(orderFindings(briefing.findings)),
    history: Object.freeze(orderHistory(briefing.history)),
    questions: Object.freeze(orderQuestions(briefing.questions)),
    decisions: Object.freeze(orderDecisions(briefing.decisions)),
    audit: Object.freeze(orderAudit(briefing.audit)),
    termination: freezeTermination(briefing.termination),
  });
}

/**
 * A canonical, text-safe key for a whole Director briefing. The same briefing always produces the
 * same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyDirectorBriefingKey(briefing: HebyDirectorBriefing): string {
  return JSON.stringify([
    briefing.presentationId,
    briefing.intentId,
    [briefing.scope.tenantId, briefing.scope.organizationId],
    briefing.context.contextId,
    normalizeHebyConstraints(briefing.constraints).map((c) => [c.constraintKind, c.constraintId, c.statement]),
    orderElements(briefing.elements).map((e) => e.elementId),
    orderItems(briefing.items).map((i) => i.itemId),
    orderFindings(briefing.findings).map((f) => [f.findingId, f.section]),
    orderHistory(briefing.history).map((h) => [h.historyId, h.priorRef]),
    orderQuestions(briefing.questions).map((q) => q.questionId),
    orderDecisions(briefing.decisions).map((d) => [d.decisionId, d.supersedesRef]),
    orderAudit(briefing.audit).map((a) => [a.subjectKind, a.subjectId]),
    [briefing.termination.authorityBasis, briefing.termination.terminatesAtDirector],
  ]);
}
