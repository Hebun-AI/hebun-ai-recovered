/**
 * Enterprise Organizational Intelligence Runtime — learning candidate validation (Phase 3).
 *
 * Validates the STRUCTURAL integrity of a proposed learning request and of a prepared
 * Learning Candidate set: the bound Runtime Context is well-formed, evidence is
 * well-formed, and every seed is identified, grounded in eligible evidence, and carries
 * complete provenance, explanation, and confidence. This is a plain, deterministic
 * structural check — NOT runtime behaviour, NOT knowledge admission, NOT fact creation,
 * NOT inference, NOT a decision. It is fail-closed: any missing, malformed, ineligible,
 * or ungrounded field blocks a valid learning pass. No candidate is ever emitted
 * without provenance, explanation, and confidence.
 */

import {
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { runtimeLifecycleIsTerminal } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import { validateRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import type {
  LearningCandidateRequest,
  LearningCandidateSeed,
  LearningCandidateSet,
  LearningEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import {
  groundsInEligibleEvidence,
  learningEvidenceIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-rules";

export type LearningCandidateValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Structural checks over the evidence pool. Appends any issues found. */
function collectEvidenceIssues(evidence: readonly LearningEvidence[], issues: string[]): void {
  const evidenceIds = new Set<string>();
  for (const item of evidence) {
    if (!isNonEmpty(item.evidenceId)) issues.push("evidence declares no evidenceId");
    if (!isNonEmpty(item.source)) issues.push(`evidence '${item.evidenceId}' declares no source`);
    if (!isNonEmpty(item.statement)) issues.push(`evidence '${item.evidenceId}' declares no statement`);
    if (!isNonEmpty(item.effectivePeriod)) {
      issues.push(`evidence '${item.evidenceId}' declares no effectivePeriod`);
    }
    if (evidenceIds.has(item.evidenceId)) {
      issues.push(`evidence id '${item.evidenceId}' is declared more than once`);
    }
    evidenceIds.add(item.evidenceId);
  }
}

/** Structural checks over one seed, grounded against the evidence index. Appends issues. */
function collectSeedIssues(
  seed: LearningCandidateSeed,
  index: ReadonlyMap<string, LearningEvidence>,
  issues: string[],
): void {
  const label = seed.candidateId;
  if (!isNonEmpty(seed.candidateId)) issues.push("seed declares no candidateId");
  if (!isNonEmpty(seed.statement)) issues.push(`seed '${label}' declares no statement`);

  // Evidence grounding: non-empty basis, every ref present and eligible. Redundant
  // references are harmless and canonicalized away in normalization, not rejected here.
  if (seed.evidenceRefs.length === 0) issues.push(`seed '${label}' declares no evidence basis`);
  for (const ref of seed.evidenceRefs) {
    if (!isNonEmpty(ref)) issues.push(`seed '${label}' declares an empty evidence reference`);
  }
  if (seed.evidenceRefs.length > 0 && !groundsInEligibleEvidence(seed.evidenceRefs, index)) {
    issues.push(`seed '${label}' grounds in missing or ineligible evidence`);
  }

  // Provenance: complete and in a pre-briefing, non-terminal lifecycle state.
  if (!isNonEmpty(seed.provenance.source)) issues.push(`seed '${label}' provenance declares no source`);
  if (!isNonEmpty(seed.provenance.attribution)) {
    issues.push(`seed '${label}' provenance declares no attribution`);
  }
  if (!isPositiveInteger(seed.provenance.version)) {
    issues.push(`seed '${label}' provenance declares a non-positive-integer version`);
  }
  if (!isNonEmpty(seed.provenance.effectivePeriod)) {
    issues.push(`seed '${label}' provenance declares no effectivePeriod`);
  }
  if (!(seed.provenance.lifecycle in RUNTIME_LIFECYCLE_STATE_DESCRIPTORS)) {
    issues.push(`seed '${label}' provenance declares unknown lifecycle '${seed.provenance.lifecycle}'`);
  } else if (runtimeLifecycleIsTerminal(seed.provenance.lifecycle)) {
    issues.push(`seed '${label}' provenance declares a terminal lifecycle state`);
  } else if (seed.provenance.lifecycle === "briefed") {
    issues.push(`seed '${label}' provenance declares the briefed lifecycle, reserved for a later phase`);
  }

  // Explanation: a candidate is never emitted without a basis for explanation.
  if (seed.explainability.basis.length === 0) issues.push(`seed '${label}' declares no explanation basis`);

  // Confidence: a known, declared level.
  if (!(seed.confidence.level in RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS)) {
    issues.push(`seed '${label}' declares unknown confidence level '${seed.confidence.level}'`);
  }

  // Supersession preserves history: never self-supersede; a declared prior is non-empty.
  if (seed.supersedes !== null) {
    if (!isNonEmpty(seed.supersedes)) issues.push(`seed '${label}' declares an empty supersedes reference`);
    if (seed.supersedes === seed.candidateId) issues.push(`seed '${label}' supersedes itself`);
  }
}

/**
 * Validates a proposed learning request: a well-formed bound Runtime Context, a
 * well-formed evidence pool, and every seed identified, grounded in eligible evidence,
 * and carrying complete provenance, explanation, and confidence — with no duplicate
 * candidate identity. Fail-closed.
 */
export function validateLearningCandidateRequest(
  request: LearningCandidateRequest,
): LearningCandidateValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");

  const bundleValidation = validateRuntimeBundle(request.bundle);
  if (!bundleValidation.ok) {
    for (const issue of bundleValidation.issues) issues.push(`bundle: ${issue}`);
  }

  collectEvidenceIssues(request.evidence, issues);

  const index = learningEvidenceIndex(request.evidence);
  const candidateIds = new Set<string>();
  for (const seed of request.seeds) {
    collectSeedIssues(seed, index, issues);
    if (candidateIds.has(seed.candidateId)) {
      issues.push(`candidate id '${seed.candidateId}' is declared more than once`);
    }
    candidateIds.add(seed.candidateId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Learning Candidate set: every candidate is of the learning kind,
 * grounded in a non-empty evidence basis, with a unique identity; the set awaits a
 * Director decision. Defensive, post-identification, and fail-closed.
 */
export function validateLearningCandidateSet(set: LearningCandidateSet): LearningCandidateValidation {
  const issues: string[] = [];

  if (!isNonEmpty(set.requestId)) issues.push("set declares no requestId");
  if (set.approval.state !== "pending-director") issues.push("set is not pending a Director decision");

  const candidateIds = new Set<string>();
  for (const candidate of set.candidates) {
    if (candidate.candidateKind !== "learning") {
      issues.push(`candidate '${candidate.candidateId}' is not of the learning kind`);
    }
    if (candidate.evidenceRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no evidence basis`);
    }
    if (candidateIds.has(candidate.candidateId)) {
      issues.push(`candidate id '${candidate.candidateId}' appears more than once`);
    }
    candidateIds.add(candidate.candidateId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
