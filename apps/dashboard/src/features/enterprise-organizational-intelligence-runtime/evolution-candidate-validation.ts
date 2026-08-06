/**
 * Enterprise Organizational Intelligence Runtime — evolution candidate validation (Phase 6).
 *
 * Validates the STRUCTURAL integrity of a proposed evolution request and of a prepared
 * Evolution Candidate set: the bound Runtime Context, the supporting Learning Candidate
 * set, the supporting Optimization Candidate set, and the supporting Awareness Candidate
 * set are well-formed, evidence is well-formed, and every seed is of an evolution kind,
 * identified, grounded in declared learning, declared optimization, declared awareness,
 * and eligible evidence, and carries complete provenance, explanation, and confidence.
 * This is a plain, deterministic structural check — NOT runtime behaviour, NOT a readiness
 * assessment, NOT forecasting, NOT simulation, NOT roadmap generation, NOT planning. It is
 * fail-closed: any missing, malformed, ungrounded, or ineligible field blocks a valid
 * evolution pass. No candidate is ever emitted without a basis, provenance, explanation,
 * and confidence.
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
import type { AwarenessCandidate } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import {
  groundsInDeclaredOptimization,
  optimizationSupportIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";
import { validateAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
import type {
  EvolutionCandidateRequest,
  EvolutionCandidateSeed,
  EvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";
import {
  awarenessSupportIndex,
  groundsInDeclaredAwareness,
  isEvolutionCandidateKind,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-rules";

export type EvolutionCandidateValidation =
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

/**
 * Structural checks over one seed, grounded against learning, optimization, awareness, and
 * evidence indexes.
 */
function collectSeedIssues(
  seed: EvolutionCandidateSeed,
  learningIndex: ReadonlyMap<string, LearningCandidate>,
  optimizationIndex: ReadonlyMap<string, OptimizationCandidate>,
  awarenessIndex: ReadonlyMap<string, AwarenessCandidate>,
  evidenceIndex: ReadonlyMap<string, LearningEvidence>,
  issues: string[],
): void {
  const label = seed.candidateId;
  if (!isNonEmpty(seed.candidateId)) issues.push("seed declares no candidateId");
  if (!isNonEmpty(seed.statement)) issues.push(`seed '${label}' declares no statement`);
  if (!isEvolutionCandidateKind(seed.candidateKind)) {
    issues.push(`seed '${label}' declares a non-evolution kind '${seed.candidateKind}'`);
  }

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

  // Awareness grounding: non-empty basis, every reference resolves in the awareness set.
  if (seed.awarenessRefs.length === 0) issues.push(`seed '${label}' declares no supporting awareness`);
  for (const ref of seed.awarenessRefs) {
    if (!isNonEmpty(ref)) issues.push(`seed '${label}' declares an empty awareness reference`);
  }
  if (seed.awarenessRefs.length > 0 && !groundsInDeclaredAwareness(seed.awarenessRefs, awarenessIndex)) {
    issues.push(`seed '${label}' grounds in awareness absent from the qualified set`);
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
 * Validates a proposed evolution request: a well-formed bound Runtime Context, a
 * well-formed supporting Learning Candidate set, Optimization Candidate set, and Awareness
 * Candidate set, a well-formed evidence pool, and every seed of an evolution kind,
 * grounded in declared learning, declared optimization, declared awareness, and eligible
 * evidence, and carrying complete provenance, explanation, and confidence — with no
 * duplicate candidate identity. Fail-closed.
 */
export function validateEvolutionCandidateRequest(
  request: EvolutionCandidateRequest,
): EvolutionCandidateValidation {
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

  const awarenessValidation = validateAwarenessCandidateSet(request.awarenessSet);
  if (!awarenessValidation.ok) {
    for (const issue of awarenessValidation.issues) issues.push(`awareness-set: ${issue}`);
  }

  collectEvidenceIssues(request.evidence, issues);

  const learningIndex = learningSupportIndex(request.learningSet);
  const optimizationIndex = optimizationSupportIndex(request.optimizationSet);
  const awarenessIndex = awarenessSupportIndex(request.awarenessSet);
  const evidenceIndex = learningEvidenceIndex(request.evidence);
  const candidateIds = new Set<string>();
  for (const seed of request.seeds) {
    collectSeedIssues(seed, learningIndex, optimizationIndex, awarenessIndex, evidenceIndex, issues);
    if (candidateIds.has(seed.candidateId)) {
      issues.push(`candidate id '${seed.candidateId}' is declared more than once`);
    }
    candidateIds.add(seed.candidateId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Evolution Candidate set: every candidate is of an evolution kind,
 * grounded in a non-empty supporting learning basis, optimization basis, awareness basis,
 * and evidence basis, with a unique identity; the set awaits a Director decision.
 * Defensive, post-identification, and fail-closed.
 */
export function validateEvolutionCandidateSet(
  set: EvolutionCandidateSet,
): EvolutionCandidateValidation {
  const issues: string[] = [];

  if (!isNonEmpty(set.requestId)) issues.push("set declares no requestId");
  if (set.approval.state !== "pending-director") issues.push("set is not pending a Director decision");

  const candidateIds = new Set<string>();
  for (const candidate of set.candidates) {
    if (!isEvolutionCandidateKind(candidate.candidateKind)) {
      issues.push(`candidate '${candidate.candidateId}' is not of an evolution kind`);
    }
    if (candidate.learningRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting learning`);
    }
    if (candidate.optimizationRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting optimization`);
    }
    if (candidate.awarenessRefs.length === 0) {
      issues.push(`candidate '${candidate.candidateId}' declares no supporting awareness`);
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
