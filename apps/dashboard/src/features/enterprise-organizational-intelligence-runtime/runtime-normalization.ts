/**
 * Enterprise Organizational Intelligence Runtime — normalization (Phase 1).
 *
 * Deterministically canonicalizes a Runtime request:
 *   - scope domains are de-duplicated and totally ordered,
 *   - declared dependencies are de-duplicated by kind and ordered by canonical
 *     dependency order — each dependency object is carried through UNCHANGED,
 *   - declared target candidate kinds and stages are de-duplicated and canonically
 *     ordered,
 *   - the whole request is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO generation, and NO
 * mutation or internal rewriting of any carried value. Ordering and de-duplication
 * happen by canonical key only. Keys use JSON encoding so they are unambiguous,
 * text-safe, UTF-8 stable, and NUL-safe.
 */

import type {
  RuntimeCandidateKind,
  RuntimeDependencyKind,
  RuntimeStageKind,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  CanonicalRuntimeRequest,
  RuntimeContext,
  RuntimeDependency,
  RuntimeRequest,
  RuntimeScope,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import {
  runtimeCandidateKindOrderOf,
  runtimeDependencyOrderOf,
  runtimeStageOrderOf,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of strings. First occurrence wins. */
function canonicalStrings(items: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const item of items) seen.add(item);
  return [...seen].sort(compareStrings);
}

/** An unambiguous, text-safe key for one declared dependency. */
export function runtimeDependencyKey(dependency: RuntimeDependency): string {
  return JSON.stringify([dependency.dependencyKind, dependency.referenceId, dependency.version]);
}

/**
 * De-duplicates declared dependencies by dependency kind and orders them by canonical
 * dependency order. First occurrence of a kind wins; each dependency object is carried
 * UNCHANGED.
 */
export function normalizeDependencies(
  dependencies: readonly RuntimeDependency[],
): readonly RuntimeDependency[] {
  const byKind = new Map<RuntimeDependencyKind, RuntimeDependency>();
  for (const dependency of dependencies) {
    if (!byKind.has(dependency.dependencyKind)) byKind.set(dependency.dependencyKind, dependency);
  }
  return [...byKind.values()].sort(
    (left, right) => runtimeDependencyOrderOf(left.dependencyKind) - runtimeDependencyOrderOf(right.dependencyKind),
  );
}

/** De-duplicates target candidate kinds and orders them by canonical candidate order. */
export function normalizeTargets(
  targets: readonly RuntimeCandidateKind[],
): readonly RuntimeCandidateKind[] {
  const seen = new Set<RuntimeCandidateKind>();
  for (const target of targets) seen.add(target);
  return [...seen].sort((left, right) => runtimeCandidateKindOrderOf(left) - runtimeCandidateKindOrderOf(right));
}

/** De-duplicates declared stages and orders them by canonical stage order. */
export function normalizeStages(stages: readonly RuntimeStageKind[]): readonly RuntimeStageKind[] {
  const seen = new Set<RuntimeStageKind>();
  for (const stage of stages) seen.add(stage);
  return [...seen].sort((left, right) => runtimeStageOrderOf(left) - runtimeStageOrderOf(right));
}

/** Canonicalizes a scope: its domains de-duplicated and ordered, other fields unchanged. */
export function normalizeScope(scope: RuntimeScope): RuntimeScope {
  return {
    scopeId: scope.scopeId,
    statement: scope.statement,
    domains: canonicalStrings(scope.domains),
  };
}

/** Canonicalizes a context: its scope and dependencies canonicalized, other fields unchanged. */
export function normalizeContext(context: RuntimeContext): RuntimeContext {
  return {
    purpose: context.purpose,
    scope: normalizeScope(context.scope),
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    authorityBasis: context.authorityBasis,
    dependencies: normalizeDependencies(context.dependencies),
  };
}

/** A canonical key for a request: its identity, ordered dependencies, targets, and stages. */
export function canonicalRuntimeRequestKey(request: CanonicalRuntimeRequest): string {
  return JSON.stringify([
    request.requestId,
    request.context.organizationId,
    request.context.tenantId,
    request.context.scope.scopeId,
    request.context.dependencies.map(runtimeDependencyKey),
    request.targets,
    request.stages,
  ]);
}

/**
 * Canonicalizes a Runtime request into an immutable, frozen form. Deterministic: the
 * same input always produces the same canonical request. Context, dependencies,
 * targets, and stages are canonicalized; every carried value is unchanged.
 */
export function normalizeRuntimeRequest(request: RuntimeRequest): CanonicalRuntimeRequest {
  const context = normalizeContext(request.context);
  return Object.freeze({
    requestId: request.requestId,
    context: Object.freeze({
      ...context,
      scope: Object.freeze(context.scope),
    }),
    targets: normalizeTargets(request.targets),
    stages: normalizeStages(request.stages),
  });
}
