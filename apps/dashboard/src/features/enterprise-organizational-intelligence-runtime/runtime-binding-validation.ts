/**
 * Enterprise Organizational Intelligence Runtime — binding validation (Phase 7).
 *
 * Validates the STRUCTURAL integrity of a proposed binding request and of a prepared
 * Runtime Binding bundle: the bound Runtime Context and the four qualified candidate sets
 * are well-formed, and every bound artifact carries a derived binding identity that matches
 * its source, a known source kind, complete provenance, an explanation basis, a known
 * confidence level, non-empty uncertainty, non-empty evidence, and supporting references
 * that resolve — with no cross-kind reference a source of that kind cannot declare, no
 * dangling reference, and no duplicate binding identity. This is a plain, deterministic
 * structural check — NOT runtime behaviour, NOT reasoning, NOT scoring, NOT confidence
 * calculation. It is fail-closed: any missing, malformed, mismatched, dangling, duplicate,
 * non-canonical, or ineligible field blocks a valid binding pass. No silent repair, no
 * inference, no fabrication.
 */

import {
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { runtimeLifecycleIsTerminal } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import { validateRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import type { LearningCandidate } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import { validateLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
import type { OptimizationCandidate } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import {
  learningSupportIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-rules";
import { validateOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
import type { AwarenessCandidate } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import {
  optimizationSupportIndex,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";
import { validateAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
import { awarenessSupportIndex } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-rules";
import { validateEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";
import type {
  BoundRuntimeArtifact,
  RuntimeBindingBundle,
  RuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
import { bindCandidateSets, bindingIdentity } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-rules";

export type RuntimeBindingValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** True when every reference is a non-empty string present as a key in the index. */
function allResolve(refs: readonly string[], index: ReadonlyMap<string, unknown>): boolean {
  for (const ref of refs) {
    if (!isNonEmpty(ref) || !index.has(ref)) return false;
  }
  return true;
}

/**
 * Structural, set-independent checks over one bound artifact: derived identity match, known
 * kind, complete provenance in a pre-briefing non-terminal lifecycle, an explanation basis,
 * a known confidence level, non-empty uncertainty, and non-empty evidence. Appends issues.
 */
function collectArtifactIssues(artifact: BoundRuntimeArtifact, issues: string[]): void {
  const label = artifact.bindingId;

  if (!isNonEmpty(artifact.sourceCandidateId)) issues.push("artifact declares no sourceCandidateId");
  if (!(artifact.sourceKind in RUNTIME_CANDIDATE_KIND_DESCRIPTORS)) {
    issues.push(`artifact '${label}' declares unknown source kind '${artifact.sourceKind}'`);
  }
  if (!isNonEmpty(artifact.bindingId)) {
    issues.push("artifact declares no bindingId");
  } else if (artifact.bindingId !== bindingIdentity(artifact.sourceKind, artifact.sourceCandidateId)) {
    issues.push(`artifact '${label}' bindingId does not match its derived source identity`);
  }
  if (!isNonEmpty(artifact.statement)) issues.push(`artifact '${label}' declares no statement`);

  // Evidence: every bound artifact must carry a non-empty evidence basis.
  if (artifact.evidenceRefs.length === 0) issues.push(`artifact '${label}' declares no supporting evidence`);
  for (const ref of artifact.evidenceRefs) {
    if (!isNonEmpty(ref)) issues.push(`artifact '${label}' declares an empty evidence reference`);
  }

  // Provenance: complete, non-terminal, pre-briefing.
  if (!isNonEmpty(artifact.provenance.source)) issues.push(`artifact '${label}' provenance declares no source`);
  if (!isNonEmpty(artifact.provenance.attribution)) {
    issues.push(`artifact '${label}' provenance declares no attribution`);
  }
  if (!isPositiveInteger(artifact.provenance.version)) {
    issues.push(`artifact '${label}' provenance declares a non-positive-integer version`);
  }
  if (!isNonEmpty(artifact.provenance.effectivePeriod)) {
    issues.push(`artifact '${label}' provenance declares no effectivePeriod`);
  }
  if (!(artifact.provenance.lifecycle in RUNTIME_LIFECYCLE_STATE_DESCRIPTORS)) {
    issues.push(`artifact '${label}' provenance declares unknown lifecycle '${artifact.provenance.lifecycle}'`);
  } else if (runtimeLifecycleIsTerminal(artifact.provenance.lifecycle)) {
    issues.push(`artifact '${label}' provenance declares a terminal lifecycle state`);
  } else if (artifact.provenance.lifecycle === "briefed") {
    issues.push(`artifact '${label}' provenance declares the briefed lifecycle, reserved for a later phase`);
  }

  // Explanation: a bound artifact is never emitted without a basis for explanation.
  if (artifact.explainability.basis.length === 0) issues.push(`artifact '${label}' declares no explanation basis`);

  // Confidence: a known level, tempered by non-empty uncertainty (never suppressed).
  if (!(artifact.confidence.level in RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS)) {
    issues.push(`artifact '${label}' declares unknown confidence level '${artifact.confidence.level}'`);
  }
  if (artifact.confidence.uncertainty.length === 0) {
    issues.push(`artifact '${label}' declares no uncertainty`);
  }

  // Approval: always pending a Director decision.
  if (artifact.approval.state !== "pending-director") {
    issues.push(`artifact '${label}' is not pending a Director decision`);
  }
}

/**
 * Cross-kind reference-shape checks: an artifact may only declare the supporting-reference
 * kinds its source kind actually carries. Anything else is a mismatched-kind or unsupported
 * reference and is rejected. Evolution references are unsupported for every current kind.
 */
function collectReferenceShapeIssues(artifact: BoundRuntimeArtifact, issues: string[]): void {
  const label = artifact.bindingId;
  const kind = artifact.sourceKind;

  if (artifact.evolutionRefs.length > 0) {
    issues.push(`artifact '${label}' declares unsupported evolution references`);
  }
  if (kind === "learning") {
    if (artifact.learningRefs.length > 0) issues.push(`artifact '${label}' of kind learning declares learning references`);
    if (artifact.optimizationRefs.length > 0) issues.push(`artifact '${label}' of kind learning declares optimization references`);
    if (artifact.awarenessRefs.length > 0) issues.push(`artifact '${label}' of kind learning declares awareness references`);
  } else if (kind === "optimization") {
    if (artifact.optimizationRefs.length > 0) issues.push(`artifact '${label}' of kind optimization declares optimization references`);
    if (artifact.awarenessRefs.length > 0) issues.push(`artifact '${label}' of kind optimization declares awareness references`);
    if (artifact.learningRefs.length === 0) issues.push(`artifact '${label}' of kind optimization declares no supporting learning`);
  } else if (kind === "awareness-signal") {
    if (artifact.awarenessRefs.length > 0) issues.push(`artifact '${label}' of kind awareness declares awareness references`);
    if (artifact.learningRefs.length === 0) issues.push(`artifact '${label}' of kind awareness declares no supporting learning`);
    if (artifact.optimizationRefs.length === 0) issues.push(`artifact '${label}' of kind awareness declares no supporting optimization`);
  } else if (kind === "evolution-readiness" || kind === "evolution-pathway") {
    if (artifact.learningRefs.length === 0) issues.push(`artifact '${label}' of kind evolution declares no supporting learning`);
    if (artifact.optimizationRefs.length === 0) issues.push(`artifact '${label}' of kind evolution declares no supporting optimization`);
    if (artifact.awarenessRefs.length === 0) issues.push(`artifact '${label}' of kind evolution declares no supporting awareness`);
  }
}

/**
 * Validates a proposed binding request: a well-formed bound Runtime Context and four
 * well-formed candidate sets, then binds them and checks every resulting artifact for
 * structural integrity, reference shape, resolved (non-dangling) supporting references
 * against the qualified sets, and unique binding identity. Fail-closed.
 */
export function validateRuntimeBindingRequest(
  request: RuntimeBindingRequest,
): RuntimeBindingValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");

  const bundleValidation = validateRuntimeBundle(request.bundle);
  if (!bundleValidation.ok) for (const issue of bundleValidation.issues) issues.push(`bundle: ${issue}`);

  const learningValidation = validateLearningCandidateSet(request.learningSet);
  if (!learningValidation.ok) for (const issue of learningValidation.issues) issues.push(`learning-set: ${issue}`);

  const optimizationValidation = validateOptimizationCandidateSet(request.optimizationSet);
  if (!optimizationValidation.ok) for (const issue of optimizationValidation.issues) issues.push(`optimization-set: ${issue}`);

  const awarenessValidation = validateAwarenessCandidateSet(request.awarenessSet);
  if (!awarenessValidation.ok) for (const issue of awarenessValidation.issues) issues.push(`awareness-set: ${issue}`);

  const evolutionValidation = validateEvolutionCandidateSet(request.evolutionSet);
  if (!evolutionValidation.ok) for (const issue of evolutionValidation.issues) issues.push(`evolution-set: ${issue}`);

  // Resolution indexes over the qualified sets — used to reject dangling references.
  const learningIndex: ReadonlyMap<string, LearningCandidate> = learningSupportIndex(request.learningSet);
  const optimizationIndex: ReadonlyMap<string, OptimizationCandidate> = optimizationSupportIndex(request.optimizationSet);
  const awarenessIndex: ReadonlyMap<string, AwarenessCandidate> = awarenessSupportIndex(request.awarenessSet);

  const bindingIds = new Set<string>();
  for (const artifact of bindCandidateSets(request)) {
    collectArtifactIssues(artifact, issues);
    collectReferenceShapeIssues(artifact, issues);

    if (!allResolve(artifact.learningRefs, learningIndex)) {
      issues.push(`artifact '${artifact.bindingId}' grounds in learning absent from the qualified set`);
    }
    if (!allResolve(artifact.optimizationRefs, optimizationIndex)) {
      issues.push(`artifact '${artifact.bindingId}' grounds in optimization absent from the qualified set`);
    }
    if (!allResolve(artifact.awarenessRefs, awarenessIndex)) {
      issues.push(`artifact '${artifact.bindingId}' grounds in awareness absent from the qualified set`);
    }

    if (bindingIds.has(artifact.bindingId)) {
      issues.push(`binding identity '${artifact.bindingId}' is declared more than once`);
    }
    bindingIds.add(artifact.bindingId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Runtime Binding bundle: it awaits a Director decision, every artifact
 * is structurally complete with a matching derived identity, a valid reference shape, and a
 * unique binding identity, and the artifacts are in canonical binding-identity order.
 * Defensive, post-binding, set-independent, and fail-closed.
 */
export function validateRuntimeBindingBundle(
  bundle: RuntimeBindingBundle,
): RuntimeBindingValidation {
  const issues: string[] = [];

  if (!isNonEmpty(bundle.requestId)) issues.push("bundle declares no requestId");
  if (bundle.approval.state !== "pending-director") issues.push("bundle is not pending a Director decision");

  const bindingIds = new Set<string>();
  for (const artifact of bundle.artifacts) {
    collectArtifactIssues(artifact, issues);
    collectReferenceShapeIssues(artifact, issues);

    if (bindingIds.has(artifact.bindingId)) {
      issues.push(`binding identity '${artifact.bindingId}' appears more than once`);
    }
    bindingIds.add(artifact.bindingId);
  }

  // Canonical order: artifacts must already be sorted by binding identity.
  const bindingIdOrder = bundle.artifacts.map((artifact) => artifact.bindingId);
  const canonicalOrder = [...bindingIdOrder].sort(compareBindingId);
  if (JSON.stringify(bindingIdOrder) !== JSON.stringify(canonicalOrder)) {
    issues.push("bundle artifacts are not in canonical binding-identity order");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

function compareBindingId(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
