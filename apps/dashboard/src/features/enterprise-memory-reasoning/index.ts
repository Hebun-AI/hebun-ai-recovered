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
