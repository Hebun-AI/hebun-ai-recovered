/**
 * Heby Core — input and context rules (Phase 2, Input and Context Consumption).
 *
 * Pure, deterministic lookups and projections over Heby's input-kind, source-lifecycle,
 * and constraint-kind descriptor tables, plus the fail-closed admissibility check for one
 * proposed input and read-only projections over admitted inputs. These answer plain
 * questions — is this a known input kind, is this artifact admissible, which inputs are of
 * this kind — and index inputs by identity. NO interface behaviour, NO presentation, NO
 * reasoning, NO answer generation, NO runtime/memory/reasoning call, NO decision, NO AI,
 * NO mutation — only table reads and pure, repeatable projections.
 */

import {
  HEBY_CONSTRAINT_KIND_DESCRIPTORS,
  HEBY_INPUT_KIND_DESCRIPTORS,
  HEBY_SOURCE_LIFECYCLE_DESCRIPTORS,
  type HebyAdmittedInput,
  type HebyConstraintKind,
  type HebyConstraintKindDescriptor,
  type HebyInputKind,
  type HebyInputKindDescriptor,
  type HebyProvenance,
  type HebySourceLifecycle,
  type HebySourceLifecycleDescriptor,
} from "@/features/heby-core/heby-input-context-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

// --- Membership --------------------------------------------------------------

/** True when a string is a declared, admissible Heby input kind. Read-only table check. */
export function isHebyInputKind(value: string): value is HebyInputKind {
  return Object.prototype.hasOwnProperty.call(HEBY_INPUT_KIND_DESCRIPTORS, value);
}

/** True when a string is a declared Heby source lifecycle state. Read-only table check. */
export function isHebySourceLifecycle(value: string): value is HebySourceLifecycle {
  return Object.prototype.hasOwnProperty.call(HEBY_SOURCE_LIFECYCLE_DESCRIPTORS, value);
}

/** True when a string is a declared Heby constraint kind. Read-only table check. */
export function isHebyConstraintKind(value: string): value is HebyConstraintKind {
  return Object.prototype.hasOwnProperty.call(HEBY_CONSTRAINT_KIND_DESCRIPTORS, value);
}

// --- Descriptor lookups ------------------------------------------------------

/** The canonical descriptor for an input kind. Read-only projection. */
export function hebyInputKindDescriptorOf(kind: HebyInputKind): HebyInputKindDescriptor {
  return HEBY_INPUT_KIND_DESCRIPTORS[kind];
}

/** The canonical descriptor for a source lifecycle state. Read-only projection. */
export function hebySourceLifecycleDescriptorOf(
  lifecycle: HebySourceLifecycle,
): HebySourceLifecycleDescriptor {
  return HEBY_SOURCE_LIFECYCLE_DESCRIPTORS[lifecycle];
}

/** The canonical descriptor for a constraint kind. Read-only projection. */
export function hebyConstraintKindDescriptorOf(
  constraintKind: HebyConstraintKind,
): HebyConstraintKindDescriptor {
  return HEBY_CONSTRAINT_KIND_DESCRIPTORS[constraintKind];
}

// --- Canonical ordinals ------------------------------------------------------

/** The fixed canonical order of an input kind. Ordinal only — not a score. */
export function hebyInputKindOrder(kind: HebyInputKind): number {
  return HEBY_INPUT_KIND_DESCRIPTORS[kind].order;
}

/** The fixed canonical order of a constraint kind. Ordinal only — not a score. */
export function hebyConstraintKindOrder(constraintKind: HebyConstraintKind): number {
  return HEBY_CONSTRAINT_KIND_DESCRIPTORS[constraintKind].order;
}

// --- Admissibility -----------------------------------------------------------

/** True when a referenced artifact's lifecycle state permits admission. Only settled. */
export function isHebySourceLifecycleAdmissible(lifecycle: HebySourceLifecycle): boolean {
  return HEBY_SOURCE_LIFECYCLE_DESCRIPTORS[lifecycle].admissible === true;
}

/** Whether provenance carries a valid, positive-integer logical version. */
export function hebyProvenanceHasVersion(provenance: HebyProvenance): boolean {
  return Number.isInteger(provenance.version) && provenance.version >= 1;
}

/**
 * True when one proposed input is admissible: a known input kind, marked eligible, and
 * grounded in a settled source with a positive logical version. Fail-closed grounding —
 * an unknown kind, an ineligible mark, a non-settled lifecycle, or a missing version
 * makes the input inadmissible. This reads the input only; it admits nothing.
 */
export function isHebyInputAdmissible(input: HebyAdmittedInput): boolean {
  if (!isHebyInputKind(input.kind)) return false;
  if (input.eligible !== true) return false;
  if (!isHebySourceLifecycleAdmissible(input.provenance.lifecycle)) return false;
  if (!hebyProvenanceHasVersion(input.provenance)) return false;
  return true;
}

// --- Projections -------------------------------------------------------------

/** Indexes admitted inputs by admission identity. First occurrence of an id wins. Read-only. */
export function hebyInputIndex(
  inputs: readonly HebyAdmittedInput[],
): ReadonlyMap<HebyId, HebyAdmittedInput> {
  const index = new Map<HebyId, HebyAdmittedInput>();
  for (const input of inputs) {
    if (!index.has(input.inputId)) index.set(input.inputId, input);
  }
  return index;
}

/** The admitted inputs of one kind, in declared order. Read-only projection. */
export function hebyInputsOfKind(
  inputs: readonly HebyAdmittedInput[],
  kind: HebyInputKind,
): readonly HebyAdmittedInput[] {
  return inputs.filter((input) => input.kind === kind);
}

/** The preserved provenance of an admitted input. Read-only projection. */
export function hebyInputProvenance(input: HebyAdmittedInput): HebyProvenance {
  return input.provenance;
}

/** Every declared input kind, in canonical order. Deterministic. */
export function allHebyInputKinds(): readonly HebyInputKind[] {
  return (Object.keys(HEBY_INPUT_KIND_DESCRIPTORS) as HebyInputKind[]).sort(
    (left, right) => hebyInputKindOrder(left) - hebyInputKindOrder(right),
  );
}

/** Every declared constraint kind, in canonical order. Deterministic. */
export function allHebyConstraintKinds(): readonly HebyConstraintKind[] {
  return (Object.keys(HEBY_CONSTRAINT_KIND_DESCRIPTORS) as HebyConstraintKind[]).sort(
    (left, right) => hebyConstraintKindOrder(left) - hebyConstraintKindOrder(right),
  );
}
