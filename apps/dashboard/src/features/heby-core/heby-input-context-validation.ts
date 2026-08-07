/**
 * Heby Core — input and context validation (Phase 2, Input and Context Consumption).
 *
 * Validates the STRUCTURAL integrity and admissibility of a proposed admission request
 * and of a prepared context binding: the declared context is well-formed and carries an
 * authority basis and well-formed immutable constraints; every proposed input is of a
 * known kind, marked eligible, grounded in a settled source with complete provenance and
 * a positive logical version, and uniquely identified. This is a plain, deterministic
 * structural check — NOT interface behaviour, NOT presentation, NOT reasoning, NOT answer
 * generation, NOT a decision. It is fail-closed: any missing, malformed, ineligible,
 * stale, or unauthorized field blocks admission. No input is ever admitted without
 * preserved provenance and source identity.
 */

import {
  HEBY_CONSTRAINT_KIND_DESCRIPTORS,
  HEBY_SOURCE_LIFECYCLE_DESCRIPTORS,
  type HebyAdmissionRequest,
  type HebyAdmittedInput,
  type HebyConstraint,
  type HebyContextBinding,
  type HebyDeclaredContext,
} from "@/features/heby-core/heby-input-context-types";
import {
  isHebyInputAdmissible,
  isHebyInputKind,
  isHebySourceLifecycleAdmissible,
} from "@/features/heby-core/heby-input-context-rules";

export type HebyInputContextValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Structural checks over one constraint. Appends any issues found. */
function collectConstraintIssues(constraint: HebyConstraint, issues: string[]): void {
  const label = constraint.constraintId;
  if (!isNonEmpty(constraint.constraintId)) issues.push("constraint declares no constraintId");
  if (!isNonEmpty(constraint.statement)) issues.push(`constraint '${label}' declares no statement`);
  if (!(constraint.constraintKind in HEBY_CONSTRAINT_KIND_DESCRIPTORS)) {
    issues.push(`constraint '${label}' declares unknown kind '${constraint.constraintKind}'`);
  }
}

/** Structural checks over a declared context. Appends any issues found. */
function collectContextIssues(context: HebyDeclaredContext, issues: string[]): void {
  if (!isNonEmpty(context.contextId)) issues.push("context declares no contextId");
  if (!isNonEmpty(context.role)) issues.push("context declares no role");
  if (!isNonEmpty(context.domain)) issues.push("context declares no domain");
  if (!isNonEmpty(context.subject)) issues.push("context declares no subject");
  if (!isNonEmpty(context.authorityBasis)) issues.push("context declares no authority basis");
  if (!isNonEmpty(context.organizationId)) issues.push("context declares no organizationId");
  if (!isNonEmpty(context.tenantId)) issues.push("context declares no tenantId");

  const constraintIds = new Set<string>();
  for (const constraint of context.constraints) {
    collectConstraintIssues(constraint, issues);
    if (constraintIds.has(constraint.constraintId)) {
      issues.push(`constraint id '${constraint.constraintId}' is declared more than once`);
    }
    constraintIds.add(constraint.constraintId);
  }
}

/** Structural and admissibility checks over one proposed input. Appends any issues found. */
function collectInputIssues(input: HebyAdmittedInput, issues: string[]): void {
  const label = input.inputId;
  if (!isNonEmpty(input.inputId)) issues.push("input declares no inputId");
  if (!isNonEmpty(input.sourceId)) issues.push(`input '${label}' declares no sourceId`);

  if (!isHebyInputKind(input.kind)) {
    issues.push(`input '${label}' declares unknown kind '${input.kind}'`);
  }

  // Provenance: complete, positive logical version, known and admissible lifecycle.
  if (!isNonEmpty(input.provenance.source)) issues.push(`input '${label}' provenance declares no source`);
  if (!isNonEmpty(input.provenance.attribution)) {
    issues.push(`input '${label}' provenance declares no attribution`);
  }
  if (!isPositiveInteger(input.provenance.version)) {
    issues.push(`input '${label}' provenance declares a non-positive-integer version`);
  }
  if (!isNonEmpty(input.provenance.effectivePeriod)) {
    issues.push(`input '${label}' provenance declares no effectivePeriod`);
  }
  if (!(input.provenance.lifecycle in HEBY_SOURCE_LIFECYCLE_DESCRIPTORS)) {
    issues.push(`input '${label}' provenance declares unknown lifecycle '${input.provenance.lifecycle}'`);
  } else if (!isHebySourceLifecycleAdmissible(input.provenance.lifecycle)) {
    issues.push(`input '${label}' grounds in a non-settled source ('${input.provenance.lifecycle}')`);
  }

  // Eligibility: governance must have marked the artifact eligible for admission.
  if (input.eligible !== true) issues.push(`input '${label}' is not marked eligible`);
}

/**
 * Validates a proposed admission request: a well-formed declared context with an
 * authority basis and well-formed constraints, and every proposed input of a known kind,
 * eligible, grounded in a settled source with complete provenance, and uniquely
 * identified. Fail-closed: any issue blocks admission.
 */
export function validateHebyAdmissionRequest(
  request: HebyAdmissionRequest,
): HebyInputContextValidation {
  const issues: string[] = [];

  if (!isNonEmpty(request.requestId)) issues.push("request declares no requestId");

  collectContextIssues(request.context, issues);

  const inputIds = new Set<string>();
  for (const input of request.inputs) {
    collectInputIssues(input, issues);
    if (inputIds.has(input.inputId)) {
      issues.push(`input id '${input.inputId}' is declared more than once`);
    }
    inputIds.add(input.inputId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a prepared context binding: a well-formed declared context, and every
 * admitted input admissible (known kind, eligible, settled, versioned) with a unique
 * identity. Defensive, post-admission, and fail-closed.
 */
export function validateHebyContextBinding(binding: HebyContextBinding): HebyInputContextValidation {
  const issues: string[] = [];

  if (!isNonEmpty(binding.requestId)) issues.push("binding declares no requestId");

  collectContextIssues(binding.context, issues);

  const inputIds = new Set<string>();
  for (const input of binding.inputs) {
    if (!isHebyInputAdmissible(input)) {
      issues.push(`admitted input '${input.inputId}' is not admissible`);
    }
    if (inputIds.has(input.inputId)) {
      issues.push(`admitted input id '${input.inputId}' appears more than once`);
    }
    inputIds.add(input.inputId);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical context binding is deep-frozen: the binding, its declared
 * context and constraint list, and its input list and each input's provenance are all
 * immutable. Defensive, post-normalization, and fail-closed.
 */
export function verifyHebyContextBindingFrozen(
  binding: HebyContextBinding,
): HebyInputContextValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(binding)) issues.push("binding is not frozen");
  if (!Object.isFrozen(binding.context)) issues.push("context is not frozen");
  if (!Object.isFrozen(binding.context.constraints)) issues.push("context constraints are not frozen");
  for (const constraint of binding.context.constraints) {
    if (!Object.isFrozen(constraint)) issues.push(`constraint '${constraint.constraintId}' is not frozen`);
  }
  if (!Object.isFrozen(binding.inputs)) issues.push("inputs are not frozen");
  for (const input of binding.inputs) {
    if (!Object.isFrozen(input)) issues.push(`input '${input.inputId}' is not frozen`);
    if (!Object.isFrozen(input.provenance)) issues.push(`input '${input.inputId}' provenance is not frozen`);
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
