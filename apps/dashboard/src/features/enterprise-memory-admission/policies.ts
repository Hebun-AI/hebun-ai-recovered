/**
 * Enterprise Memory Admission — policy contracts.
 *
 * A policy declares what a candidate MUST satisfy to be eligible for admission.
 * Policies are declarative data: they contain no behavior, no evaluation logic,
 * and no enforcement. Whether a candidate meets a policy is not computed here.
 */

import type {
  MemoryConfidenceLevel,
  MemorySensitivity,
} from "@/features/enterprise-memory";
import type { AdmissionAuthorityKind } from "@/features/enterprise-memory-admission/authority";
import type { EvaluationDimension, EvaluationStanding } from "@/features/enterprise-memory-admission/evaluation";

export type AdmissionPolicyId = string;

/** At least this many pieces of evidence, on the named dimensions, are required. */
export interface RequiredEvidencePolicy {
  readonly kind: "required-evidence";
  readonly minimumCount: number;
  readonly dimensions: readonly EvaluationDimension[];
}

/** Admission requires one of the named authority kinds. */
export interface RequiredAuthorityPolicy {
  readonly kind: "required-authority";
  readonly acceptedAuthorities: readonly AdmissionAuthorityKind[];
}

/** Admission requires at least the named confidence standing. */
export interface RequiredConfidencePolicy {
  readonly kind: "required-confidence";
  readonly minimumLevel: MemoryConfidenceLevel;
  readonly minimumStanding: EvaluationStanding;
}

/** Admission requires the candidate to carry an accepted classification. */
export interface RequiredClassificationPolicy {
  readonly kind: "required-classification";
  readonly acceptedSensitivities: readonly MemorySensitivity[];
  readonly requiredCategory?: string;
}

/** Declares that admitted knowledge expires and must be re-evaluated. */
export interface ExpirationPolicy {
  readonly kind: "expiration";
  readonly validForDays: number;
}

/** Declares that admitted knowledge is subject to periodic review. */
export interface ReviewPolicy {
  readonly kind: "review";
  readonly reviewEveryDays: number;
  readonly requiredReviewerAuthority: AdmissionAuthorityKind;
}

/** Discriminated union over every policy kind. */
export type AdmissionPolicy =
  | RequiredEvidencePolicy
  | RequiredAuthorityPolicy
  | RequiredConfidencePolicy
  | RequiredClassificationPolicy
  | ExpirationPolicy
  | ReviewPolicy;

/** A named, immutable set of policies applied together during evaluation. */
export interface AdmissionPolicySet {
  readonly policySetId: AdmissionPolicyId;
  readonly policies: readonly AdmissionPolicy[];
}
