/**
 * Heby Core — briefing rules (Phase 8, Director Briefing and Interaction Surface).
 *
 * Pure, deterministic lookups and projections over the briefing-section and audit-subject-kind
 * tables, the admitted subject identities a briefing may attribute to, and the full audit trail
 * Heby assembles over every carried subject. These answer plain questions — is this a known
 * section, do these references stay within the admitted surface, what does the audit cover — and
 * never decide, approve, resolve a decision, invent, or mutate anything. Only table reads and
 * pure, repeatable projections. Ordinals order sections and subject kinds for stable arrangement
 * only; they are never a rank, score, priority, or recommendation.
 */

import {
  HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS,
  HEBY_BRIEFING_SECTION_DESCRIPTORS,
  type HebyAuditEntry,
  type HebyAuditSubjectKind,
  type HebyAuditSubjectKindDescriptor,
  type HebyBriefingFinding,
  type HebyBriefingHistory,
  type HebyBriefingSection,
  type HebyBriefingSectionDescriptor,
  type HebyCarriedQuestion,
  type HebyRecordedDecision,
} from "@/features/heby-core/heby-briefing-types";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyPreparedItem } from "@/features/heby-core/heby-approval-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared briefing section. Read-only table check. */
export function isHebyBriefingSection(value: string): value is HebyBriefingSection {
  return Object.prototype.hasOwnProperty.call(HEBY_BRIEFING_SECTION_DESCRIPTORS, value);
}

/** True when a string is a declared audit subject kind. Read-only table check. */
export function isHebyAuditSubjectKind(value: string): value is HebyAuditSubjectKind {
  return Object.prototype.hasOwnProperty.call(HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for a briefing section. Read-only projection. */
export function hebyBriefingSectionDescriptorOf(section: HebyBriefingSection): HebyBriefingSectionDescriptor {
  return HEBY_BRIEFING_SECTION_DESCRIPTORS[section];
}

/** The fixed canonical order of a briefing section. Ordinal only — not a rank. */
export function hebyBriefingSectionOrder(section: HebyBriefingSection): number {
  return HEBY_BRIEFING_SECTION_DESCRIPTORS[section].order;
}

/** The canonical descriptor for an audit subject kind. Read-only projection. */
export function hebyAuditSubjectKindDescriptorOf(subjectKind: HebyAuditSubjectKind): HebyAuditSubjectKindDescriptor {
  return HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS[subjectKind];
}

/** The fixed canonical order of an audit subject kind. Ordinal only — not a rank. */
export function hebyAuditSubjectKindOrder(subjectKind: HebyAuditSubjectKind): number {
  return HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS[subjectKind].order;
}

// --- Admitted-surface containment --------------------------------------------

/** The set of admitted element identities a briefing may attribute to. Read-only projection. */
export function hebyAdmittedElementIdSet(elements: readonly HebyPresentationElement[]): ReadonlySet<HebyId> {
  const ids = new Set<HebyId>();
  for (const element of elements) ids.add(element.elementId);
  return ids;
}

/**
 * True when every reference stays within the admitted element identities — a finding, history,
 * question, or decision may rest only on admitted, ungated evidence. Fail-closed: an empty set,
 * or any reference outside the admitted surface, is not contained.
 */
export function hebyRefsWithinAdmitted(refs: readonly HebyId[], admittedIds: ReadonlySet<HebyId>): boolean {
  if (refs.length === 0) return false;
  for (const ref of refs) {
    if (!admittedIds.has(ref)) return false;
  }
  return true;
}

// --- Audit assembly ----------------------------------------------------------

/**
 * The full audit trail over every carried subject: one entry per admitted element, admitted item,
 * finding, history entry, carried question, and recorded decision. Deterministic enumeration —
 * it records what is present, invents nothing, and confers no authority. The full audit trail
 * accompanies every briefing.
 */
export function hebyAssembleAudit(
  elements: readonly HebyPresentationElement[],
  items: readonly HebyPreparedItem[],
  findings: readonly HebyBriefingFinding[],
  history: readonly HebyBriefingHistory[],
  questions: readonly HebyCarriedQuestion[],
  decisions: readonly HebyRecordedDecision[],
): readonly HebyAuditEntry[] {
  const audit: HebyAuditEntry[] = [];
  for (const element of elements) audit.push({ subjectKind: "element", subjectId: element.elementId });
  for (const item of items) audit.push({ subjectKind: "item", subjectId: item.itemId });
  for (const finding of findings) audit.push({ subjectKind: "finding", subjectId: finding.findingId });
  for (const entry of history) audit.push({ subjectKind: "history", subjectId: entry.historyId });
  for (const question of questions) audit.push({ subjectKind: "question", subjectId: question.questionId });
  for (const decision of decisions) audit.push({ subjectKind: "decision", subjectId: decision.decisionId });
  return audit;
}

// --- Complete canonical lists ------------------------------------------------

/** Every declared briefing section, in canonical order. Deterministic. */
export function allHebyBriefingSections(): readonly HebyBriefingSection[] {
  return (Object.keys(HEBY_BRIEFING_SECTION_DESCRIPTORS) as HebyBriefingSection[]).sort(
    (left, right) => hebyBriefingSectionOrder(left) - hebyBriefingSectionOrder(right),
  );
}

/** Every declared audit subject kind, in canonical order. Deterministic. */
export function allHebyAuditSubjectKinds(): readonly HebyAuditSubjectKind[] {
  return (Object.keys(HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS) as HebyAuditSubjectKind[]).sort(
    (left, right) => hebyAuditSubjectKindOrder(left) - hebyAuditSubjectKindOrder(right),
  );
}
