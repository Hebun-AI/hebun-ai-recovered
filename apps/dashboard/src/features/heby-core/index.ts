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
 * presentation, clarifying ambiguity rather than assuming it — and Phase 6 (Approval
 * Preparation and Director Boundary) — the deterministic boundary that prepares items for a
 * human review or approval process, keeps approval visibly distinct from advice, states
 * consequences before confirmation, holds every item pending, and terminates every path at
 * the Director without deciding, approving, or implying authority — and Phase 7 (Governance
 * and Security Constraint Enforcement) — the deterministic gate that holds the applicable
 * constraints immutable and blocks presentation crossing a tenant or organization boundary,
 * resting on ineligible or unresolved evidence, or exposing a protected element, recording
 * every block, while never approving, waiving, authoring, or reinterpreting a constraint.
 * There is no reasoning, no answer generation, no invention, no independent AI call, and no
 * execution here. Later Heby phases consume these; none may redefine them.
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

// --- Phase 6 — Approval Preparation and Director Boundary --------------------

export {
  HEBY_DECISION_STATE_DESCRIPTORS,
  HEBY_PREPARATION_KIND_DESCRIPTORS,
} from "@/features/heby-core/heby-approval-types";
export type {
  CanonicalHebyPreparedApproval,
  HebyApprovalRequest,
  HebyDecisionState,
  HebyDecisionStateDescriptor,
  HebyDirectorTermination,
  HebyPreparationKind,
  HebyPreparationKindDescriptor,
  HebyPreparedApproval,
  HebyPreparedItem,
} from "@/features/heby-core/heby-approval-types";

export {
  allHebyDecisionStates,
  allHebyPreparationKinds,
  hebyDecisionStateDescriptorOf,
  hebyDecisionStateOrder,
  hebyKindDistinctFromAdvice,
  hebyKindRequiresConsequences,
  hebyPreparationKindDescriptorOf,
  hebyPreparationKindOrder,
  hebySubjectsWithinRouting,
  isHebyDecisionState,
  isHebyDecisionStateAdmissible,
  isHebyPreparationKind,
} from "@/features/heby-core/heby-approval-rules";

export {
  canonicalHebyPreparedApprovalKey,
  hebyPreparedItemKey,
  normalizeHebyPreparedApproval,
  normalizeHebyPreparedItem,
  normalizeHebyPreparedItems,
} from "@/features/heby-core/heby-approval-normalization";

export {
  validateHebyApprovalRequest,
  validateHebyPreparedApproval,
  verifyHebyPreparedApprovalFrozen,
} from "@/features/heby-core/heby-approval-validation";
export type { HebyApprovalValidation } from "@/features/heby-core/heby-approval-validation";

export {
  HEBY_APPROVAL_CAPABILITIES,
  HEBY_APPROVAL_NON_RESPONSIBILITIES,
  prepareHebyApproval,
} from "@/features/heby-core/heby-approval-boundary";
export type {
  HebyApprovalCapability,
  HebyApprovalInput,
  HebyApprovalNonResponsibility,
  HebyApprovalResult,
} from "@/features/heby-core/heby-approval-boundary";

// --- Phase 7 — Governance and Security Constraint Enforcement ----------------

export {
  HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS,
  HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS,
} from "@/features/heby-core/heby-governance-types";
export type {
  CanonicalHebyGatedPresentation,
  HebyGatedPresentation,
  HebyGovernanceBlock,
  HebyGovernanceBlockReason,
  HebyGovernanceBlockReasonDescriptor,
  HebyGovernanceGateRequest,
  HebyGovernanceScope,
  HebyGovernanceSubjectKind,
  HebyGovernanceSubjectKindDescriptor,
} from "@/features/heby-core/heby-governance-types";

export {
  allHebyGovernanceBlockReasons,
  allHebyGovernanceSubjectKinds,
  hebyClassifyElementGovernance,
  hebyGovernanceBlockReasonConstraintKind,
  hebyGovernanceBlockReasonDescriptorOf,
  hebyGovernanceBlockReasonOrder,
  hebyGovernanceScopeOf,
  hebyGovernanceSubjectKindDescriptorOf,
  hebyGovernanceSubjectKindOrder,
  hebyScopeMismatchReason,
  hebyScopesMatch,
  isHebyGovernanceBlockReason,
  isHebyGovernanceSubjectKind,
} from "@/features/heby-core/heby-governance-rules";

export {
  canonicalHebyGatedPresentationKey,
  hebyGovernanceBlockKey,
  normalizeHebyGatedPresentation,
} from "@/features/heby-core/heby-governance-normalization";

export {
  validateHebyGatedPresentation,
  validateHebyGovernanceGateRequest,
  verifyHebyGatedPresentationFrozen,
} from "@/features/heby-core/heby-governance-validation";
export type { HebyGovernanceValidation } from "@/features/heby-core/heby-governance-validation";

export {
  HEBY_GOVERNANCE_CAPABILITIES,
  HEBY_GOVERNANCE_NON_RESPONSIBILITIES,
  gateHebyPresentation,
} from "@/features/heby-core/heby-governance-boundary";
export type {
  HebyGovernanceCapability,
  HebyGovernanceInput,
  HebyGovernanceNonResponsibility,
  HebyGovernanceResult,
} from "@/features/heby-core/heby-governance-boundary";
