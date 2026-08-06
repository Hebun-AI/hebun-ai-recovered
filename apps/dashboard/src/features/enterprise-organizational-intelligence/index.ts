export { ORGANIZATION_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/contracts";
export type {
  OrganizationArtifact,
  OrganizationArtifactDescriptor,
  OrganizationArtifactKind,
  OrganizationId,
  OrganizationStatement,
  OrganizationTimestamp,
} from "@/features/enterprise-organizational-intelligence/contracts";
export { ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-domain";
export type {
  OrganizationDomain,
  OrganizationDomainCategory,
  OrganizationDomainCategoryDescriptor,
  OrganizationDomainId,
} from "@/features/enterprise-organizational-intelligence/organization-domain";
export type { OrganizationScope, OrganizationScopeId } from "@/features/enterprise-organizational-intelligence/organization-scope";
export type { Organization } from "@/features/enterprise-organizational-intelligence/organization";
export type {
  OrganizationObservation,
  OrganizationObservationId,
} from "@/features/enterprise-organizational-intelligence/organization-observation";
export type {
  OrganizationConstraint,
  OrganizationConstraintId,
} from "@/features/enterprise-organizational-intelligence/organization-constraint";
export type {
  OrganizationCapability,
  OrganizationCapabilityId,
} from "@/features/enterprise-organizational-intelligence/organization-capability";
export type {
  OrganizationOpportunity,
  OrganizationOpportunityId,
} from "@/features/enterprise-organizational-intelligence/organization-opportunity";
export { ORGANIZATION_RISK_SEVERITY_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-risk";
export type {
  OrganizationRisk,
  OrganizationRiskId,
  OrganizationRiskSeverity,
  OrganizationRiskSeverityDescriptor,
} from "@/features/enterprise-organizational-intelligence/organization-risk";
export type {
  OrganizationObjective,
  OrganizationObjectiveId,
} from "@/features/enterprise-organizational-intelligence/organization-objective";
export type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";
export type { OrganizationContext } from "@/features/enterprise-organizational-intelligence/organization-context";
export type { OrganizationUnderstanding } from "@/features/enterprise-organizational-intelligence/organization-understanding";
export { ORGANIZATION_INTELLIGENCE_NON_RESPONSIBILITIES } from "@/features/enterprise-organizational-intelligence/organization-boundary";
export type {
  OrganizationIntelligenceNonResponsibility,
  OrganizationIntelligenceRequest,
  OrganizationIntelligenceRequestId,
} from "@/features/enterprise-organizational-intelligence/organization-boundary";
export { validateOrganizationUnderstanding } from "@/features/enterprise-organizational-intelligence/validation";
export type { OrganizationValidation } from "@/features/enterprise-organizational-intelligence/validation";
export { ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
export type {
  CanonicalOrganizationAssembly,
  OrganizationAssembly,
  OrganizationAssemblyArtifact,
  OrganizationAssemblyArtifactDescriptor,
  OrganizationAssemblyArtifactKind,
  OrganizationAssemblyBasis,
  OrganizationAssemblyBundle,
  OrganizationAssemblyChain,
  OrganizationAssemblyContext,
  OrganizationAssemblyReference,
  OrganizationAssemblySummary,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
export {
  artifactsOf as organizationAssemblyArtifactsOf,
  basisOf as organizationAssemblyBasisOf,
  organizationAssemblyArtifactDescriptorOf,
  organizationAssemblyArtifactIsGrounded,
  organizationAssemblyLayerOf,
  reachesEvidenceRoot as organizationAssemblyReachesEvidenceRoot,
  referencesOf as organizationAssemblyReferencesOf,
  summaryOf as organizationAssemblySummaryOf,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-rules";
export {
  assembleOrganization,
  canonicalOrganizationAssemblyKey,
  normalizeChain as normalizeOrganizationAssemblyChain,
  normalizeContext as normalizeOrganizationAssemblyContext,
  normalizeOrganizationAssemblyBundle,
  organizationAssemblyReferenceKey,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-normalization";
export { validateOrganizationAssembly } from "@/features/enterprise-organizational-intelligence/organization-assembly-validation";
export type { OrganizationAssemblyValidation } from "@/features/enterprise-organizational-intelligence/organization-assembly-validation";
export { assembleOrganizationBundle } from "@/features/enterprise-organizational-intelligence/organization-assembly-boundary";
export type {
  OrganizationAssemblyInput,
  OrganizationAssemblyResult,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-boundary";
export {
  LEARNING_LIFECYCLE_STATE_DESCRIPTORS,
  LEARNING_RELATIONSHIP_KIND_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
export type {
  CanonicalOrganizationLearningContext,
  LearningLifecycleState,
  LearningLifecycleStateDescriptor,
  LearningRelationshipKind,
  LearningRelationshipKindDescriptor,
  OrganizationLearning,
  OrganizationLearningBasis,
  OrganizationLearningContext,
  OrganizationLearningId,
  OrganizationLearningProvenance,
  OrganizationLearningRelationship,
  OrganizationLearningStatement,
  OrganizationLearningSubject,
  OrganizationLearningUncertainty,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
export {
  compareLearningLifecycle,
  learningBasisEvidenceOf,
  learningLifecycleIsTerminal,
  learningLifecycleOrderOf,
  learningLifecycleStateDescriptorOf,
  learningReachesEvidenceRoot,
  learningRelationshipIsSymmetric,
  learningRelationshipKindDescriptorOf,
} from "@/features/enterprise-organizational-intelligence/organization-learning-rules";
export {
  canonicalLearningContextKey,
  learningRelationshipKey,
  normalizeLearning,
  normalizeLearningBasis,
  normalizeLearningContext,
  normalizeLearningRelationships,
  normalizeLearnings,
  normalizeLearningUncertainties,
  normalizeOrganizationLearningContext,
} from "@/features/enterprise-organizational-intelligence/organization-learning-normalization";
export { validateOrganizationLearningContext } from "@/features/enterprise-organizational-intelligence/organization-learning-validation";
export type { OrganizationLearningValidation } from "@/features/enterprise-organizational-intelligence/organization-learning-validation";
export { ORGANIZATION_LEARNING_NON_RESPONSIBILITIES, prepareOrganizationLearningContext } from "@/features/enterprise-organizational-intelligence/organization-learning-boundary";
export type {
  OrganizationLearningInput,
  OrganizationLearningNonResponsibility,
  OrganizationLearningResult,
} from "@/features/enterprise-organizational-intelligence/organization-learning-boundary";
export { OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
export type {
  CanonicalOptimizationContext,
  OptimizationAnalysisId,
  OptimizationBasis,
  OptimizationContext,
  OptimizationEffectivenessAnalysis,
  OptimizationLifecycleState,
  OptimizationLifecycleStateDescriptor,
  OptimizationOpportunity,
  OptimizationOpportunityId,
  OptimizationPriority,
  OptimizationPriorityId,
  OptimizationProvenance,
  OptimizationUncertainty,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
export {
  compareOptimizationLifecycle,
  optimizationBasisEvidenceOf,
  optimizationBasisLearningsOf,
  optimizationBasisReachesSource,
  optimizationLifecycleIsTerminal,
  optimizationLifecycleOrderOf,
  optimizationLifecycleStateDescriptorOf,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-rules";
export {
  canonicalOptimizationContextKey,
  normalizeOptimizationAnalyses,
  normalizeOptimizationAnalysis,
  normalizeOptimizationBasis,
  normalizeOptimizationContext,
  normalizeOptimizationOpportunities,
  normalizeOptimizationOpportunity,
  normalizeOptimizationPriorities,
  normalizeOptimizationUncertainties,
  normalizeOrganizationOptimizationContext,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-normalization";
export { validateOrganizationOptimizationContext } from "@/features/enterprise-organizational-intelligence/organization-optimization-validation";
export type { OrganizationOptimizationValidation } from "@/features/enterprise-organizational-intelligence/organization-optimization-validation";
export {
  ORGANIZATION_OPTIMIZATION_NON_RESPONSIBILITIES,
  prepareOrganizationOptimizationContext,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-boundary";
export type {
  OrganizationOptimizationInput,
  OrganizationOptimizationNonResponsibility,
  OrganizationOptimizationResult,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-boundary";
export {
  AWARENESS_LIFECYCLE_STATE_DESCRIPTORS,
  STRATEGIC_DIMENSION_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
export type {
  AwarenessBasis,
  AwarenessContext,
  AwarenessLifecycleState,
  AwarenessLifecycleStateDescriptor,
  AwarenessProvenance,
  AwarenessUncertainty,
  CanonicalAwarenessContext,
  StrategicAssessment,
  StrategicAssessmentId,
  StrategicDimension,
  StrategicDimensionDescriptor,
  StrategicSignal,
  StrategicSignalId,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
export {
  awarenessBasisEvidenceOf,
  awarenessBasisLearningsOf,
  awarenessBasisOpportunitiesOf,
  awarenessBasisReachesSource,
  awarenessLifecycleIsTerminal,
  awarenessLifecycleOrderOf,
  awarenessLifecycleStateDescriptorOf,
  compareAwarenessLifecycle,
  strategicDimensionDescriptorOf,
  strategicDimensionOrderOf,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-rules";
export {
  canonicalAwarenessContextKey,
  normalizeAwarenessBasis,
  normalizeAwarenessContext,
  normalizeAwarenessDerivedFrom,
  normalizeAwarenessUncertainties,
  normalizeOrganizationAwarenessContext,
  normalizeStrategicAssessment,
  normalizeStrategicAssessments,
  normalizeStrategicSignal,
  normalizeStrategicSignals,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-normalization";
export { validateOrganizationAwarenessContext } from "@/features/enterprise-organizational-intelligence/organization-awareness-validation";
export type { OrganizationAwarenessValidation } from "@/features/enterprise-organizational-intelligence/organization-awareness-validation";
export {
  ORGANIZATION_AWARENESS_NON_RESPONSIBILITIES,
  prepareOrganizationAwarenessContext,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-boundary";
export type {
  OrganizationAwarenessInput,
  OrganizationAwarenessNonResponsibility,
  OrganizationAwarenessResult,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-boundary";
