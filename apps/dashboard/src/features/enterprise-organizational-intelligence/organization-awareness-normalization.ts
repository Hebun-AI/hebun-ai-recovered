/**
 * Enterprise Organizational Intelligence — organization awareness normalization (Phase 5).
 *
 * Deterministically canonicalizes an awareness context:
 *   - each artifact's basis (learnings + opportunities + evidence), uncertainties, and
 *     an assessment's derived-from signal set are de-duplicated and totally ordered;
 *     the artifact is otherwise carried UNCHANGED,
 *   - signals and assessments are de-duplicated by identity and totally ordered,
 *   - the whole context is emitted immutable and frozen.
 *
 * This is pure canonicalization — NO awareness detection, NO assessment, NO scoring, NO
 * self-evaluation. Ordering and de-duplication only; the artifact values are the very
 * objects declared upstream. Keys use JSON encoding so they are unambiguous, text-safe,
 * UTF-8 stable, and NUL-safe.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning";
import type {
  AwarenessBasis,
  AwarenessContext,
  AwarenessUncertainty,
  StrategicAssessment,
  StrategicSignal,
  StrategicSignalId,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a list of items by a canonical key. */
function canonicalize<T>(items: readonly T[], keyOf: (item: T) => string): readonly T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.keys()].sort(compareStrings).map((key) => {
    const item = byKey.get(key);
    if (item === undefined) throw new Error("canonicalize: missing item");
    return item;
  });
}

/** De-duplicates and totally orders a basis: learnings and opportunities by id, evidence by key. */
export function normalizeAwarenessBasis(basis: AwarenessBasis): AwarenessBasis {
  return {
    learnings: canonicalize(basis.learnings, (id) => JSON.stringify(id)),
    opportunities: canonicalize(basis.opportunities, (id) => JSON.stringify(id)),
    evidence: canonicalize(basis.evidence, evidenceKey),
  };
}

/** De-duplicates and totally orders an uncertainty list by statement. */
export function normalizeAwarenessUncertainties(
  uncertainties: readonly AwarenessUncertainty[],
): readonly AwarenessUncertainty[] {
  return canonicalize(uncertainties, (uncertainty) => JSON.stringify(uncertainty.statement));
}

/** De-duplicates and totally orders a derived-from signal set. */
export function normalizeAwarenessDerivedFrom(
  derivedFrom: readonly StrategicSignalId[],
): readonly StrategicSignalId[] {
  return canonicalize(derivedFrom, (id) => JSON.stringify(id));
}

/** Returns the signal with its basis and uncertainties canonicalized; rest unchanged. */
export function normalizeStrategicSignal(signal: StrategicSignal): StrategicSignal {
  return {
    signalId: signal.signalId,
    dimension: signal.dimension,
    domainId: signal.domainId,
    statement: signal.statement,
    basis: normalizeAwarenessBasis(signal.basis),
    provenance: signal.provenance,
    uncertainties: normalizeAwarenessUncertainties(signal.uncertainties),
  };
}

/** Returns the assessment with basis, derived-from, and uncertainties canonicalized; rest unchanged. */
export function normalizeStrategicAssessment(assessment: StrategicAssessment): StrategicAssessment {
  return {
    assessmentId: assessment.assessmentId,
    dimension: assessment.dimension,
    domainId: assessment.domainId,
    statement: assessment.statement,
    derivedFrom: normalizeAwarenessDerivedFrom(assessment.derivedFrom),
    basis: normalizeAwarenessBasis(assessment.basis),
    provenance: assessment.provenance,
    uncertainties: normalizeAwarenessUncertainties(assessment.uncertainties),
  };
}

/** De-duplicates by identity and totally orders signals; each is canonicalized. */
export function normalizeStrategicSignals(signals: readonly StrategicSignal[]): readonly StrategicSignal[] {
  const byId = new Map<string, StrategicSignal>();
  for (const signal of signals) {
    if (!byId.has(signal.signalId)) byId.set(signal.signalId, normalizeStrategicSignal(signal));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const signal = byId.get(id);
    if (signal === undefined) throw new Error("normalizeStrategicSignals: missing signal");
    return signal;
  });
}

/** De-duplicates by identity and totally orders assessments; each is canonicalized. */
export function normalizeStrategicAssessments(
  assessments: readonly StrategicAssessment[],
): readonly StrategicAssessment[] {
  const byId = new Map<string, StrategicAssessment>();
  for (const assessment of assessments) {
    if (!byId.has(assessment.assessmentId)) byId.set(assessment.assessmentId, normalizeStrategicAssessment(assessment));
  }
  return [...byId.keys()].sort(compareStrings).map((id) => {
    const assessment = byId.get(id);
    if (assessment === undefined) throw new Error("normalizeStrategicAssessments: missing assessment");
    return assessment;
  });
}

/** Canonicalizes an awareness context: signals and assessments normalized, rest carried. */
export function normalizeAwarenessContext(context: AwarenessContext): AwarenessContext {
  return {
    organizationId: context.organizationId,
    purpose: context.purpose,
    scope: context.scope,
    signals: normalizeStrategicSignals(context.signals),
    assessments: normalizeStrategicAssessments(context.assessments),
  };
}

/** A canonical key for an awareness context: organization, scope, signals, assessments. */
export function canonicalAwarenessContextKey(context: AwarenessContext): string {
  const normalized = normalizeAwarenessContext(context);
  return JSON.stringify([
    normalized.organizationId,
    normalized.scope.scopeId,
    normalized.signals.map((signal) => signal.signalId),
    normalized.assessments.map((assessment) => assessment.assessmentId),
  ]);
}

/** Canonicalizes and freezes an awareness context. Deterministic: same in, same out. */
export function normalizeOrganizationAwarenessContext(context: AwarenessContext): AwarenessContext {
  return Object.freeze(normalizeAwarenessContext(context));
}
