/**
 * Enterprise Organizational Intelligence Runtime — Director Briefing validation (Phase 8).
 *
 * Validates the STRUCTURAL integrity of a proposed briefing request and of a prepared
 * Director Briefing: the bound Runtime Context, the four qualified candidate sets, and the
 * Phase 7 binding bundle are well-formed; the briefing organizes EVERY bound artifact and no
 * other (it hides none and fabricates none); every briefing item carries a binding identity
 * that matches its source, a known source kind, complete provenance, an exposed lifecycle that
 * agrees with its provenance and is a valid pre-briefing state, an explanation basis, a known
 * confidence level, non-empty uncertainty, non-empty evidence, and supporting references that
 * resolve — with no cross-kind reference a source of that kind cannot declare, no dangling
 * reference, and no duplicate binding identity; and the descriptive governance view exposes
 * immutable constraints, known restrictions, and exactly the pending Director decisions of the
 * organized items. This is a plain, deterministic structural check — NOT runtime behaviour,
 * NOT reasoning, NOT scoring, NOT confidence calculation, NOT a governance decision. It is
 * fail-closed: any missing, malformed, mismatched, dangling, duplicate, hidden, non-canonical,
 * or ineligible field blocks a valid briefing. No silent repair, no inference, no fabrication.
 */

import {
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
  RUNTIME_RESTRICTION_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { runtimeLifecycleIsTerminal } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import { validateRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import type { LearningCandidate } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
import { validateLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
import type { OptimizationCandidate } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
import { learningSupportIndex } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-rules";
import { validateOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
import type { AwarenessCandidate } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
import { optimizationSupportIndex } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";
import { validateAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
import { awarenessSupportIndex } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-rules";
import { validateEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";
import { bindingIdentity } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-rules";
import { validateRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-validation";
import type {
  DirectorBriefing,
  DirectorBriefingGovernance,
  DirectorBriefingItem,
  DirectorBriefingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";
import { projectBriefingItems } from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-rules";

export type DirectorBriefingValidation =
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

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Structural, set-independent checks over one briefing item: derived identity match, known
 * kind, complete provenance in a pre-briefing non-terminal lifecycle, an exposed lifecycle
 * that agrees with the provenance lifecycle, an explanation basis, a known confidence level,
 * non-empty uncertainty (never suppressed), non-empty evidence, and a pending Director
 * decision. Appends issues.
 */
function collectItemIssues(item: DirectorBriefingItem, issues: string[]): void {
  const label = item.bindingId;

  if (!isNonEmpty(item.sourceCandidateId)) issues.push("item declares no sourceCandidateId");
  if (!(item.sourceKind in RUNTIME_CANDIDATE_KIND_DESCRIPTORS)) {
    issues.push(`item '${label}' declares unknown source kind '${item.sourceKind}'`);
  }
  if (!isNonEmpty(item.bindingId)) {
    issues.push("item declares no bindingId");
  } else if (item.bindingId !== bindingIdentity(item.sourceKind, item.sourceCandidateId)) {
    issues.push(`item '${label}' bindingId does not match its derived source identity`);
  }
  if (!isNonEmpty(item.statement)) issues.push(`item '${label}' declares no statement`);

  // Evidence: every briefing item must carry a non-empty evidence basis.
  if (item.evidenceRefs.length === 0) issues.push(`item '${label}' declares no supporting evidence`);
  for (const ref of item.evidenceRefs) {
    if (!isNonEmpty(ref)) issues.push(`item '${label}' declares an empty evidence reference`);
  }

  // Provenance: complete, non-terminal, pre-briefing.
  if (!isNonEmpty(item.provenance.source)) issues.push(`item '${label}' provenance declares no source`);
  if (!isNonEmpty(item.provenance.attribution)) {
    issues.push(`item '${label}' provenance declares no attribution`);
  }
  if (!isPositiveInteger(item.provenance.version)) {
    issues.push(`item '${label}' provenance declares a non-positive-integer version`);
  }
  if (!isNonEmpty(item.provenance.effectivePeriod)) {
    issues.push(`item '${label}' provenance declares no effectivePeriod`);
  }
  if (!(item.provenance.lifecycle in RUNTIME_LIFECYCLE_STATE_DESCRIPTORS)) {
    issues.push(`item '${label}' provenance declares unknown lifecycle '${item.provenance.lifecycle}'`);
  } else if (runtimeLifecycleIsTerminal(item.provenance.lifecycle)) {
    issues.push(`item '${label}' provenance declares a terminal lifecycle state`);
  } else if (item.provenance.lifecycle === "briefed") {
    issues.push(`item '${label}' provenance declares the briefed lifecycle; the briefing preserves, never advances, lifecycle`);
  }

  // Lifecycle: exposed, never advanced — it must agree with the preserved provenance lifecycle.
  if (item.lifecycle !== item.provenance.lifecycle) {
    issues.push(`item '${label}' exposes a lifecycle that disagrees with its provenance lifecycle`);
  }

  // Explanation: a briefing item is never organized without a basis for explanation.
  if (item.explainability.basis.length === 0) issues.push(`item '${label}' declares no explanation basis`);

  // Confidence: a known level, tempered by non-empty uncertainty (never hidden).
  if (!(item.confidence.level in RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS)) {
    issues.push(`item '${label}' declares unknown confidence level '${item.confidence.level}'`);
  }
  if (item.confidence.uncertainty.length === 0) {
    issues.push(`item '${label}' declares no uncertainty`);
  }

  // Approval: always pending a Director decision.
  if (item.approval.state !== "pending-director") {
    issues.push(`item '${label}' is not pending a Director decision`);
  }
}

/**
 * Cross-kind reference-shape checks: a briefing item may only declare the supporting-reference
 * kinds its source kind actually carries. Anything else is a mismatched-kind or unsupported
 * reference and is rejected. Evolution references are unsupported for every current kind.
 */
function collectReferenceShapeIssues(item: DirectorBriefingItem, issues: string[]): void {
  const label = item.bindingId;
  const kind = item.sourceKind;

  if (item.evolutionRefs.length > 0) {
    issues.push(`item '${label}' declares unsupported evolution references`);
  }
  if (kind === "learning") {
    if (item.learningRefs.length > 0) issues.push(`item '${label}' of kind learning declares learning references`);
    if (item.optimizationRefs.length > 0) issues.push(`item '${label}' of kind learning declares optimization references`);
    if (item.awarenessRefs.length > 0) issues.push(`item '${label}' of kind learning declares awareness references`);
  } else if (kind === "optimization") {
    if (item.optimizationRefs.length > 0) issues.push(`item '${label}' of kind optimization declares optimization references`);
    if (item.awarenessRefs.length > 0) issues.push(`item '${label}' of kind optimization declares awareness references`);
    if (item.learningRefs.length === 0) issues.push(`item '${label}' of kind optimization declares no supporting learning`);
  } else if (kind === "awareness-signal") {
    if (item.awarenessRefs.length > 0) issues.push(`item '${label}' of kind awareness declares awareness references`);
    if (item.learningRefs.length === 0) issues.push(`item '${label}' of kind awareness declares no supporting learning`);
    if (item.optimizationRefs.length === 0) issues.push(`item '${label}' of kind awareness declares no supporting optimization`);
  } else if (kind === "evolution-readiness" || kind === "evolution-pathway") {
    if (item.learningRefs.length === 0) issues.push(`item '${label}' of kind evolution declares no supporting learning`);
    if (item.optimizationRefs.length === 0) issues.push(`item '${label}' of kind evolution declares no supporting optimization`);
    if (item.awarenessRefs.length === 0) issues.push(`item '${label}' of kind evolution declares no supporting awareness`);
  }
}

/**
 * Descriptive-governance checks: the constraints are held immutable and non-empty, every
 * declared restriction is a known kind, the approval awaits a Director decision, and the
 * exposed pending Director decisions are EXACTLY the binding identities of the organized items
 * — none hidden, none fabricated. Governance here validates and exposes; it decides nothing.
 */
function collectGovernanceIssues(
  governance: DirectorBriefingGovernance,
  itemBindingIds: readonly string[],
  issues: string[],
): void {
  if (governance.heldImmutable !== true) issues.push("governance is not held immutable");
  for (const constraint of governance.constraints) {
    if (!isNonEmpty(constraint)) issues.push("governance declares an empty constraint");
  }
  for (const restriction of governance.restrictions) {
    if (!(restriction in RUNTIME_RESTRICTION_DESCRIPTORS)) {
      issues.push(`governance declares unknown restriction '${restriction}'`);
    }
  }
  if (governance.approval.state !== "pending-director") {
    issues.push("governance approval is not pending a Director decision");
  }

  const pending = [...governance.pendingDirectorDecisions].sort(compareStrings);
  const expected = [...itemBindingIds].sort(compareStrings);
  if (JSON.stringify(pending) !== JSON.stringify(expected)) {
    issues.push("governance pending Director decisions do not match the organized items");
  }
}

/**
 * Validates a proposed briefing request: a well-formed bound Runtime Context, four well-formed
 * candidate sets, and a well-formed Phase 7 binding bundle, then projects the bundle's
 * artifacts into briefing items and checks every item for structural integrity, reference
 * shape, resolved (non-dangling) supporting references against the qualified sets, and unique
 * binding identity, and confirms the descriptive governance the pass will expose matches the
 * organized items. Fail-closed.
 */
export function validateDirectorBriefingRequest(
  request: DirectorBriefingRequest,
): DirectorBriefingValidation {
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

  const bindingValidation = validateRuntimeBindingBundle(request.bindingBundle);
  if (!bindingValidation.ok) for (const issue of bindingValidation.issues) issues.push(`binding-bundle: ${issue}`);

  // Resolution indexes over the qualified sets — used to reject dangling references.
  const learningIndex: ReadonlyMap<string, LearningCandidate> = learningSupportIndex(request.learningSet);
  const optimizationIndex: ReadonlyMap<string, OptimizationCandidate> = optimizationSupportIndex(request.optimizationSet);
  const awarenessIndex: ReadonlyMap<string, AwarenessCandidate> = awarenessSupportIndex(request.awarenessSet);

  const items = projectBriefingItems(request.bindingBundle);
  const bindingIds = new Set<string>();
  for (const item of items) {
    collectItemIssues(item, issues);
    collectReferenceShapeIssues(item, issues);

    if (!allResolve(item.learningRefs, learningIndex)) {
      issues.push(`item '${item.bindingId}' grounds in learning absent from the qualified set`);
    }
    if (!allResolve(item.optimizationRefs, optimizationIndex)) {
      issues.push(`item '${item.bindingId}' grounds in optimization absent from the qualified set`);
    }
    if (!allResolve(item.awarenessRefs, awarenessIndex)) {
      issues.push(`item '${item.bindingId}' grounds in awareness absent from the qualified set`);
    }

    if (bindingIds.has(item.bindingId)) {
      issues.push(`binding identity '${item.bindingId}' is organized more than once`);
    }
    bindingIds.add(item.bindingId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Director Briefing: it awaits a Director decision, it organizes exactly
 * the bound artifacts of its source binding bundle (hiding none and fabricating none), every
 * item is structurally complete with a matching derived identity, an agreeing exposed
 * lifecycle, a valid reference shape, and a unique binding identity, the items are in canonical
 * binding-identity order, and the descriptive governance view matches the organized items.
 * Defensive, post-organization, set-independent, and fail-closed.
 */
export function validateDirectorBriefing(briefing: DirectorBriefing): DirectorBriefingValidation {
  const issues: string[] = [];

  if (!isNonEmpty(briefing.requestId)) issues.push("briefing declares no requestId");
  if (briefing.approval.state !== "pending-director") issues.push("briefing is not pending a Director decision");

  const bindingIds = new Set<string>();
  for (const item of briefing.items) {
    collectItemIssues(item, issues);
    collectReferenceShapeIssues(item, issues);

    if (bindingIds.has(item.bindingId)) {
      issues.push(`binding identity '${item.bindingId}' appears more than once`);
    }
    bindingIds.add(item.bindingId);
  }

  // Canonical order: items must already be sorted by binding identity.
  const itemOrder = briefing.items.map((item) => item.bindingId);
  const canonicalOrder = [...itemOrder].sort(compareStrings);
  if (JSON.stringify(itemOrder) !== JSON.stringify(canonicalOrder)) {
    issues.push("briefing items are not in canonical binding-identity order");
  }

  collectGovernanceIssues(briefing.governance, itemOrder, issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
