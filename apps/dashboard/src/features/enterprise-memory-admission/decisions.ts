/**
 * Enterprise Memory Admission — decision contracts.
 *
 * A decision records the OUTCOME of an admission evaluation. Decisions are
 * immutable records of what was decided; they are not workflow steps, not
 * transitions, and they trigger no execution or automation. Nothing here moves a
 * candidate or mutates memory.
 */

import type { MemoryTimestamp } from "@/features/enterprise-memory";
import type { AdmissionAuthorityId } from "@/features/enterprise-memory-admission/authority";
import type { AdmissionPolicyId } from "@/features/enterprise-memory-admission/policies";

/** The recognized admission outcomes. */
export type AdmissionDecisionOutcome =
  | "approved"
  | "rejected"
  | "deferred"
  | "needs-review"
  | "archived-candidate";

interface AdmissionDecisionBase<Outcome extends AdmissionDecisionOutcome> {
  readonly outcome: Outcome;
  readonly decidedBy: AdmissionAuthorityId;
  readonly decidedAt: MemoryTimestamp;
  readonly appliedPolicySet: AdmissionPolicyId;
}

/** The candidate is eligible and admitted under the recorded authority. */
export type ApprovedDecision = AdmissionDecisionBase<"approved">;

/** The candidate is denied admission. */
export interface RejectedDecision extends AdmissionDecisionBase<"rejected"> {
  readonly reason: string;
}

/** A decision is postponed pending named prerequisites. */
export interface DeferredDecision extends AdmissionDecisionBase<"deferred"> {
  readonly pendingOn: readonly string[];
}

/** The candidate requires explicit review before any outcome. */
export interface NeedsReviewDecision extends AdmissionDecisionBase<"needs-review"> {
  readonly reviewNote: string;
}

/** A candidate retired without admission. */
export interface ArchivedCandidateDecision extends AdmissionDecisionBase<"archived-candidate"> {
  readonly archivedReason: string;
}

/** Discriminated union over every admission outcome. */
export type AdmissionDecision =
  | ApprovedDecision
  | RejectedDecision
  | DeferredDecision
  | NeedsReviewDecision
  | ArchivedCandidateDecision;
