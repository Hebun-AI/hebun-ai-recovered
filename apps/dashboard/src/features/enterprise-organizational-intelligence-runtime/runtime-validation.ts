/**
 * Enterprise Organizational Intelligence Runtime — validation (Phase 1).
 *
 * Validates the STRUCTURAL integrity of a proposed Runtime request: required fields
 * are present and non-empty, dependency versions are positive integers, no dependency
 * kind / target / stage / domain is duplicated, and every REQUIRED settled dependency
 * is declared. This is a plain, deterministic structural check — NOT runtime
 * behaviour, NOT inference, NOT generation, NOT computation beyond validation. It
 * confirms the request is well-formed and traceable; it alters nothing and is
 * fail-closed: any missing or malformed field blocks a valid request.
 */

import {
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_STAGE_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { RuntimeRequest } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import {
  reachesRequiredDependencies,
  runtimeRequiredDependencyKinds,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";

export type RuntimeValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function validateRuntimeRequest(request: RuntimeRequest): RuntimeValidation {
  const issues: string[] = [];

  // Request and context identity.
  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");
  if (!isNonEmpty(request.context.purpose)) issues.push("context declares no purpose");
  if (!isNonEmpty(request.context.organizationId)) issues.push("context declares no organizationId");
  if (!isNonEmpty(request.context.tenantId)) issues.push("context declares no tenantId");
  if (!isNonEmpty(request.context.authorityBasis)) issues.push("context declares no authorityBasis");

  // Scope.
  if (!isNonEmpty(request.context.scope.scopeId)) issues.push("scope declares no scopeId");
  if (!isNonEmpty(request.context.scope.statement)) issues.push("scope declares no statement");
  if (request.context.scope.domains.length === 0) issues.push("scope declares no domains");
  const domainSet = new Set(request.context.scope.domains);
  if (domainSet.size !== request.context.scope.domains.length) issues.push("scope declares duplicate domains");
  for (const domain of request.context.scope.domains) {
    if (!isNonEmpty(domain)) issues.push("scope declares an empty domain");
  }

  // Dependencies: each well-formed, no duplicate kind, all required kinds present.
  const dependencyKinds = new Set<string>();
  for (const dependency of request.context.dependencies) {
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
  if (!reachesRequiredDependencies(request)) {
    const missing = runtimeRequiredDependencyKinds().filter((kind) => !dependencyKinds.has(kind));
    issues.push(`request omits required dependencies: ${missing.join(", ")}`);
  }

  // Targets: non-empty, known, no duplicates.
  if (request.targets.length === 0) issues.push("request declares no target candidate kinds");
  const targetSet = new Set<string>();
  for (const target of request.targets) {
    if (!(target in RUNTIME_CANDIDATE_KIND_DESCRIPTORS)) {
      issues.push(`target declares unknown candidate kind '${target}'`);
    }
    if (targetSet.has(target)) issues.push(`target candidate kind '${target}' is declared more than once`);
    targetSet.add(target);
  }

  // Stages: non-empty, known, no duplicates.
  if (request.stages.length === 0) issues.push("request declares no stages");
  const stageSet = new Set<string>();
  for (const stage of request.stages) {
    if (!(stage in RUNTIME_STAGE_DESCRIPTORS)) issues.push(`stage declares unknown kind '${stage}'`);
    if (stageSet.has(stage)) issues.push(`stage '${stage}' is declared more than once`);
    stageSet.add(stage);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
