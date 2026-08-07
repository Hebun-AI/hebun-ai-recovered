/**
 * Heby Core — public barrel.
 *
 * The single public surface of Heby Core. It re-exports Phase 1 (Identity Foundation) —
 * Heby's immutable identity — Phase 2 (Input and Context Consumption) — the read-only
 * admission of settled Runtime, Reasoning, and Memory artifacts bound to a declared
 * context — Phase 3 (Presentation and Explanation) — the honest rendering of admitted
 * material into attributable, non-authoritative presentations — Phase 4 (Grounding and
 * Anti-Hallucination) — the cross-cutting verification that every presented element traces
 * to a settled source, withholding and clearly marking anything unsupported — and Phase 5
 * (Intent and Natural-Language Interaction) — the deterministic boundary that validates an
 * untrusted, model-shaped interpretation and routes it only to grounded, bounded
 * presentation, clarifying ambiguity rather than assuming it. There is no reasoning, no
 * answer generation, no invention, no independent AI call, and no execution here. Later Heby
 * phases consume these; none may redefine them.
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

// --- Phase 3 — Presentation and Explanation ----------------------------------

export {
  HEBY_CONFIDENCE_LEVEL_DESCRIPTORS,
  HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS,
  HEBY_EXPLANATION_FACET_DESCRIPTORS,
  HEBY_PRESENTATION_KIND_DESCRIPTORS,
} from "@/features/heby-core/heby-presentation-types";
export type {
  CanonicalHebyPresentation,
  HebyConfidenceLevel,
  HebyConfidenceLevelDescriptor,
  HebyElementClassification,
  HebyElementClassificationDescriptor,
  HebyExplanationEntry,
  HebyExplanationFacet,
  HebyExplanationFacetDescriptor,
  HebyPresentation,
  HebyPresentationElement,
  HebyPresentationKind,
  HebyPresentationKindDescriptor,
  HebyPresentationRequest,
} from "@/features/heby-core/heby-presentation-types";

export {
  allHebyExplanationFacets,
  allHebyPresentationKinds,
  hebyAdmittedIdSet,
  hebyConfidenceLevelDescriptorOf,
  hebyConfidenceRequiresUncertainty,
  hebyElementClassificationDescriptorOf,
  hebyElementsOfKind,
  hebyExplanationFacetDescriptorOf,
  hebyExplanationFacetOrder,
  hebyPresentationKindDescriptorOf,
  hebyPresentationKindOrder,
  hebyRefsAttributable,
  isHebyConfidenceLevel,
  isHebyElementClassification,
  isHebyElementHonestlyMarked,
  isHebyElementPresentable,
  isHebyExplanationFacet,
  isHebyPresentationKind,
} from "@/features/heby-core/heby-presentation-rules";

export {
  canonicalHebyPresentationKey,
  hebyExplanationEntryKey,
  hebyPresentationElementKey,
  normalizeHebyElements,
  normalizeHebyExplanation,
  normalizeHebyPresentation,
} from "@/features/heby-core/heby-presentation-normalization";

export {
  validateHebyPresentation,
  validateHebyPresentationRequest,
  verifyHebyPresentationFrozen,
} from "@/features/heby-core/heby-presentation-validation";
export type { HebyPresentationValidation } from "@/features/heby-core/heby-presentation-validation";

export {
  HEBY_PRESENTATION_CAPABILITIES,
  HEBY_PRESENTATION_NON_RESPONSIBILITIES,
  presentHebyMaterial,
} from "@/features/heby-core/heby-presentation-boundary";
export type {
  HebyPresentationCapability,
  HebyPresentationInput,
  HebyPresentationNonResponsibility,
  HebyPresentationResult,
} from "@/features/heby-core/heby-presentation-boundary";

// --- Phase 4 — Grounding and Anti-Hallucination ------------------------------

export {
  HEBY_GROUNDING_STATUS_DESCRIPTORS,
  HEBY_WITHHOLD_REASON_DESCRIPTORS,
} from "@/features/heby-core/heby-grounding-types";
export type {
  CanonicalHebyGroundedPresentation,
  HebyGroundedPresentation,
  HebyGroundingRequest,
  HebyGroundingStatus,
  HebyGroundingStatusDescriptor,
  HebyGroundingTrace,
  HebyWithheldElement,
  HebyWithholdReason,
  HebyWithholdReasonDescriptor,
} from "@/features/heby-core/heby-grounding-types";

export {
  allHebyGroundingStatuses,
  allHebyWithholdReasons,
  classifyHebyElementGrounding,
  hebyAdmittedInputIndex,
  hebyGroundingStatusDescriptorOf,
  hebyWithholdReasonDescriptorOf,
  hebyWithholdReasonOrder,
  isHebyElementGrounded,
  isHebyGroundingStatus,
  isHebySettledSource,
  isHebyWithholdReason,
} from "@/features/heby-core/heby-grounding-rules";
export type { HebyElementGrounding } from "@/features/heby-core/heby-grounding-rules";

export {
  canonicalHebyGroundedPresentationKey,
  hebyGroundingTraceKey,
  hebyWithheldElementKey,
  normalizeHebyGroundedPresentation,
  normalizeHebyTraces,
  normalizeHebyWithheld,
} from "@/features/heby-core/heby-grounding-normalization";

export {
  validateHebyGroundedPresentation,
  validateHebyGroundingRequest,
  verifyHebyGroundedPresentationFrozen,
} from "@/features/heby-core/heby-grounding-validation";
export type { HebyGroundingValidation } from "@/features/heby-core/heby-grounding-validation";

export {
  HEBY_GROUNDING_CAPABILITIES,
  HEBY_GROUNDING_NON_RESPONSIBILITIES,
  groundHebyPresentation,
} from "@/features/heby-core/heby-grounding-boundary";
export type {
  HebyGroundingCapability,
  HebyGroundingInput,
  HebyGroundingNonResponsibility,
  HebyGroundingResult,
} from "@/features/heby-core/heby-grounding-boundary";

// --- Phase 5 — Intent and Natural-Language Interaction -----------------------

export { HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS } from "@/features/heby-core/heby-intent-types";
export type {
  CanonicalHebyRoutedIntent,
  HebyClarification,
  HebyIntentRequest,
  HebyInterpretationDisposition,
  HebyInterpretationDispositionDescriptor,
  HebyProposedIntent,
  HebyRoutedIntent,
  HebyUtterance,
} from "@/features/heby-core/heby-intent-types";

export {
  allHebyInterpretationDispositions,
  hebyGroundedElementIdSet,
  hebyInterpretationDispositionDescriptorOf,
  hebyInterpretationDispositionOrder,
  hebyRoutesToGrounded,
  isHebyCapabilityWithinIdentity,
  isHebyInterpretationDisposition,
} from "@/features/heby-core/heby-intent-rules";

export {
  canonicalHebyRoutedIntentKey,
  normalizeHebyRoutedIntent,
  normalizeHebyRoutedRefs,
} from "@/features/heby-core/heby-intent-normalization";

export {
  validateHebyIntentRequest,
  validateHebyRoutedIntent,
  verifyHebyRoutedIntentFrozen,
} from "@/features/heby-core/heby-intent-validation";
export type { HebyIntentValidation } from "@/features/heby-core/heby-intent-validation";

export {
  HEBY_INTENT_CAPABILITIES,
  HEBY_INTENT_NON_RESPONSIBILITIES,
  interpretHebyIntent,
} from "@/features/heby-core/heby-intent-boundary";
export type {
  HebyIntentCapability,
  HebyIntentInput,
  HebyIntentNonResponsibility,
  HebyIntentResult,
} from "@/features/heby-core/heby-intent-boundary";
