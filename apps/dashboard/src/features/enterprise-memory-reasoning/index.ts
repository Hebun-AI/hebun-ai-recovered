export type {
  ReasoningArtifact,
  ReasoningArtifactKind,
  ReasoningId,
  ReasoningStatement,
  ReasoningTimestamp,
} from "@/features/enterprise-memory-reasoning/contracts";
export type {
  EvidenceItem,
  EvidenceReference,
  EvidenceSet,
} from "@/features/enterprise-memory-reasoning/evidence";
export type { ReasoningGoal, ReasoningGoalId } from "@/features/enterprise-memory-reasoning/goal";
export type {
  ReasoningRelation,
  ReasoningRelationId,
  ReasoningRelationType,
} from "@/features/enterprise-memory-reasoning/relation";
export type {
  ReasoningImplication,
  ReasoningImplicationId,
} from "@/features/enterprise-memory-reasoning/implication";
export type {
  ReasoningContradiction,
  ReasoningContradictionId,
} from "@/features/enterprise-memory-reasoning/contradiction";
export type { ReasoningGap, ReasoningGapId } from "@/features/enterprise-memory-reasoning/gap";
export type {
  ReasoningConfidence,
  ReasoningConfidenceLevel,
  ReasoningUncertainty,
} from "@/features/enterprise-memory-reasoning/confidence";
export type { ReasoningUnderstanding } from "@/features/enterprise-memory-reasoning/understanding";
export type {
  ReasoningNonResponsibility,
  ReasoningRequest,
  ReasoningRequestId,
} from "@/features/enterprise-memory-reasoning/boundary";
export { validateUnderstanding } from "@/features/enterprise-memory-reasoning/validation";
export type { ReasoningValidation } from "@/features/enterprise-memory-reasoning/validation";
export { RELATION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/relation-types";
export type {
  RelationCardinality,
  RelationDirection,
  RelationTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/relation-types";
export {
  cardinalityOf,
  descriptorOf,
  directionOf,
  isOneToOne,
  isSymmetric,
} from "@/features/enterprise-memory-reasoning/relation-rules";
export {
  canonicalRelationKey,
  evidenceKey,
  normalizeRelation,
  normalizeRelations,
} from "@/features/enterprise-memory-reasoning/relation-normalization";
export { validateRelationSet } from "@/features/enterprise-memory-reasoning/relation-validation";
export type { RelationValidation } from "@/features/enterprise-memory-reasoning/relation-validation";
export { normalizeRelationSet } from "@/features/enterprise-memory-reasoning/relation-boundary";
export type {
  NormalizedRelationSet,
  RelationSet,
  RelationSetResult,
} from "@/features/enterprise-memory-reasoning/relation-boundary";
export { IMPLICATION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/implication-types";
export type {
  ClassifiedImplication,
  ImplicationDirection,
  ImplicationType,
  ImplicationTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/implication-types";
export {
  implicationDescriptorOf,
  implicationDirectionOf,
  implicationIsBidirectional,
  implicationMinimumBasis,
  implicationRequiresRelation,
} from "@/features/enterprise-memory-reasoning/implication-rules";
export {
  canonicalImplicationKey,
  normalizeImplication,
  normalizeImplications,
} from "@/features/enterprise-memory-reasoning/implication-normalization";
export { validateImplicationSet } from "@/features/enterprise-memory-reasoning/implication-validation";
export type { ImplicationValidation } from "@/features/enterprise-memory-reasoning/implication-validation";
export { normalizeImplicationSet } from "@/features/enterprise-memory-reasoning/implication-boundary";
export type {
  ImplicationSet,
  ImplicationSetResult,
  NormalizedImplicationSet,
} from "@/features/enterprise-memory-reasoning/implication-boundary";
export { CONTRADICTION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/contradiction-types";
export type {
  ClassifiedContradiction,
  ContradictionDependencies,
  ContradictionScope,
  ContradictionSeverity,
  ContradictionType,
  ContradictionTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/contradiction-types";
export {
  contradictionDescriptorOf,
  contradictionIsCollective,
  contradictionMinimumBetween,
  contradictionRequiresImplication,
  contradictionRequiresRelation,
  contradictionScopeOf,
  contradictionSeverityOf,
} from "@/features/enterprise-memory-reasoning/contradiction-rules";
export {
  canonicalContradictionKey,
  normalizeContradiction,
  normalizeContradictions,
} from "@/features/enterprise-memory-reasoning/contradiction-normalization";
export { validateContradictionSet } from "@/features/enterprise-memory-reasoning/contradiction-validation";
export type { ContradictionValidation } from "@/features/enterprise-memory-reasoning/contradiction-validation";
export { normalizeContradictionSet } from "@/features/enterprise-memory-reasoning/contradiction-boundary";
export type {
  ContradictionSet,
  ContradictionSetResult,
  NormalizedContradictionSet,
} from "@/features/enterprise-memory-reasoning/contradiction-boundary";
export { GAP_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/gap-types";
export type {
  ClassifiedGap,
  GapCategory,
  GapDependencies,
  GapScope,
  GapSeverity,
  GapType,
  GapTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/gap-types";
export {
  gapCategoryOf,
  gapDescriptorOf,
  gapIsContextual,
  gapMinimumRelated,
  gapRequiresReference,
  gapScopeOf,
  gapSeverityOf,
} from "@/features/enterprise-memory-reasoning/gap-rules";
export {
  canonicalGapKey,
  normalizeGap,
  normalizeGaps,
} from "@/features/enterprise-memory-reasoning/gap-normalization";
export { validateGapSet } from "@/features/enterprise-memory-reasoning/gap-validation";
export type { GapValidation } from "@/features/enterprise-memory-reasoning/gap-validation";
export { normalizeGapSet } from "@/features/enterprise-memory-reasoning/gap-boundary";
export type {
  GapSet,
  GapSetResult,
  NormalizedGapSet,
} from "@/features/enterprise-memory-reasoning/gap-boundary";
export {
  PROVENANCE_ARTIFACT_DESCRIPTORS,
  PROVENANCE_SOURCE_DESCRIPTORS,
} from "@/features/enterprise-memory-reasoning/provenance-types";
export type {
  Provenance,
  ProvenanceArtifactDescriptor,
  ProvenanceArtifactId,
  ProvenanceArtifactKind,
  ProvenanceChain,
  ProvenanceLineage,
  ProvenanceReference,
  ProvenanceSourceDescriptor,
  ProvenanceSourceKind,
} from "@/features/enterprise-memory-reasoning/provenance-types";
export {
  dependencyLineageOf,
  lineageOf,
  provenanceArtifactDescriptorOf,
  provenanceArtifactPermits,
  provenanceRequiresEvidenceRoot,
  provenanceSourceDescriptorOf,
  provenanceSourceIsRoot,
} from "@/features/enterprise-memory-reasoning/provenance-rules";
export {
  canonicalProvenanceKey,
  normalizeChain,
  normalizeProvenance,
  normalizeProvenances,
  provenanceReferenceKey,
} from "@/features/enterprise-memory-reasoning/provenance-normalization";
export { validateProvenanceSet } from "@/features/enterprise-memory-reasoning/provenance-validation";
export type { ProvenanceValidation } from "@/features/enterprise-memory-reasoning/provenance-validation";
export { normalizeProvenanceSet } from "@/features/enterprise-memory-reasoning/provenance-boundary";
export type {
  NormalizedProvenanceSet,
  ProvenanceSet,
  ProvenanceSetResult,
} from "@/features/enterprise-memory-reasoning/provenance-boundary";
export { EXPLANATION_KIND_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/explainability-types";
export type {
  CanonicalExplanation,
  ContradictionExplanation,
  EvidenceExplanation,
  Explanation,
  ExplanationChain,
  ExplanationKind,
  ExplanationKindDescriptor,
  ExplanationLineage,
  ExplanationReference,
  ExplanationReferenceKind,
  ExplanationStep,
  ExplanationSubject,
  GapExplanation,
  ImplicationExplanation,
  ProvenanceExplanation,
  RelationExplanation,
} from "@/features/enterprise-memory-reasoning/explainability-types";
export {
  explanationIsGrounded,
  explanationKindDescriptorOf,
  explanationPermitsReference,
  explanationRequiresEvidenceRoot,
  lineageOf as explanationLineageOf,
  reachesEvidenceRoot,
  referencesOf,
} from "@/features/enterprise-memory-reasoning/explainability-rules";
export {
  canonicalExplanationKey,
  explanationReferenceKey,
  explanationStepKey,
  normalizeChain as normalizeExplanationChain,
  normalizeExplanation,
  normalizeExplanations,
  normalizeStep as normalizeExplanationStep,
} from "@/features/enterprise-memory-reasoning/explainability-normalization";
export { validateExplanationSet } from "@/features/enterprise-memory-reasoning/explainability-validation";
export type { ExplainabilityValidation } from "@/features/enterprise-memory-reasoning/explainability-validation";
export { normalizeExplanationSet } from "@/features/enterprise-memory-reasoning/explainability-boundary";
export type {
  ExplanationSet,
  ExplanationSetResult,
  NormalizedExplanationSet,
} from "@/features/enterprise-memory-reasoning/explainability-boundary";
export {
  CONFIDENCE_FACTOR_DESCRIPTORS,
  CONFIDENCE_LEVEL_DESCRIPTORS,
  CONFIDENCE_SOURCE_DESCRIPTORS,
  CONFIDENCE_SUBJECT_DESCRIPTORS,
  UNCERTAINTY_CATEGORY_DESCRIPTORS,
} from "@/features/enterprise-memory-reasoning/confidence-types";
export type {
  CanonicalConfidence,
  Confidence,
  ConfidenceAssumption,
  ConfidenceChain,
  ConfidenceClassification,
  ConfidenceEvidence,
  ConfidenceFactorDescriptor,
  ConfidenceFactorKind,
  ConfidenceFactorPolarity,
  ConfidenceLevelDescriptor,
  ConfidenceLimitation,
  ConfidenceLineage,
  ConfidenceReference,
  ConfidenceSourceDescriptor,
  ConfidenceSourceKind,
  ConfidenceSubject,
  ConfidenceSubjectDescriptor,
  ConfidenceSubjectKind,
  Uncertainty,
  UncertaintyCategory,
  UncertaintyCategoryDescriptor,
  UncertaintyReason,
  UncertaintySource,
} from "@/features/enterprise-memory-reasoning/confidence-types";
export {
  compareConfidenceLevel,
  confidenceClassificationOf,
  confidenceFactorDescriptorOf,
  confidenceFactorPolarityOf,
  confidenceLevelDescriptorOf,
  confidenceRank,
  confidenceRequiresEvidenceRoot,
  confidenceRequiresUncertainty,
  confidenceSourceDescriptorOf,
  confidenceSourceIsGrounding,
  confidenceSubjectDescriptorOf,
  confidenceSubjectPermits,
  evidenceOf as confidenceEvidenceOf,
  lineageOf as confidenceLineageOf,
  reachesEvidenceRoot as confidenceReachesEvidenceRoot,
  uncertaintyCategoryDescriptorOf,
  uncertaintyIsResolvable,
} from "@/features/enterprise-memory-reasoning/confidence-rules";
export {
  canonicalConfidenceKey,
  confidenceReferenceKey,
  normalizeAssumptions as normalizeConfidenceAssumptions,
  normalizeChain as normalizeConfidenceChain,
  normalizeConfidence,
  normalizeConfidences,
  normalizeFactors as normalizeConfidenceFactors,
  normalizeLimitations as normalizeConfidenceLimitations,
  normalizeUncertainties,
  uncertaintyKey,
  uncertaintySourceKey,
} from "@/features/enterprise-memory-reasoning/confidence-normalization";
export { validateConfidenceSet } from "@/features/enterprise-memory-reasoning/confidence-validation";
export type { ConfidenceValidation } from "@/features/enterprise-memory-reasoning/confidence-validation";
export { normalizeConfidenceSet } from "@/features/enterprise-memory-reasoning/confidence-boundary";
export type {
  ConfidenceSet,
  ConfidenceSetResult,
  NormalizedConfidenceSet,
} from "@/features/enterprise-memory-reasoning/confidence-boundary";
export { UNDERSTANDING_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/understanding-types";
export type {
  CanonicalUnderstanding,
  Understanding,
  UnderstandingArtifact,
  UnderstandingArtifactDescriptor,
  UnderstandingArtifactKind,
  UnderstandingBasis,
  UnderstandingBundle,
  UnderstandingChain,
  UnderstandingContext,
  UnderstandingReference,
  UnderstandingScope,
  UnderstandingSubject,
  UnderstandingSummary,
} from "@/features/enterprise-memory-reasoning/understanding-types";
export {
  artifactsOf as understandingArtifactsOf,
  basisOf as understandingBasisOf,
  confidenceMemberId,
  evidenceMemberId,
  explanationMemberId,
  provenanceMemberId,
  reachesEvidenceRoot as understandingReachesEvidenceRoot,
  referencesOf as understandingReferencesOf,
  summaryOf as understandingSummaryOf,
  understandingArtifactDescriptorOf,
  understandingArtifactIsGrounding,
  understandingLayerOf,
} from "@/features/enterprise-memory-reasoning/understanding-rules";
export {
  assembleUnderstanding,
  canonicalUnderstandingKey,
  normalizeChain as normalizeUnderstandingChain,
  normalizeContext as normalizeUnderstandingContext,
  normalizeEvidenceItems,
  normalizeUnderstandingBundle,
  understandingReferenceKey,
} from "@/features/enterprise-memory-reasoning/understanding-normalization";
export { validateUnderstanding as validateUnderstandingAssembly } from "@/features/enterprise-memory-reasoning/understanding-validation";
export type { UnderstandingValidation } from "@/features/enterprise-memory-reasoning/understanding-validation";
export { assembleUnderstandingBundle } from "@/features/enterprise-memory-reasoning/understanding-boundary";
export type {
  UnderstandingInput,
  UnderstandingResult,
} from "@/features/enterprise-memory-reasoning/understanding-boundary";
