/**
 * Enterprise Organizational Intelligence Runtime — assembly validation (Phase 2).
 *
 * Validates the STRUCTURAL integrity of a proposed Runtime assembly request and of a
 * built Runtime bundle: required fields are present and non-empty, dependency versions
 * are positive integers, no dependency kind is duplicated, and every one of the three
 * required foundations resolves. This is a plain, deterministic structural check — NOT
 * runtime behaviour, NOT reasoning, NOT generation, NOT computation beyond validation.
 * It confirms the request and bundle are well-formed and traceable; it alters nothing
 * and is fail-closed: any missing or malformed field blocks a valid assembly.
 */

import { RUNTIME_DEPENDENCY_KIND_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import {
  RUNTIME_FOUNDATION_KIND_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import type {
  RuntimeAssemblyRequest,
  RuntimeBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import {
  reachesAllFoundations,
  runtimeFoundationDependencyKindOf,
  runtimeRequiredFoundationKinds,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-rules";
import type { RuntimeContext } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";

export type RuntimeAssemblyValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Shared structural checks over a bound context. Appends any issues found. */
function collectContextIssues(context: RuntimeContext, issues: string[]): void {
  if (!isNonEmpty(context.purpose)) issues.push("context declares no purpose");
  if (!isNonEmpty(context.organizationId)) issues.push("context declares no organizationId");
  if (!isNonEmpty(context.tenantId)) issues.push("context declares no tenantId");
  if (!isNonEmpty(context.authorityBasis)) issues.push("context declares no authorityBasis");

  if (!isNonEmpty(context.scope.scopeId)) issues.push("scope declares no scopeId");
  if (!isNonEmpty(context.scope.statement)) issues.push("scope declares no statement");
  if (context.scope.domains.length === 0) issues.push("scope declares no domains");
  const domainSet = new Set(context.scope.domains);
  if (domainSet.size !== context.scope.domains.length) issues.push("scope declares duplicate domains");
  for (const domain of context.scope.domains) {
    if (!isNonEmpty(domain)) issues.push("scope declares an empty domain");
  }

  const dependencyKinds = new Set<string>();
  for (const dependency of context.dependencies) {
    if (!(dependency.dependencyKind in RUNTIME_DEPENDENCY_KIND_DESCRIPTORS)) {
      issues.push(`dependency declares unknown kind '${dependency.dependencyKind}'`);
    }
    if (!isNonEmpty(dependency.referenceId)) {
      issues.push(`dependency '${dependency.dependencyKind}' declares no referenceId`);
    }
    if (!isPositiveInteger(dependency.version)) {
      issues.push(`dependency '${dependency.dependencyKind}' declares a non-positive-integer version`);
    }
    if (dependencyKinds.has(dependency.dependencyKind)) {
      issues.push(`dependency kind '${dependency.dependencyKind}' is declared more than once`);
    }
    dependencyKinds.add(dependency.dependencyKind);
  }
}

/**
 * Validates a proposed Runtime assembly request: identity present, bound context
 * well-formed, and every one of the three required foundations resolvable from the
 * context's declared dependencies. Fail-closed.
 */
export function validateRuntimeAssemblyRequest(request: RuntimeAssemblyRequest): RuntimeAssemblyValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");
  collectContextIssues(request.context, issues);

  if (!reachesAllFoundations(request.context)) {
    const declared = new Set(request.context.dependencies.map((dependency) => dependency.dependencyKind));
    const missing = runtimeRequiredFoundationKinds().filter(
      (kind) => !declared.has(runtimeFoundationDependencyKindOf(kind)),
    );
    issues.push(`request omits required foundations: ${missing.join(", ")}`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a built Runtime bundle: identity present, bound context well-formed,
 * assembly bound to the same organization / tenant / scope as its context, exactly the
 * three foundations resolved with one per kind, each source well-formed and consistent
 * with its foundation, and the bundle in the bound lifecycle state. Defensive,
 * post-assembly, and fail-closed.
 */
export function validateRuntimeBundle(bundle: RuntimeBundle): RuntimeAssemblyValidation {
  const issues: string[] = [];

  if (!isNonEmpty(bundle.bundleId)) issues.push("bundle declares no bundleId");
  collectContextIssues(bundle.context, issues);

  const { assembly, context } = bundle;
  if (!isNonEmpty(assembly.organizationId)) issues.push("assembly declares no organizationId");
  if (!isNonEmpty(assembly.tenantId)) issues.push("assembly declares no tenantId");
  if (assembly.organizationId !== context.organizationId) {
    issues.push("assembly organizationId does not match its context");
  }
  if (assembly.tenantId !== context.tenantId) issues.push("assembly tenantId does not match its context");
  if (assembly.scope.scopeId !== context.scope.scopeId) {
    issues.push("assembly scopeId does not match its context");
  }

  const foundationKinds = new Set<string>();
  for (const source of assembly.sources) {
    if (!(source.foundationKind in RUNTIME_FOUNDATION_KIND_DESCRIPTORS)) {
      issues.push(`source declares unknown foundation kind '${source.foundationKind}'`);
      continue;
    }
    if (source.dependencyKind !== runtimeFoundationDependencyKindOf(source.foundationKind)) {
      issues.push(`source '${source.foundationKind}' declares an inconsistent dependency kind`);
    }
    if (!isNonEmpty(source.referenceId)) {
      issues.push(`source '${source.foundationKind}' declares no referenceId`);
    }
    if (!isPositiveInteger(source.version)) {
      issues.push(`source '${source.foundationKind}' declares a non-positive-integer version`);
    }
    if (foundationKinds.has(source.foundationKind)) {
      issues.push(`foundation kind '${source.foundationKind}' is assembled more than once`);
    }
    foundationKinds.add(source.foundationKind);
  }
  for (const kind of runtimeRequiredFoundationKinds()) {
    if (!foundationKinds.has(kind)) issues.push(`assembly omits required foundation: ${kind}`);
  }

  if (bundle.lifecycle !== "bound") issues.push("bundle is not in the bound lifecycle state");

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
