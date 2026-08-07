/**
 * Enterprise Organizational Intelligence Runtime — Runtime Composition validation (Phase 9).
 *
 * Validates the CROSS-PHASE integrity of a proposed composition request and of a prepared
 * Runtime Composition: every settled Phase 1–8 output is well-formed; approval is uniformly
 * pending a Director decision across every set, the binding, and the briefing; the assembled
 * Runtime Context is organization/tenant/scope-consistent; every candidate is represented by a
 * bound artifact and every bound artifact by a candidate (a candidate↔binding bijection); every
 * bound artifact is represented by a briefing item and every briefing item by a bound artifact
 * (a binding↔briefing bijection); no candidate identity is duplicated; the composed
 * intelligence rests in a single, known, non-terminal lifecycle; and the composition carries a
 * derived identity and a summary that match its contents. This is a plain, deterministic
 * structural check — NOT runtime behaviour, NOT reasoning, NOT scoring. It is fail-closed: any
 * missing, malformed, mismatched, dangling, duplicate, inconsistent, or omitted artifact blocks
 * a valid composition. No silent repair, no inference, no fabrication.
 */

import {
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import { runtimeLifecycleIsTerminal } from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
import { validateRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import { validateLearningCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
import { validateOptimizationCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
import { validateAwarenessCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
import { validateEvolutionCandidateSet } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";
import { validateRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-validation";
import { validateDirectorBriefing } from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-validation";
import type {
  RuntimeComposition,
  RuntimeCompositionRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";
import {
  candidateBindingIds,
  compositionIdentity,
  summarize,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-rules";

export type RuntimeCompositionValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** True when both id lists, once sorted, are identical — a set equality over identities. */
function sameIdentitySet(left: readonly string[], right: readonly string[]): boolean {
  const l = [...left].sort(compareStrings);
  const r = [...right].sort(compareStrings);
  return JSON.stringify(l) === JSON.stringify(r);
}

/** True when the id list contains a duplicate. */
function hasDuplicate(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

/**
 * Cross-phase checks shared by request and prepared-composition validation: approval
 * consistency, organization/tenant/scope consistency, non-empty intelligence, single known
 * non-terminal lifecycle, the candidate↔binding and binding↔briefing bijections, and
 * duplicate-identity rejection. Appends issues. Set-independent and fail-closed.
 */
function collectCrossPhaseIssues(
  request: RuntimeCompositionRequest,
  issues: string[],
): void {
  // Approval consistency: everything the composition closes awaits the same Director decision.
  if (request.learningSet.approval.state !== "pending-director") issues.push("learning set is not pending a Director decision");
  if (request.optimizationSet.approval.state !== "pending-director") issues.push("optimization set is not pending a Director decision");
  if (request.awarenessSet.approval.state !== "pending-director") issues.push("awareness set is not pending a Director decision");
  if (request.evolutionSet.approval.state !== "pending-director") issues.push("evolution set is not pending a Director decision");
  if (request.bindingBundle.approval.state !== "pending-director") issues.push("binding bundle is not pending a Director decision");
  if (request.briefing.approval.state !== "pending-director") issues.push("briefing is not pending a Director decision");
  if (request.briefing.governance.approval.state !== "pending-director") issues.push("briefing governance is not pending a Director decision");

  // Organization / tenant / scope consistency: the assembled context and its organization
  // picture must agree on who the closed Runtime is bound to.
  const context = request.bundle.context;
  const assembly = request.bundle.assembly;
  if (context.organizationId !== assembly.organizationId) issues.push("bundle context and assembly disagree on organization");
  if (context.tenantId !== assembly.tenantId) issues.push("bundle context and assembly disagree on tenant");
  if (context.scope.scopeId !== assembly.scope.scopeId) issues.push("bundle context and assembly disagree on scope");

  // A closed composition must contain intelligence: an empty briefing is not a closure.
  if (request.briefing.items.length === 0) issues.push("briefing contains no items; nothing to close");

  // Lifecycle consistency: every briefing item's exposed lifecycle must be one, known, and
  // non-terminal state — the single lifecycle the composed intelligence rests in.
  const lifecycles = new Set(request.briefing.items.map((item) => item.lifecycle));
  if (lifecycles.size > 1) issues.push("briefing items do not share a single lifecycle");
  for (const lifecycle of lifecycles) {
    if (!(lifecycle in RUNTIME_LIFECYCLE_STATE_DESCRIPTORS)) {
      issues.push(`composed intelligence declares unknown lifecycle '${lifecycle}'`);
    } else if (runtimeLifecycleIsTerminal(lifecycle)) {
      issues.push(`composed intelligence declares a terminal lifecycle '${lifecycle}'`);
    }
  }

  // Candidate ↔ binding bijection: every candidate is bound, every bound artifact has a
  // candidate. Duplicate candidate identities are rejected before the set comparison.
  const candidateIds = candidateBindingIds(request);
  if (hasDuplicate(candidateIds)) issues.push("a candidate binding identity is duplicated across the candidate sets");
  const artifactIds = request.bindingBundle.artifacts.map((artifact) => artifact.bindingId);
  if (!sameIdentitySet(candidateIds, artifactIds)) {
    issues.push("candidate set and binding bundle do not correspond one-to-one (missing candidate, missing binding, or dangling binding)");
  }

  // Binding ↔ briefing bijection: every bound artifact is briefed, every briefing item is
  // bound. No hidden or omitted artifacts.
  const itemIds = request.briefing.items.map((item) => item.bindingId);
  if (!sameIdentitySet(artifactIds, itemIds)) {
    issues.push("binding bundle and briefing do not correspond one-to-one (missing briefing item or dangling briefing item)");
  }
}

/**
 * Validates a proposed composition request: every settled Phase 1–8 output is well-formed, then
 * every cross-phase integrity check holds. Fail-closed.
 */
export function validateRuntimeCompositionRequest(
  request: RuntimeCompositionRequest,
): RuntimeCompositionValidation {
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

  const briefingValidation = validateDirectorBriefing(request.briefing);
  if (!briefingValidation.ok) for (const issue of briefingValidation.issues) issues.push(`briefing: ${issue}`);

  collectCrossPhaseIssues(request, issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared Runtime Composition: it awaits a Director decision, it carries the
 * verified integrity marker, a derived composition identity that matches its bundle and
 * briefing, a single known non-terminal lifecycle, a summary that matches its contents, the
 * governance view carried unchanged from the briefing, and every cross-phase bijection intact.
 * Defensive, post-composition, and fail-closed.
 */
export function validateRuntimeComposition(
  composition: RuntimeComposition,
): RuntimeCompositionValidation {
  const issues: string[] = [];

  if (!isNonEmpty(composition.compositionId)) issues.push("composition declares no compositionId");
  if (composition.approval.state !== "pending-director") issues.push("composition is not pending a Director decision");
  if (composition.integrity !== "verified") issues.push("composition does not carry the verified integrity marker");

  const derivedId = compositionIdentity(composition.bundle.bundleId, composition.briefing.requestId);
  if (composition.compositionId !== derivedId) issues.push("composition identity does not match its derived bundle/briefing identity");

  if (!(composition.lifecycle in RUNTIME_LIFECYCLE_STATE_DESCRIPTORS)) {
    issues.push(`composition declares unknown lifecycle '${composition.lifecycle}'`);
  } else if (runtimeLifecycleIsTerminal(composition.lifecycle)) {
    issues.push(`composition declares a terminal lifecycle '${composition.lifecycle}'`);
  }

  // The prepared composition is structurally a request over its own sub-outputs; reuse the
  // cross-phase checks and confirm the derived summary matches what it carries.
  const asRequest: RuntimeCompositionRequest = {
    requestId: composition.compositionId,
    bundle: composition.bundle,
    learningSet: composition.learningSet,
    optimizationSet: composition.optimizationSet,
    awarenessSet: composition.awarenessSet,
    evolutionSet: composition.evolutionSet,
    bindingBundle: composition.bindingBundle,
    briefing: composition.briefing,
  };
  collectCrossPhaseIssues(asRequest, issues);

  if (JSON.stringify(summarize(asRequest)) !== JSON.stringify(composition.summary)) {
    issues.push("composition summary does not match its contents");
  }

  // Governance is carried unchanged from the briefing.
  if (JSON.stringify(composition.governance) !== JSON.stringify(composition.briefing.governance)) {
    issues.push("composition governance does not match the briefing governance");
  }

  // Composition lifecycle must equal the lifecycle the briefing items rest in.
  const itemLifecycle = composition.briefing.items[0]?.lifecycle;
  if (itemLifecycle !== undefined && composition.lifecycle !== itemLifecycle) {
    issues.push("composition lifecycle does not match the composed intelligence lifecycle");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
