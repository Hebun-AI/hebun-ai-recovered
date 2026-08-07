export {
  RUNTIME_APPROVAL_STATE_DESCRIPTORS,
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_FAILURE_KIND_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
  RUNTIME_RESTRICTION_DESCRIPTORS,
  RUNTIME_STAGE_DESCRIPTORS,
  RUNTIME_STATUS_DESCRIPTORS,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
export type {
  RuntimeApprovalState,
  RuntimeApprovalStateDescriptor,
  RuntimeCandidateKind,
  RuntimeCandidateKindDescriptor,
  RuntimeConfidenceLevel,
  RuntimeConfidenceLevelDescriptor,
  RuntimeDependencyKind,
  RuntimeDependencyKindDescriptor,
  RuntimeFailureKind,
  RuntimeFailureKindDescriptor,
  RuntimeId,
  RuntimeLifecycleState,
  RuntimeLifecycleStateDescriptor,
  RuntimeRestrictionDescriptor,
  RuntimeRestrictionKind,
  RuntimeStageDescriptor,
  RuntimeStageKind,
  RuntimeStatement,
  RuntimeStatus,
  RuntimeStatusDescriptor,
  RuntimeTimestamp,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
export type {
  CanonicalRuntimeRequest,
  RuntimeApproval,
  RuntimeArtifact,
  RuntimeCandidate,
  RuntimeConfidence,
  RuntimeContext,
  RuntimeDependency,
  RuntimeExplainability,
  RuntimeFailure,
  RuntimeGovernance,
  RuntimeInput,
  RuntimeOutput,
  RuntimeProvenance,
  RuntimeRequest,
  RuntimeScope,
  RuntimeSession,
  RuntimeSummary,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
export {
  artifactsOf as runtimeArtifactsOf,
  compareRuntimeConfidence,
  compareRuntimeLifecycle,
  dependenciesOf as runtimeDependenciesOf,
  reachesRequiredDependencies as runtimeReachesRequiredDependencies,
  runtimeApprovalStateDescriptorOf,
  runtimeCandidateKindDescriptorOf,
  runtimeCandidateKindOrderOf,
  runtimeCandidateRequiresBasis,
  runtimeCandidateSourcePhaseOf,
  runtimeConfidenceLevelDescriptorOf,
  runtimeConfidenceOrderOf,
  runtimeDependencyIsRequired,
  runtimeDependencyKindDescriptorOf,
  runtimeDependencyOrderOf,
  runtimeFailureIsFailClosed,
  runtimeFailureKindDescriptorOf,
  runtimeFailureOrderOf,
  runtimeLifecycleIsTerminal,
  runtimeLifecycleOrderOf,
  runtimeLifecycleStateDescriptorOf,
  runtimeRequiredDependencyKinds,
  runtimeRestrictionDescriptorOf,
  runtimeRestrictionOrderOf,
  runtimeStageDescriptorOf,
  runtimeStageOrderOf,
  runtimeStatusDescriptorOf,
  runtimeStatusOrderOf,
  summaryOf as runtimeSummaryOf,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-rules";
export {
  canonicalRuntimeRequestKey,
  normalizeContext as normalizeRuntimeContext,
  normalizeDependencies as normalizeRuntimeDependencies,
  normalizeRuntimeRequest,
  normalizeScope as normalizeRuntimeScope,
  normalizeStages as normalizeRuntimeStages,
  normalizeTargets as normalizeRuntimeTargets,
  runtimeDependencyKey,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-normalization";
export { validateRuntimeRequest } from "@/features/enterprise-organizational-intelligence-runtime/runtime-validation";
export type { RuntimeValidation } from "@/features/enterprise-organizational-intelligence-runtime/runtime-validation";
export {
  RUNTIME_CAPABILITIES,
  RUNTIME_NON_RESPONSIBILITIES,
  prepareRuntimeRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-boundary";
export type {
  RuntimeCapability,
  RuntimeNonResponsibility,
  RuntimeRequestInput,
  RuntimeRequestResult,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-boundary";

// --- Runtime Context & Assembly (Phase 2) ------------------------------------

export { RUNTIME_FOUNDATION_KIND_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
export type {
  CanonicalRuntimeBundle,
  RuntimeAssembly,
  RuntimeAssemblyRequest,
  RuntimeAssemblySession,
  RuntimeBundle,
  RuntimeFoundationKind,
  RuntimeFoundationKindDescriptor,
  RuntimeFoundationSource,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
export {
  assemblyOf as runtimeAssemblyOf,
  foundationSourcesOf as runtimeFoundationSourcesOf,
  reachesAllFoundations as runtimeReachesAllFoundations,
  resolveRuntimeFoundationSources,
  runtimeFoundationDependencyKindOf,
  runtimeFoundationKindDescriptorOf,
  runtimeFoundationKindOrderOf,
  runtimeRequiredFoundationKinds,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-rules";
export {
  canonicalRuntimeBundleKey,
  normalizeAssembly as normalizeRuntimeAssembly,
  normalizeFoundationSources as normalizeRuntimeFoundationSources,
  normalizeRuntimeBundle,
  runtimeFoundationSourceKey,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-normalization";
export {
  validateRuntimeAssemblyRequest,
  validateRuntimeBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
export type { RuntimeAssemblyValidation } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
export {
  RUNTIME_ASSEMBLY_CAPABILITIES,
  RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  openRuntimeAssemblySession,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-boundary";
export type {
  RuntimeAssemblyCapability,
  RuntimeAssemblyInput,
  RuntimeAssemblyNonResponsibility,
  RuntimeAssemblyResult,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-boundary";

// --- Learning Candidate Runtime (Phase 3) ------------------------------------

export type {
  CanonicalLearningCandidateSet,
  LearningCandidate,
  LearningCandidateKind,
  LearningCandidateRequest,
  LearningCandidateSeed,
  LearningCandidateSet,
  LearningEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-types";
export {
  formLearningCandidate,
  groundsInEligibleEvidence,
  identifyLearningCandidates,
  isLearningEvidenceEligible,
  learningCandidateSupersedes,
  learningEvidenceIndex,
  learningRequiresBasis,
  resolveCandidateEvidence,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-rules";
export {
  canonicalLearningCandidateSetKey,
  learningCandidateKey,
  normalizeEvidenceRefs as normalizeLearningEvidenceRefs,
  normalizeLearningCandidate,
  normalizeLearningCandidateSet,
  normalizeLearningCandidates,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-normalization";
export {
  validateLearningCandidateRequest,
  validateLearningCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
export type { LearningCandidateValidation } from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-validation";
export {
  LEARNING_CANDIDATE_CAPABILITIES,
  LEARNING_CANDIDATE_NON_RESPONSIBILITIES,
  prepareLearningCandidates,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-boundary";
export type {
  LearningCandidateCapability,
  LearningCandidateInput,
  LearningCandidateNonResponsibility,
  LearningCandidateResult,
} from "@/features/enterprise-organizational-intelligence-runtime/learning-candidate-boundary";

// --- Optimization Candidate Runtime (Phase 4) --------------------------------

export type {
  CanonicalOptimizationCandidateSet,
  OptimizationCandidate,
  OptimizationCandidateKind,
  OptimizationCandidateRequest,
  OptimizationCandidateSeed,
  OptimizationCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-types";
export {
  formOptimizationCandidate,
  groundsInDeclaredLearning,
  identifyOptimizationCandidates,
  learningSupportIndex,
  optimizationCandidateSupersedes,
  optimizationRequiresBasis,
  resolveSupportingLearning,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-rules";
export {
  canonicalOptimizationCandidateSetKey,
  normalizeOptimizationCandidate,
  normalizeOptimizationCandidates,
  normalizeOptimizationCandidateSet,
  normalizeReferenceIds as normalizeOptimizationReferenceIds,
  optimizationCandidateKey,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-normalization";
export {
  validateOptimizationCandidateRequest,
  validateOptimizationCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
export type { OptimizationCandidateValidation } from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-validation";
export {
  OPTIMIZATION_CANDIDATE_CAPABILITIES,
  OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES,
  prepareOptimizationCandidates,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-boundary";
export type {
  OptimizationCandidateCapability,
  OptimizationCandidateInput,
  OptimizationCandidateNonResponsibility,
  OptimizationCandidateResult,
} from "@/features/enterprise-organizational-intelligence-runtime/optimization-candidate-boundary";

// --- Awareness Candidate Runtime (Phase 5) -----------------------------------

export type {
  AwarenessCandidate,
  AwarenessCandidateKind,
  AwarenessCandidateRequest,
  AwarenessCandidateSeed,
  AwarenessCandidateSet,
  CanonicalAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-types";
export {
  awarenessCandidateSupersedes,
  awarenessRequiresBasis,
  formAwarenessCandidate,
  groundsInDeclaredOptimization,
  identifyAwarenessCandidates,
  optimizationSupportIndex,
  resolveSupportingOptimization,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-rules";
export {
  awarenessCandidateKey,
  canonicalAwarenessCandidateSetKey,
  normalizeAwarenessCandidate,
  normalizeAwarenessCandidates,
  normalizeAwarenessCandidateSet,
  normalizeReferenceIds as normalizeAwarenessReferenceIds,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-normalization";
export {
  validateAwarenessCandidateRequest,
  validateAwarenessCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
export type { AwarenessCandidateValidation } from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-validation";
export {
  AWARENESS_CANDIDATE_CAPABILITIES,
  AWARENESS_CANDIDATE_NON_RESPONSIBILITIES,
  prepareAwarenessCandidates,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-boundary";
export type {
  AwarenessCandidateCapability,
  AwarenessCandidateInput,
  AwarenessCandidateNonResponsibility,
  AwarenessCandidateResult,
} from "@/features/enterprise-organizational-intelligence-runtime/awareness-candidate-boundary";

// --- Evolution Candidate Runtime (Phase 6) -----------------------------------

export type {
  CanonicalEvolutionCandidateSet,
  EvolutionCandidate,
  EvolutionCandidateKind,
  EvolutionCandidateRequest,
  EvolutionCandidateSeed,
  EvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-types";
export {
  EVOLUTION_CANDIDATE_KINDS,
  awarenessSupportIndex,
  evolutionCandidateSupersedes,
  evolutionRequiresBasis,
  formEvolutionCandidate,
  groundsInDeclaredAwareness,
  identifyEvolutionCandidates,
  isEvolutionCandidateKind,
  resolveSupportingAwareness,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-rules";
export {
  canonicalEvolutionCandidateSetKey,
  evolutionCandidateKey,
  normalizeEvolutionCandidate,
  normalizeEvolutionCandidates,
  normalizeEvolutionCandidateSet,
  normalizeReferenceIds as normalizeEvolutionReferenceIds,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-normalization";
export {
  validateEvolutionCandidateRequest,
  validateEvolutionCandidateSet,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";
export type { EvolutionCandidateValidation } from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-validation";
export {
  EVOLUTION_CANDIDATE_CAPABILITIES,
  EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES,
  prepareEvolutionCandidates,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-boundary";
export type {
  EvolutionCandidateCapability,
  EvolutionCandidateInput,
  EvolutionCandidateNonResponsibility,
  EvolutionCandidateResult,
} from "@/features/enterprise-organizational-intelligence-runtime/evolution-candidate-boundary";

// --- Provenance / Explainability / Confidence Binding (Phase 7) --------------

export type {
  BoundRuntimeArtifact,
  CanonicalRuntimeBindingBundle,
  RuntimeBindingBundle,
  RuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
export {
  bindAwarenessCandidate,
  bindCandidateSets,
  bindEvolutionCandidate,
  bindLearningCandidate,
  bindOptimizationCandidate,
  bindingIdentity,
  boundArtifactSource,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-rules";
export {
  boundArtifactKey,
  canonicalRuntimeBindingBundleKey,
  normalizeBoundArtifact,
  normalizeBoundArtifacts,
  normalizeReferenceIds as normalizeBindingReferenceIds,
  normalizeRuntimeBindingBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-normalization";
export {
  validateRuntimeBindingBundle,
  validateRuntimeBindingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-validation";
export type { RuntimeBindingValidation } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-validation";
export {
  RUNTIME_BINDING_CAPABILITIES,
  RUNTIME_BINDING_NON_RESPONSIBILITIES,
  prepareRuntimeBinding,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-boundary";
export type {
  RuntimeBindingCapability,
  RuntimeBindingInput,
  RuntimeBindingNonResponsibility,
  RuntimeBindingResult,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-boundary";

// --- Governance & Director Briefing (Phase 8) --------------------------------

export type {
  CanonicalDirectorBriefing,
  DirectorBriefing,
  DirectorBriefingGovernance,
  DirectorBriefingGovernanceInput,
  DirectorBriefingItem,
  DirectorBriefingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";
export {
  briefingItemSource,
  describeGovernance,
  projectBriefingItem,
  projectBriefingItems,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-rules";
export {
  briefingItemKey,
  canonicalDirectorBriefingKey,
  normalizeBriefingItem,
  normalizeBriefingItems,
  normalizeDirectorBriefing,
  normalizeGovernance as normalizeDirectorBriefingGovernance,
  normalizeReferenceIds as normalizeDirectorBriefingReferenceIds,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-normalization";
export {
  validateDirectorBriefing,
  validateDirectorBriefingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-validation";
export type { DirectorBriefingValidation } from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-validation";
export {
  DIRECTOR_BRIEFING_CAPABILITIES,
  DIRECTOR_BRIEFING_NON_RESPONSIBILITIES,
  prepareDirectorBriefing,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-boundary";
export type {
  DirectorBriefingCapability,
  DirectorBriefingInput,
  DirectorBriefingNonResponsibility,
  DirectorBriefingResult,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-boundary";

// --- Runtime Integration & Composition Closure (Phase 9) ---------------------

export type {
  CanonicalRuntimeComposition,
  RuntimeComposition,
  RuntimeCompositionIntegrity,
  RuntimeCompositionRequest,
  RuntimeCompositionSummary,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-types";
export {
  PENDING_DIRECTOR_APPROVAL as RUNTIME_COMPOSITION_PENDING_DIRECTOR_APPROVAL,
  candidateBindingIds,
  compositionIdentity,
  summarize as summarizeRuntimeComposition,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-rules";
export {
  normalizeRuntimeComposition,
  runtimeCompositionKey,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-normalization";
export {
  validateRuntimeComposition,
  validateRuntimeCompositionRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-validation";
export type { RuntimeCompositionValidation } from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-validation";
export {
  RUNTIME_COMPOSITION_CAPABILITIES,
  RUNTIME_COMPOSITION_NON_RESPONSIBILITIES,
  composeRuntime,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-boundary";
export type {
  RuntimeCompositionCapability,
  RuntimeCompositionInput,
  RuntimeCompositionNonResponsibility,
  RuntimeCompositionResult,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-composition-boundary";
