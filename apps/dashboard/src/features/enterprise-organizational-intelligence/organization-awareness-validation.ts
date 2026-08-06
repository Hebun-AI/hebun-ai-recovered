/**
 * Enterprise Organizational Intelligence — organization awareness validation (Phase 5).
 *
 * Validates the STRUCTURAL integrity of an awareness context: the context is named;
 * every signal and assessment is scope-bound, basis-grounded (read-only learnings,
 * opportunities, or evidence), attributably provenanced, uncertainty-preserving, and
 * non-empty; every assessment is derived from at least one declared signal (signal
 * precedes assessment); and no artifact is duplicated. This is a plain, deterministic
 * structural check — NOT awareness detection, NOT assessment, NOT scoring, NOT
 * self-evaluation, NOT decision. It confirms shape and traceability only; it never
 * alters an artifact and detects no signal.
 */

import type { AwarenessContext } from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
import { awarenessBasisReachesSource } from "@/features/enterprise-organizational-intelligence/organization-awareness-rules";

export type OrganizationAwarenessValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, ids: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`awareness context declares duplicate ${label} ${id}`);
    seen.add(id);
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function validateOrganizationAwarenessContext(context: AwarenessContext): OrganizationAwarenessValidation {
  const issues: string[] = [];

  if (context.organizationId.length === 0) issues.push("awareness context has an empty organization id");
  if (context.purpose.length === 0) issues.push("awareness context has an empty purpose");
  if (context.scope.scopeId.length === 0) issues.push("awareness context has an empty scope id");

  const declaredDomains = new Set(context.scope.domains);
  const declaredSignals = new Set(context.signals.map((signal) => signal.signalId));

  for (const signal of context.signals) {
    const id = signal.signalId;
    if (signal.statement.length === 0) issues.push(`signal ${id} has an empty statement`);
    if (!declaredDomains.has(signal.domainId)) issues.push(`signal ${id} names an out-of-scope domain ${signal.domainId}`);
    if (!awarenessBasisReachesSource(signal.basis)) issues.push(`signal ${id} has no basis`);
    if (signal.provenance.attributedTo.length === 0) issues.push(`signal ${id} has no attribution`);
    if (!isPositiveInteger(signal.provenance.version)) issues.push(`signal ${id} has an invalid provenance version`);
    for (const uncertainty of signal.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`signal ${id} has an uncertainty with an empty statement`);
    }
  }

  for (const assessment of context.assessments) {
    const id = assessment.assessmentId;
    if (assessment.statement.length === 0) issues.push(`assessment ${id} has an empty statement`);
    if (!declaredDomains.has(assessment.domainId)) {
      issues.push(`assessment ${id} names an out-of-scope domain ${assessment.domainId}`);
    }
    // Signal precedes assessment: an assessment must evaluate at least one declared signal.
    if (assessment.derivedFrom.length === 0) issues.push(`assessment ${id} is derived from no signal`);
    for (const signalId of assessment.derivedFrom) {
      if (!declaredSignals.has(signalId)) issues.push(`assessment ${id} derives from an undeclared signal ${signalId}`);
    }
    if (!awarenessBasisReachesSource(assessment.basis)) issues.push(`assessment ${id} has no basis`);
    if (assessment.provenance.attributedTo.length === 0) issues.push(`assessment ${id} has no attribution`);
    if (!isPositiveInteger(assessment.provenance.version)) issues.push(`assessment ${id} has an invalid provenance version`);
    for (const uncertainty of assessment.uncertainties) {
      if (uncertainty.statement.length === 0) issues.push(`assessment ${id} has an uncertainty with an empty statement`);
    }
  }

  pushDuplicates("signal", context.signals.map((signal) => signal.signalId), issues);
  pushDuplicates("assessment", context.assessments.map((assessment) => assessment.assessmentId), issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
