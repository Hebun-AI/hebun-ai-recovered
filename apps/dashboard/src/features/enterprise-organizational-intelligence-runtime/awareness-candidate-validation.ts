/**
 * Enterprise Organizational Intelligence Runtime — awareness candidate validation (Phase 5).
 *
 * Validates the STRUCTURAL integrity of a proposed awareness request and of a prepared
 * Awareness Candidate set: the bound Runtime Context, the supporting Learning Candidate
 * set, and the supporting Optimization Candidate set are well-formed, evidence is
 * well-formed, and every seed is identified, grounded in declared learning, declared
 * optimization, and eligible evidence, and carries complete provenance, explanation, and
 * confidence. This is a plain, deterministic structural check — NOT runtime behaviour,
 * NOT an assessment, NOT scoring, NOT prioritization, NOT monitoring. It is fail-closed:
 * any missing, malformed, ungrounded, or ineligible field blocks a valid awareness pass.
 * No candidate is ever emitted without a basis, provenance, explanation, and confidence.
 */

import {
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { runtimeLifecycleIsTerminal } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import { validateRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import type {
  LearningCandidate,
  LearningEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import {
  groundsInEligibleEvidence,
  learningEvidenceIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-rules";
import { validateLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
import type { OptimizationCandidate } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import {
  groundsInDeclaredLearning,
  learningSupportIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-rules";
import { validateOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
import type {
  AwarenessCandidateRequest,
  AwarenessCandidateSeed,
  AwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import {
  groundsInDeclaredOptimization,
  optimizationSupportIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";

export type AwarenessCandidateValidation =
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

/** Structural checks over one seed, grounded against learning, optimization, and evidence indexes. */
function collectSeedIssues(
  seed: AwarenessCandidateSeed,
  learningIndex: ReadonlyMap<string, LearningCandidate>,
  optimizationIndex: ReadonlyMap<string, OptimizationCandidate>,
  evidenceIndex: ReadonlyMap<string, LearningEvidence>,
  issues: string[],
): void {
  const label = seed.candidateId;
  if (!isNonEmpty(seed.candidateId)) issues.push("seed declares no candidateId");
  if (!isNonEmpty(seed.statement)) issues.push(`seed '${label}' declares no statement`);

  // Learning grounding: non-empty basis, every reference resolves in the learning set.
  // Redundant references are harmless and canonicalized away in normalization.
  if (seed.learningRefs.length === 0) issues.push(`seed '${label}' declares no supporting learning`);
  for (const ref of seed.learningRefs) {
    if (!isNonEmpty(ref)) issues.push(`seed '${label}' declares an empty learning reference`);
  }
  if (seed.learningRefs.length > 0 && !groundsInDeclaredLearning(seed.learningRefs, learningIndex)) {
    issues.push(`seed '${label}' grounds in learning absent from the qualified set`);
  }

  // Optimization grounding: non-empty basis, every reference resolves in the optimization set.
  if (seed.optimizationRefs.length === 0) issues.push(`seed '${label}' declares no supporting optimization`);
  for (const ref of seed.optimizationRefs) {
    if (!isNonEmpty(ref)) issues.push(`seed '${label}' declares an empty optimization reference`);
  }
  if (seed.optimizationRefs.length > 0 && !groundsInDeclaredOptimization(seed.optimizationRefs, optimizationIndex)) {
    issues.push(`seed '${label}' grounds in optimization absent from the qualified set`);
  }

  // Evidence grounding: non-empty basis, every reference present and eligible.
  if (seed.evidenceRefs.length === 0) issues.push(`seed '${label}' declares no supporting evidence`);
  for (const ref of seed.evidenceRefs) {
    if (!isNonEmpty(ref)) issues.push(`seed '${label}' declares an empty evidence reference`);
  }
  if (seed.evidenceRefs.length > 0 && !groundsInEligibleEvidence(seed.evidenceRefs, evidenceIndex)) {
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
 * Validates a proposed awareness request: a well-formed bound Runtime Context, a
 * well-formed supporting Learning Candidate set, a well-formed supporting Optimization
 * Candidate set, a well-formed evidence pool, and every seed identified, grounded in
 * declared learning, declared optimization, and eligible evidence, and carrying complete
 * provenance, explanation, and confidence — with no duplicate candidate identity.
 * Fail-closed.
 */
export function validateAwarenessCandidateRequest(
  request: AwarenessCandidateRequest,
): AwarenessCandidateValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");

  const bundleValidation = validateRuntimeBundle(request.bundle);
  if (!bundleValidation.ok) {
    for (const issue of bundleValidation.issues) issues.push(`bundle: ${issue}`);
  }

  const learningValidation = validateLearningCandidateSet(request.learningSet);
  if (!learningValidation.ok) {
    for (const issue of learningValidation.issues) issues.push(`learning-set: ${issue}`);
  }

  const optimizationValidation = validateOptimizationCandidateSet(request.optimizationSet);
  if (!optimizationValidation.ok) {
    for (const issue of optimizationValidation.issues) issues.push(`optimization-set: ${issue}`);
  }

  collectEvidenceIssues(request.evidence, issues);

  const learningIndex = learningSupportIndex(request.learningSet);
  const optimizationIndex = optimizationSupportIndex(request.optimizationSet);
  const evidenceIndex = learningEvidenceIndex(request.evidence);
  const candidateIds = new Set<string>();
  for (const seed of request.seeds) {
    collectSeedIssues(seed, learningIndex, optimizationIndex, evidenceIndex, issues);
    if (candidateIds.has(seed.candidateId)) {
      issues.push(`candidate id '${seed.candidateId}' is declared more than once`);
    }
    candidateIds.add(seed.candidateId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Awareness Candidate set: every candidate is of the awareness-signal
 * kind, grounded in a non-empty supporting learning basis, a non-empty supporting
 * optimization basis, and a non-empty supporting evidence basis, with a unique identity;
 * the set awaits a Director decision. Defensive, post-identification, and fail-closed.
 */
export function validateAwarenessCandidateSet(
  set: AwarenessCandidateSet,
): AwarenessCandidateValidation {
  const issues: string[] = [];

  if (!isNonEmpty(set.requestId)) issues.push("set declares no requestId");
  if (set.approval.state !== "pending-director") issues.push("set is not pending a Director decision");

  const candidateIds = new Set<string>();
  for (const candidate of set.candidates) {
    if (candidate.candidateKind !== "awareness-signal") {
      issues.push(`candidate '${candidate.candidateId}' is not of the awareness-signal kind`);
    }
    if (candidate.learningRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting learning`);
    }
    if (candidate.optimizationRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting optimization`);
    }
    if (candidate.evidenceRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting evidence`);
    }
    if (candidateIds.has(candidate.candidateId)) {
      issues.push(`candidate id '${candidate.candidateId}' appears more than once`);
    }
    candidateIds.add(candidate.candidateId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
