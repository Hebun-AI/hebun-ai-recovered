/**
 * Heby Core — public barrel.
 *
 * The single public surface of Heby Core. It re-exports Phase 1 (Identity Foundation) —
 * Heby's immutable identity — and Phase 2 (Input and Context Consumption) — the read-only
 * admission of settled Runtime, Reasoning, and Memory artifacts bound to a declared
 * context. There is no interface behaviour, no presentation, no reasoning, no answer
 * generation, no AI, and no execution here. Later Heby phases consume these; none may
 * redefine them.
 */

export {
  HEBY_CAPABILITY_DESCRIPTORS,
  HEBY_NON_IDENTITY_DESCRIPTORS,
  HEBY_NON_RESPONSIBILITY_DESCRIPTORS,
} from "@/features/heby-core/heby-identity-types";
export type {
  CanonicalHebyIdentity,
  HebyCapability,
  HebyCapabilityDescriptor,
  HebyId,
  HebyIdentity,
  HebyName,
  HebyNonIdentity,
  HebyNonIdentityDescriptor,
  HebyNonResponsibility,
  HebyNonResponsibilityDescriptor,
  HebyPrincipleGroup,
  HebyPrincipleKind,
  HebyRole,
  HebyStatement,
} from "@/features/heby-core/heby-identity-types";

export {
  allHebyCapabilities,
  allHebyNonIdentities,
  allHebyNonResponsibilities,
  hebyCapabilityDescriptorOf,
  hebyCapabilityOrder,
  hebyNonIdentityDescriptorOf,
  hebyNonIdentityOrder,
  hebyNonResponsibilityDescriptorOf,
  hebyNonResponsibilityOrder,
  isHebyCapability,
  isHebyNonIdentity,
  isHebyNonResponsibility,
} from "@/features/heby-core/heby-identity-rules";

export {
  canonicalHebyIdentityKey,
  hebyPrincipleGroupKey,
  normalizeHebyCapabilities,
  normalizeHebyIdentity,
  normalizeHebyNonIdentities,
  normalizeHebyNonResponsibilities,
  normalizeHebyPrincipleGroup,
  normalizeHebyStatements,
} from "@/features/heby-core/heby-identity-normalization";

export {
  validateHebyIdentity,
  verifyHebyIdentityFrozen,
} from "@/features/heby-core/heby-identity-validation";
export type { HebyIdentityValidation } from "@/features/heby-core/heby-identity-validation";

export {
  CANONICAL_HEBY_IDENTITY,
  HEBY_CAPABILITIES,
  HEBY_NON_RESPONSIBILITIES,
  resolveCanonicalHebyIdentity,
  resolveHebyIdentity,
} from "@/features/heby-core/heby-identity-boundary";
export type { HebyIdentityResult } from "@/features/heby-core/heby-identity-boundary";

// --- Phase 2 — Input and Context Consumption ---------------------------------

export {
  HEBY_CONSTRAINT_KIND_DESCRIPTORS,
  HEBY_INPUT_KIND_DESCRIPTORS,
  HEBY_SOURCE_LIFECYCLE_DESCRIPTORS,
} from "@/features/heby-core/heby-input-context-types";
export type {
  CanonicalHebyContextBinding,
  HebyAdmissionRequest,
  HebyAdmittedInput,
  HebyConstraint,
  HebyConstraintKind,
  HebyConstraintKindDescriptor,
  HebyContextBinding,
  HebyDeclaredContext,
  HebyInputKind,
  HebyInputKindDescriptor,
  HebyProvenance,
  HebySourceLifecycle,
  HebySourceLifecycleDescriptor,
} from "@/features/heby-core/heby-input-context-types";

export {
  allHebyConstraintKinds,
  allHebyInputKinds,
  hebyConstraintKindDescriptorOf,
  hebyConstraintKindOrder,
  hebyInputIndex,
  hebyInputKindDescriptorOf,
  hebyInputKindOrder,
  hebyInputProvenance,
  hebyInputsOfKind,
  hebyProvenanceHasVersion,
  hebySourceLifecycleDescriptorOf,
  isHebyConstraintKind,
  isHebyInputAdmissible,
  isHebyInputKind,
  isHebySourceLifecycle,
  isHebySourceLifecycleAdmissible,
} from "@/features/heby-core/heby-input-context-rules";

export {
  canonicalHebyContextBindingKey,
  hebyAdmittedInputKey,
  hebyConstraintKey,
  normalizeHebyConstraints,
  normalizeHebyContextBinding,
  normalizeHebyDeclaredContext,
  normalizeHebyInputs,
} from "@/features/heby-core/heby-input-context-normalization";

export {
  validateHebyAdmissionRequest,
  validateHebyContextBinding,
  verifyHebyContextBindingFrozen,
} from "@/features/heby-core/heby-input-context-validation";
export type { HebyInputContextValidation } from "@/features/heby-core/heby-input-context-validation";

export {
  HEBY_INPUT_CONTEXT_CAPABILITIES,
  HEBY_INPUT_CONTEXT_NON_RESPONSIBILITIES,
  admitHebyContext,
} from "@/features/heby-core/heby-input-context-boundary";
export type {
  HebyContextBindingResult,
  HebyInputContextCapability,
  HebyInputContextInput,
  HebyInputContextNonResponsibility,
} from "@/features/heby-core/heby-input-context-boundary";
