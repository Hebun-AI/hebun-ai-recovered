/**
 * Heby Core — input and context normalization (Phase 2, Input and Context Consumption).
 *
 * Deterministically canonicalizes a context binding:
 *   - admitted inputs are de-duplicated by identity and totally ordered by input-kind
 *     ordinal then admission identity,
 *   - a declared context's constraints are de-duplicated by identity and totally ordered
 *     by constraint-kind ordinal then constraint identity,
 *   - provenance, source identity, and every declared context field are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole binding is emitted immutable and deep-frozen.
 *
 * This is pure canonical normalization — NO interface behaviour, NO presentation, NO
 * reasoning, NO runtime/memory/reasoning call, NO mutation of any preserved value.
 * Ordering and de-duplication happen by canonical ordinal or by text key only. Keys use
 * JSON encoding so they are unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 * Normalization is idempotent: the canonical form of a canonical binding is itself.
 */

import {
  type CanonicalHebyContextBinding,
  type HebyAdmittedInput,
  type HebyConstraint,
  type HebyContextBinding,
  type HebyDeclaredContext,
} from "@/features/heby-core/heby-input-context-types";
import {
  hebyConstraintKindOrder,
  hebyInputKindOrder,
} from "@/features/heby-core/heby-input-context-rules";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * De-duplicates admitted inputs by identity (first occurrence wins) and totally orders
 * them by input-kind ordinal, then by admission identity. Provenance and source identity
 * are carried UNCHANGED; each input is frozen.
 */
export function normalizeHebyInputs(
  inputs: readonly HebyAdmittedInput[],
): readonly HebyAdmittedInput[] {
  const byId = new Map<HebyId, HebyAdmittedInput>();
  for (const input of inputs) {
    if (!byId.has(input.inputId)) byId.set(input.inputId, input);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const byKind = hebyInputKindOrder(left.kind) - hebyInputKindOrder(right.kind);
      return byKind !== 0 ? byKind : compareStrings(left.inputId, right.inputId);
    })
    .map((input) =>
      Object.freeze({
        inputId: input.inputId,
        kind: input.kind,
        sourceId: input.sourceId,
        provenance: Object.freeze({ ...input.provenance }),
        eligible: input.eligible,
      }),
    );
}

/**
 * De-duplicates constraints by identity (first occurrence wins) and totally orders them
 * by constraint-kind ordinal, then by constraint identity. Each constraint is frozen.
 */
export function normalizeHebyConstraints(
  constraints: readonly HebyConstraint[],
): readonly HebyConstraint[] {
  const byId = new Map<HebyId, HebyConstraint>();
  for (const constraint of constraints) {
    if (!byId.has(constraint.constraintId)) byId.set(constraint.constraintId, constraint);
  }
  return [...byId.values()]
    .sort((left, right) => {
      const byKind =
        hebyConstraintKindOrder(left.constraintKind) - hebyConstraintKindOrder(right.constraintKind);
      return byKind !== 0 ? byKind : compareStrings(left.constraintId, right.constraintId);
    })
    .map((constraint) => Object.freeze({ ...constraint }));
}

/** Canonicalizes a declared context: its constraints ordered, every field carried UNCHANGED. Frozen. */
export function normalizeHebyDeclaredContext(context: HebyDeclaredContext): HebyDeclaredContext {
  return Object.freeze({
    contextId: context.contextId,
    role: context.role,
    domain: context.domain,
    subject: context.subject,
    authorityBasis: context.authorityBasis,
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    constraints: Object.freeze(normalizeHebyConstraints(context.constraints)),
  });
}

/** An unambiguous, text-safe key for one admitted input. */
export function hebyAdmittedInputKey(input: HebyAdmittedInput): string {
  return JSON.stringify([
    input.inputId,
    input.kind,
    input.sourceId,
    input.provenance.source,
    input.provenance.attribution,
    input.provenance.version,
    input.provenance.effectivePeriod,
    input.provenance.lifecycle,
    input.eligible,
  ]);
}

/** An unambiguous, text-safe key for one constraint. */
export function hebyConstraintKey(constraint: HebyConstraint): string {
  return JSON.stringify([constraint.constraintKind, constraint.constraintId, constraint.statement]);
}

/**
 * Canonicalizes a context binding into an immutable, deep-frozen form. Deterministic and
 * idempotent: the same input always produces the same canonical binding, and the
 * canonical form of a canonical binding is itself. Inputs and constraints are ordered;
 * provenance, source identity, and every context field are carried UNCHANGED.
 */
export function normalizeHebyContextBinding(
  binding: HebyContextBinding,
): CanonicalHebyContextBinding {
  return Object.freeze({
    requestId: binding.requestId,
    context: normalizeHebyDeclaredContext(binding.context),
    inputs: Object.freeze(normalizeHebyInputs(binding.inputs)),
  });
}

/**
 * A canonical, text-safe key for a whole binding: its request identity, its context in
 * canonical form, and its ordered input keys. The same binding always produces the same
 * key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyContextBindingKey(binding: HebyContextBinding): string {
  const context = normalizeHebyDeclaredContext(binding.context);
  return JSON.stringify([
    binding.requestId,
    context.contextId,
    context.role,
    context.domain,
    context.subject,
    context.authorityBasis,
    context.organizationId,
    context.tenantId,
    context.constraints.map(hebyConstraintKey),
    normalizeHebyInputs(binding.inputs).map(hebyAdmittedInputKey),
  ]);
}
