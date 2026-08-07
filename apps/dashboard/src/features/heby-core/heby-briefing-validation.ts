/**
 * Heby Core — briefing validation (Phase 8, Director Briefing and Interaction Surface).
 *
 * Validates the STRUCTURAL and boundary integrity of a briefing request and of an assembled
 * Director briefing: Heby's identity is intact; the Phase 7 gated presentation is well-formed;
 * every finding, history entry, carried question, and recorded decision rests only on the
 * admitted, ungated surface; every prior state is carried, never fabricated; every recorded
 * decision is immutable except by ATTRIBUTABLE supersession; the audit trail covers every carried
 * subject exactly; and the briefing terminates at the Director Approval boundary.
 *
 * This is a plain, deterministic structural check — NOT a model call, NOT reasoning, NOT a
 * decision, NOT an approval. It is fail-closed: a dangling reference, a missing prior state, an
 * unattributable or self- or ambiguous supersession, an incomplete audit trail, or a termination
 * that does not stop at the Director blocks the whole briefing. A finding is never an approval,
 * and no path advances past a human decision.
 */

import {
  type HebyBriefingRequest,
  type HebyDirectorBriefing,
} from "@/features/heby-core/heby-briefing-types";
import {
  hebyAdmittedElementIdSet,
  hebyRefsWithinAdmitted,
  isHebyAuditSubjectKind,
  isHebyBriefingSection,
} from "@/features/heby-core/heby-briefing-rules";
import { validateHebyIdentity } from "@/features/heby-core/heby-identity-validation";
import type { HebyGatedPresentation } from "@/features/heby-core/heby-governance-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyBriefingValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** Structural checks over the Phase 7 gated presentation the briefing assembles from. */
function collectGatedIssues(gated: HebyGatedPresentation, issues: string[]): void {
  if (!isNonEmpty(gated.presentationId)) issues.push("gated declares no presentationId");
  if (!isNonEmpty(gated.intentId)) issues.push("gated declares no intentId");
  if (!isNonEmpty(gated.scope.tenantId)) issues.push("gated declares no tenant scope");
  if (!isNonEmpty(gated.scope.organizationId)) issues.push("gated declares no organization scope");
  if (!isNonEmpty(gated.context.contextId)) issues.push("context declares no contextId");
  if (!isNonEmpty(gated.context.authorityBasis)) issues.push("context declares no authority basis");
}

/** Ensures ids are unique within one collection, recording the first duplicate. */
function collectUnique(ids: readonly HebyId[], label: string, issues: string[]): void {
  const seen = new Set<HebyId>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`${label} id '${id}' appears more than once`);
    seen.add(id);
  }
}

/**
 * Validates a briefing request: Heby's identity is intact, the gated presentation is well-formed,
 * and every finding, history entry, question, and decision rests only on the admitted surface,
 * carries a real statement, names a prior state where required, and supersedes only attributably.
 * Fail-closed: any issue blocks the assembly.
 */
export function validateHebyBriefingRequest(request: HebyBriefingRequest): HebyBriefingValidation {
  const issues: string[] = [];

  const identityValidation = validateHebyIdentity(request.identity);
  if (!identityValidation.ok) {
    for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);
  }

  collectGatedIssues(request.gated, issues);

  const admittedIds = hebyAdmittedElementIdSet(request.gated.admittedElements);

  // Findings: advisory, attributable to admitted elements, never invented.
  collectUnique(request.findings.map((f) => f.findingId), "finding", issues);
  for (const finding of request.findings) {
    if (!isNonEmpty(finding.findingId)) issues.push("a finding declares no findingId");
    if (!isHebyBriefingSection(finding.section)) issues.push(`finding '${finding.findingId}' declares unknown section '${finding.section}'`);
    if (!isNonEmpty(finding.statement)) issues.push(`finding '${finding.findingId}' declares no statement`);
    if (!hebyRefsWithinAdmitted(finding.subjectRefs, admittedIds)) issues.push(`finding '${finding.findingId}' rests on a non-admitted subject`);
  }

  // History: prior state carried as immutable evidence — never fabricated, never missing.
  collectUnique(request.history.map((h) => h.historyId), "history", issues);
  for (const entry of request.history) {
    if (!isNonEmpty(entry.historyId)) issues.push("a history entry declares no historyId");
    if (!isNonEmpty(entry.priorRef)) issues.push(`history '${entry.historyId}' declares no prior reference`);
    if (!isNonEmpty(entry.statement)) issues.push(`history '${entry.historyId}' declares no statement`);
    if (!hebyRefsWithinAdmitted(entry.subjectRefs, admittedIds)) issues.push(`history '${entry.historyId}' rests on a non-admitted subject`);
  }

  // Questions: carried across the human boundary, unresolved.
  collectUnique(request.questions.map((q) => q.questionId), "question", issues);
  for (const question of request.questions) {
    if (!isNonEmpty(question.questionId)) issues.push("a question declares no questionId");
    if (!isNonEmpty(question.question)) issues.push(`question '${question.questionId}' declares no question`);
    if (!hebyRefsWithinAdmitted(question.subjectRefs, admittedIds)) issues.push(`question '${question.questionId}' rests on a non-admitted subject`);
  }

  // Decisions: recorded human acts, carried and not resolved; immutable except by attributable
  // supersession.
  collectUnique(request.decisions.map((d) => d.decisionId), "decision", issues);
  const decisionIds = new Set<HebyId>(request.decisions.map((d) => d.decisionId));
  const supersededTargets = new Set<HebyId>();
  for (const decision of request.decisions) {
    if (!isNonEmpty(decision.decisionId)) issues.push("a decision declares no decisionId");
    if (!isNonEmpty(decision.recordedState)) issues.push(`decision '${decision.decisionId}' declares no recorded state`);
    if (!hebyRefsWithinAdmitted(decision.basisRefs, admittedIds)) issues.push(`decision '${decision.decisionId}' rests on a non-admitted basis`);
    if (decision.supersedesRef !== null) {
      if (decision.supersedesRef === decision.decisionId) issues.push(`decision '${decision.decisionId}' supersedes itself`);
      else if (!decisionIds.has(decision.supersedesRef)) issues.push(`decision '${decision.decisionId}' supersedes an unattributable decision '${decision.supersedesRef}'`);
      if (supersededTargets.has(decision.supersedesRef)) issues.push(`decision target '${decision.supersedesRef}' is superseded more than once`);
      supersededTargets.add(decision.supersedesRef);
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates an assembled Director briefing. Defensive, post-assembly, and fail-closed: the
 * briefing terminates at the Director with a visible authority basis; every finding is an
 * advisory section (never an approval); every carried subject rests only on the admitted surface;
 * every recorded decision remains attributably superseded at most once; and the audit trail
 * covers every carried subject exactly — no gap, no phantom entry.
 */
export function validateHebyDirectorBriefing(briefing: HebyDirectorBriefing): HebyBriefingValidation {
  const issues: string[] = [];

  if (!isNonEmpty(briefing.presentationId)) issues.push("briefing declares no presentationId");
  if (!isNonEmpty(briefing.intentId)) issues.push("briefing declares no intentId");
  if (briefing.termination.terminatesAtDirector !== true) issues.push("briefing does not terminate at the Director");
  if (!isNonEmpty(briefing.termination.authorityBasis)) issues.push("briefing declares no visible authority basis");

  const admittedIds = hebyAdmittedElementIdSet(briefing.elements);
  for (const finding of briefing.findings) {
    if (!isHebyBriefingSection(finding.section)) issues.push(`finding '${finding.findingId}' declares unknown section '${finding.section}'`);
    if (!hebyRefsWithinAdmitted(finding.subjectRefs, admittedIds)) issues.push(`finding '${finding.findingId}' rests on a non-admitted subject`);
  }
  for (const entry of briefing.history) {
    if (!isNonEmpty(entry.priorRef)) issues.push(`history '${entry.historyId}' declares no prior reference`);
    if (!hebyRefsWithinAdmitted(entry.subjectRefs, admittedIds)) issues.push(`history '${entry.historyId}' rests on a non-admitted subject`);
  }
  for (const question of briefing.questions) {
    if (!hebyRefsWithinAdmitted(question.subjectRefs, admittedIds)) issues.push(`question '${question.questionId}' rests on a non-admitted subject`);
  }
  const decisionIds = new Set<HebyId>(briefing.decisions.map((d) => d.decisionId));
  const supersededTargets = new Set<HebyId>();
  for (const decision of briefing.decisions) {
    if (!hebyRefsWithinAdmitted(decision.basisRefs, admittedIds)) issues.push(`decision '${decision.decisionId}' rests on a non-admitted basis`);
    if (decision.supersedesRef !== null) {
      if (decision.supersedesRef === decision.decisionId || !decisionIds.has(decision.supersedesRef)) issues.push(`decision '${decision.decisionId}' supersedes unattributably`);
      if (supersededTargets.has(decision.supersedesRef)) issues.push(`decision target '${decision.supersedesRef}' is superseded more than once`);
      supersededTargets.add(decision.supersedesRef);
    }
  }

  // Audit trail: full coverage of every carried subject, no gap and no phantom.
  const expected = new Set<string>();
  for (const element of briefing.elements) expected.add(`element:${element.elementId}`);
  for (const item of briefing.items) expected.add(`item:${item.itemId}`);
  for (const finding of briefing.findings) expected.add(`finding:${finding.findingId}`);
  for (const entry of briefing.history) expected.add(`history:${entry.historyId}`);
  for (const question of briefing.questions) expected.add(`question:${question.questionId}`);
  for (const decision of briefing.decisions) expected.add(`decision:${decision.decisionId}`);

  const covered = new Set<string>();
  for (const entry of briefing.audit) {
    if (!isHebyAuditSubjectKind(entry.subjectKind)) {
      issues.push(`audit entry for '${entry.subjectId}' declares unknown subject kind '${entry.subjectKind}'`);
      continue;
    }
    const key = `${entry.subjectKind}:${entry.subjectId}`;
    if (!expected.has(key)) issues.push(`audit entry '${key}' attributes no carried subject`);
    if (covered.has(key)) issues.push(`audit entry '${key}' appears more than once`);
    covered.add(key);
  }
  for (const key of expected) {
    if (!covered.has(key)) issues.push(`carried subject '${key}' is missing from the audit trail`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical Director briefing is deep-frozen: the briefing, its scope, context,
 * constraint list, element list, item list, finding list, history list, question list, decision
 * list, audit list, Director termination, and every nested reference list are all immutable.
 * Defensive, post-normalization, and fail-closed.
 */
export function verifyHebyDirectorBriefingFrozen(briefing: HebyDirectorBriefing): HebyBriefingValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(briefing)) issues.push("briefing is not frozen");
  if (!Object.isFrozen(briefing.scope)) issues.push("scope is not frozen");
  if (!Object.isFrozen(briefing.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(briefing.termination)) issues.push("termination is not frozen");

  for (const [label, list] of [
    ["constraints", briefing.constraints],
    ["elements", briefing.elements],
    ["items", briefing.items],
    ["findings", briefing.findings],
    ["history", briefing.history],
    ["questions", briefing.questions],
    ["decisions", briefing.decisions],
    ["audit", briefing.audit],
  ] as const) {
    if (!Object.isFrozen(list)) issues.push(`${label} list is not frozen`);
    for (const member of list) {
      if (!Object.isFrozen(member)) issues.push(`a ${label} member is not frozen`);
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
